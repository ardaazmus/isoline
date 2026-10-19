/**
 * Factor registry (G4-01; plan 09 §4). Built-in sets come from the toolkit library (official or open data with
 * publisher, licence and as-of date) and are stored with a content digest: a changed value is a new row, never an
 * edit, so a run made with ETKB 2023 keeps pointing at exactly those numbers. Tenants add private sets (their own
 * or licensed data) only after confirming the right to use them. Resolution picks the edition for the reporting
 * year — "the newest factor" is not "the right factor for that year" — and says when it had to fall back.
 */
import { createHash } from "node:crypto";
import { sql } from "kysely";
import { BUILTIN_SETS, importFactorCsv, type Factor, type FactorSet } from "@/lib/factors";
import { audit, canonicalJson } from "../audit/audit";
import { withActor, withSystem, type Actor, type Tx } from "../db/client";
import { HttpError, notFound } from "../policy/policy";
import { requireMemberAction, requireProjectAction } from "../tenancy/service";

const digestOf = (factors: Factor[]) =>
  createHash("sha256")
    .update(canonicalJson(factors.map((f) => ({ kind: f.kind, key: f.key, value: f.value, unit: f.unit ?? null, ncv: f.ncv ?? null, ch4: f.ch4 ?? null, n2o: f.n2o ?? null, direct: f.direct ?? null, indirect: f.indirect ?? null, year: f.year ?? null })).sort((a, b) => `${a.kind}:${a.key}`.localeCompare(`${b.kind}:${b.key}`))))
    .digest("hex");

async function insertSet(tx: Tx, s: FactorSet, owner: string | null, by: string | null, rights: { confirmed: boolean; by: string | null }): Promise<string> {
  const digest = digestOf(s.factors);
  const existing = await tx
    .selectFrom("core.factor_sets")
    .select("id")
    .where("code", "=", s.id)
    .where("content_sha256", "=", digest)
    .where((eb) => (owner ? eb("owner_tenant_id", "=", owner) : eb("owner_tenant_id", "is", null)))
    .executeTakeFirst();
  if (existing) return existing.id;
  const row = await tx
    .insertInto("core.factor_sets")
    .values({
      owner_tenant_id: owner,
      code: s.id,
      family: s.family ?? null,
      edition_year: s.year ?? null,
      name: s.name,
      publisher: s.publisher,
      licence: s.licence,
      licence_note: s.licenceNote ?? null,
      url: s.url || null,
      published_on: s.published ?? null,
      as_of: s.asOf || null,
      rights_confirmed: rights.confirmed,
      rights_confirmed_by: rights.by,
      rights_confirmed_at: rights.confirmed ? new Date() : null,
      content_sha256: digest,
      created_by: by,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  const seen = new Set<string>();
  for (const f of s.factors) {
    const k = `${f.kind}:${f.key}`;
    if (seen.has(k)) continue;
    seen.add(k);
    await tx
      .insertInto("core.factor_values")
      .values({ set_id: row.id, kind: f.kind, key: f.key, label: f.label ?? null, value: String(f.value), unit: f.unit ?? null, ncv: f.ncv === undefined ? null : String(f.ncv), ch4: f.ch4 === undefined ? null : String(f.ch4), n2o: f.n2o === undefined ? null : String(f.n2o), direct: f.direct === undefined ? null : String(f.direct), indirect: f.indirect === undefined ? null : String(f.indirect), year: f.year ?? null, categories: f.categories ?? [] })
      .execute();
  }
  return row.id;
}

/** Deploy-time sync of the built-in library (also run by `npm run db:migrate` and the test setup). */
export async function syncBuiltinFactors(): Promise<{ sets: number }> {
  return withSystem("factor library sync at deploy time", async (tx) => {
    for (const s of BUILTIN_SETS) await insertSet(tx, s, null, null, { confirmed: true, by: null });
    return { sets: BUILTIN_SETS.length };
  });
}

/** A tenant's own set from the toolkit CSV format; licensed data needs an explicit rights confirmation. */
export async function addCustomSet(
  actor: Actor,
  input: { code: string; name: string; publisher: string; licence: "open" | "public_sector" | "user_licensed"; url?: string | null; year?: number | null; csv: string; rightsConfirmed: boolean },
): Promise<{ setId: string; factors: number; issues: { row: number; key: string }[] }> {
  if (!/^[a-z0-9_]{3,40}$/.test(input.code)) throw new HttpError(422, "invalid_code");
  if (input.licence === "user_licensed" && !input.rightsConfirmed) throw new HttpError(422, "rights_confirmation_required");
  const parsed = importFactorCsv(input.csv, input.code);
  if (!parsed.factors.length) throw new HttpError(422, "no_factors");
  return withActor(actor, async (tx) => {
    await requireMemberAction(tx, actor, "calc.run");
    const set: FactorSet = { id: input.code, name: input.name.trim(), publisher: input.publisher.trim(), licence: input.licence, licenceNote: "", url: input.url ?? "", asOf: new Date().toISOString().slice(0, 10), origin: "custom", rightsConfirmed: input.rightsConfirmed, year: input.year ?? undefined, factors: parsed.factors };
    const id = await insertSet(tx, set, actor.actingTenantId!, actor.userId, { confirmed: input.rightsConfirmed, by: input.rightsConfirmed ? actor.userId : null });
    await audit(tx, actor, { action: "factor.set_add", objectType: "factor_set", objectId: id, ownerTenantId: actor.actingTenantId, after: { code: input.code, licence: input.licence, factors: parsed.factors.length, rightsConfirmed: input.rightsConfirmed } });
    return { setId: id, factors: parsed.factors.length, issues: parsed.issues.map((i) => ({ row: i.row, key: i.key })) };
  });
}

export async function listFactorSets(actor: Actor) {
  return withActor(actor, async (tx) => {
    const sets = await tx.selectFrom("core.factor_sets").selectAll().orderBy("family").orderBy("edition_year", "desc").orderBy("code").execute();
    const counts = await tx.selectFrom("core.factor_values").select(["set_id", (eb) => eb.fn.countAll<number>().as("n")]).groupBy("set_id").execute();
    return sets.map((s) => ({ ...s, factors: Number(counts.find((c) => c.set_id === s.id)?.n ?? 0) }));
  });
}

export async function factorValues(actor: Actor, setId: string) {
  return withActor(actor, async (tx) => {
    const s = await tx.selectFrom("core.factor_sets").select("id").where("id", "=", setId).executeTakeFirst();
    if (!s) throw notFound();
    return tx.selectFrom("core.factor_values").selectAll().where("set_id", "=", setId).orderBy("kind").orderBy("key").execute();
  });
}

/** A project's explicit factor for a target ("grid:distribution", "fuel:natural_gas", "scope3:ghg_purchases:steel"). */
export async function chooseFactor(actor: Actor, projectId: string, target: string, factorValueId: string, reason?: string | null): Promise<void> {
  if (!/^(grid|fuel|gwp|scope3|cbam):[a-z0-9_:./-]+$/.test(target)) throw new HttpError(422, "invalid_target");
  await withActor(actor, async (tx) => {
    const a = await requireProjectAction(tx, actor, projectId, "calc.run");
    const v = await tx.selectFrom("core.factor_values as v").innerJoin("core.factor_sets as s", "s.id", "v.set_id").select(["v.id", "v.kind", "s.licence", "s.rights_confirmed", "s.owner_tenant_id"]).where("v.id", "=", factorValueId).executeTakeFirst();
    if (!v) throw notFound("factor_not_found");
    if (v.owner_tenant_id && v.owner_tenant_id !== a.ownerTenantId) throw new HttpError(422, "factor_of_other_tenant");
    if (v.licence === "user_licensed" && !v.rights_confirmed) throw new HttpError(422, "rights_confirmation_required");
    await tx.updateTable("core.factor_choices").set({ revoked_at: new Date() }).where("project_id", "=", projectId).where("target", "=", target).where("revoked_at", "is", null).execute();
    await tx.insertInto("core.factor_choices").values({ owner_tenant_id: a.ownerTenantId, project_id: projectId, target, factor_value_id: factorValueId, reason: reason ?? null, chosen_by: actor.userId }).execute();
    await audit(tx, actor, { action: "factor.choose", objectType: "factor_choice", objectId: `${projectId}:${target}`, ownerTenantId: a.ownerTenantId, projectId, after: { target, factorValueId, reason: reason ?? null } });
  });
}

export async function listChoices(actor: Actor, projectId: string) {
  return withActor(actor, async (tx) => {
    await requireProjectAction(tx, actor, projectId, "project.read");
    return choicesQuery(tx, projectId).execute();
  });
}

/** A project's factor choices in force, by target: listChoices and the calculations page (the value as exact text). */
export function choicesQuery(tx: Tx, projectId: string) {
  return tx
    .selectFrom("core.factor_choices as c")
    .innerJoin("core.factor_values as v", "v.id", "c.factor_value_id")
    .innerJoin("core.factor_sets as s", "s.id", "v.set_id")
    .leftJoin("user as u", "u.id", "c.chosen_by")
    .select(["c.id", "c.target", "c.reason", "c.created_at", "v.key", sql<string>`v.value::text`.as("value"), "v.unit", "s.code", "s.edition_year", "s.name as set_name", "u.name as chosen_by_name"])
    .where("c.project_id", "=", projectId)
    .where("c.revoked_at", "is", null)
    .orderBy("c.target");
}

// ---------------------------------------------------------------- resolution for a run

export type ResolvedFactor = { target: string; valueId: string; setId: string; setCode: string; edition: number | null; licence: string; key: string; value: number; unit: string | null; ncv: number | null; ch4: number | null; n2o: number | null; chosen: boolean };
export type Resolution = { factors: Record<string, ResolvedFactor>; warnings: { target: string; code: string; detail?: Record<string, unknown> }[] };

type Row = { id: string; set_id: string; key: string; kind: string; value: string; unit: string | null; ncv: string | null; ch4: string | null; n2o: string | null; code: string; edition_year: number | null; family: string | null; licence: string; created_at: Date };

const toResolved = (target: string, r: Row, chosen: boolean): ResolvedFactor => ({ target, valueId: r.id, setId: r.set_id, setCode: r.code, edition: r.edition_year, licence: r.licence, key: r.key, value: Number(r.value), unit: r.unit, ncv: r.ncv === null ? null : Number(r.ncv), ch4: r.ch4 === null ? null : Number(r.ch4), n2o: r.n2o === null ? null : Number(r.n2o), chosen });

/**
 * Factors for one project and reporting year: explicit project choices win; otherwise the built-in default —
 * ETKB grid factors of the reporting year (or the latest earlier edition, with a warning), IPCC 2006 fuel
 * factors, AR6 GWPs, EU CBAM default values of the origin country (used only where no verified actual value
 * exists, with the mark-up). Scope 3 factors have no silent default: they must be chosen.
 */
export async function resolveFactors(tx: Tx, projectId: string, year: number, targets: string[]): Promise<Resolution> {
  const rows = (await tx
    .selectFrom("core.factor_values as v")
    .innerJoin("core.factor_sets as s", "s.id", "v.set_id")
    .select(["v.id", "v.set_id", "v.key", "v.kind", "v.value", "v.unit", "v.ncv", "v.ch4", "v.n2o", "s.code", "s.edition_year", "s.family", "s.licence", "s.created_at"])
    .where("s.owner_tenant_id", "is", null)
    .where("s.status", "=", "active")
    .execute()) as Row[];
  // newest stored row per (set code, kind, key): a re-published edition supersedes for new runs only
  const latest = new Map<string, Row>();
  for (const r of rows) {
    const k = `${r.code}|${r.kind}|${r.key}`;
    const cur = latest.get(k);
    if (!cur || cur.created_at < r.created_at) latest.set(k, r);
  }
  const builtin = [...latest.values()];
  const choices = await tx
    .selectFrom("core.factor_choices as c")
    .innerJoin("core.factor_values as v", "v.id", "c.factor_value_id")
    .innerJoin("core.factor_sets as s", "s.id", "v.set_id")
    .select(["c.target", "v.id", "v.set_id", "v.key", "v.kind", "v.value", "v.unit", "v.ncv", "v.ch4", "v.n2o", "s.code", "s.edition_year", "s.family", "s.licence", "s.created_at"])
    .where("c.project_id", "=", projectId)
    .where("c.revoked_at", "is", null)
    .execute();
  const out: Resolution = { factors: {}, warnings: [] };
  const etkb = builtin.filter((r) => r.family === "etkb");
  const editions = [...new Set(etkb.map((r) => r.edition_year!))].sort((a, b) => a - b);
  const gridEdition = editions.includes(year) ? year : (editions.filter((e) => e < year).at(-1) ?? editions[0]);
  for (const target of targets) {
    const chosen = choices.find((c) => c.target === target);
    if (chosen) {
      out.factors[target] = toResolved(target, chosen as Row, true);
      continue;
    }
    const [kind, key] = target.split(":");
    let r: Row | undefined;
    if (kind === "grid" && key.startsWith("eea-")) {
      // sites outside Türkiye: EEA generation intensity of the country (latest published year)
      r = builtin.filter((x) => x.family === "eea_ener038" && x.key.toLowerCase() === key.slice(4)).sort((a, b) => (b.edition_year ?? 0) - (a.edition_year ?? 0))[0];
      if (r && r.edition_year !== null && r.edition_year !== year) out.warnings.push({ target, code: "factor_edition_fallback", detail: { year, edition: r.edition_year } });
    } else if (kind === "grid") {
      r = etkb.find((x) => x.edition_year === gridEdition && x.key === `TR-${key}`);
      if (r && gridEdition !== year) out.warnings.push({ target, code: "factor_edition_fallback", detail: { year, edition: gridEdition } });
    } else if (kind === "fuel") r = builtin.find((x) => x.code === "ipcc_2006" && x.key === key);
    else if (kind === "gwp") r = builtin.find((x) => x.code === "ipcc_ar6_gwp" && x.key.toLowerCase() === key);
    else if (kind === "cbam") {
      // "cbam:<origin>:<cn>": EU default value (Impl. Reg. 2026/1740 Annex I) of the origin's table, longest CN
      // prefix; a country without its own table uses "Other Countries and Territories"
      const cn = (target.split(":")[2] ?? "").replace(/\D/g, "");
      const table = (cc: string) => builtin.filter((x) => x.family === "eu_cbam_dv" && x.code === `eu_cbam_dv_${cc}` && x.kind === "cbam_default" && cn.length >= 4 && cn.startsWith(x.key.replace(/\D/g, "")));
      const rows = table(key).length ? table(key) : table("other");
      r = rows.sort((a, b) => b.key.length - a.key.length)[0];
      if (r && !table(key).length) out.warnings.push({ target, code: "cbam_other_countries_table", detail: { origin: key } });
    }
    if (r) out.factors[target] = toResolved(target, r, false);
    else out.warnings.push({ target, code: "factor_missing" });
  }
  return out;
}

/** Digest of the factors a run used, by target (order-free: a stored resolution comes back from jsonb re-ordered). */
export const factorDigest = (r: Resolution) =>
  createHash("sha256")
    .update(canonicalJson(Object.values(r.factors).sort((a, b) => a.target.localeCompare(b.target)).map((f) => ({ t: f.target, id: f.valueId, v: f.value, ncv: f.ncv, ch4: f.ch4, n2o: f.n2o }))))
    .digest("hex");
