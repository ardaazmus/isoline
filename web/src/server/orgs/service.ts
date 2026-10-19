/**
 * Organisation tree (G2-01, G2-02; plan 03 §2): organisation → legal entities → facilities, with dated ownership and
 * control edges. Writes need `org.manage` in the owner tenant (or stewardship of a provisional client); workspaces
 * holding a grant from the owner may read the tree, never change it.
 */
import { sql } from "kysely";
import { audit } from "../audit/audit";
import { withActor, type Actor, type Tx } from "../db/client";
import { HttpError, notFound } from "../policy/policy";
import { requireMemberAction } from "../tenancy/service";
import type { Control } from "./boundary";

export type EntityType = "listed" | "bank" | "bank_tmsf" | "nonbank_fi" | "insurer" | "capital_markets_fi" | "precious_metals" | "unlisted_company" | "public_body";
export type FacilityKind = "plant" | "office" | "warehouse" | "store" | "site" | "mine" | "vessel" | "other";

/** The tenant whose tree is changed: the acting tenant, or a provisional client the actor's tenant stewards. */
export async function ownerFor(tx: Tx, actor: Actor, ownerTenantId?: string): Promise<string> {
  await requireMemberAction(tx, actor, "org.manage");
  const owner = ownerTenantId ?? actor.actingTenantId!;
  if (owner === actor.actingTenantId) return owner;
  const s = await tx.selectFrom("core.tenants").select("id").where("id", "=", owner).where("lifecycle", "=", "provisional").where("steward_tenant_id", "=", actor.actingTenantId).executeTakeFirst();
  if (!s) throw notFound("tenant_not_found");
  return owner;
}

const pgError = (e: unknown): never => {
  const code = (e as { code?: string; constraint?: string })?.code;
  if (code === "23P01") throw new HttpError(409, "ownership_overlap");
  if (code === "23505" && String((e as { constraint?: string }).constraint ?? "").includes("one_parent")) throw new HttpError(409, "parent_exists");
  if (code === "23514") throw new HttpError(422, "invalid_input");
  if (code === "23503") throw new HttpError(404, "not_found");
  throw e;
};

export async function createOrganization(actor: Actor, input: { name: string; countryCode?: string; sectorCode?: string | null; fiscalYearStartMonth?: number; ownerTenantId?: string }): Promise<string> {
  return withActor(actor, async (tx) => {
    const owner = await ownerFor(tx, actor, input.ownerTenantId);
    const r = await tx
      .insertInto("core.organizations")
      .values({ owner_tenant_id: owner, name: input.name.trim(), country_code: input.countryCode ?? "TR", sector_code: input.sectorCode ?? null, fiscal_year_start_month: input.fiscalYearStartMonth ?? 1, created_by: actor.userId })
      .returning("id")
      .executeTakeFirstOrThrow()
      .catch(pgError);
    await audit(tx, actor, { action: "org.create", objectType: "organization", objectId: r.id, ownerTenantId: owner, after: input });
    return r.id;
  });
}

export async function createLegalEntity(
  actor: Actor,
  input: { organizationId: string; name: string; countryCode?: string; taxId?: string | null; tradeRegistryNo?: string | null; entityType?: EntityType; isReportingParent?: boolean; validFrom?: string | null; validTo?: string | null },
): Promise<string> {
  return withActor(actor, async (tx) => {
    const org = await tx.selectFrom("core.organizations").select(["owner_tenant_id"]).where("id", "=", input.organizationId).executeTakeFirst();
    if (!org) throw notFound("organization_not_found");
    const owner = await ownerFor(tx, actor, org.owner_tenant_id);
    const r = await tx
      .insertInto("core.legal_entities")
      .values({
        owner_tenant_id: owner,
        organization_id: input.organizationId,
        name: input.name.trim(),
        country_code: input.countryCode ?? "TR",
        tax_id: input.taxId ?? null,
        trade_registry_no: input.tradeRegistryNo ?? null,
        entity_type: input.entityType ?? "unlisted_company",
        is_reporting_parent: input.isReportingParent ?? false,
        valid_from: input.validFrom ?? null,
        valid_to: input.validTo ?? null,
        created_by: actor.userId,
      })
      .returning("id")
      .executeTakeFirstOrThrow()
      .catch(pgError);
    await audit(tx, actor, { action: "org.entity_create", objectType: "legal_entity", objectId: r.id, ownerTenantId: owner, after: input });
    return r.id;
  });
}

export async function updateLegalEntity(actor: Actor, id: string, patch: { name?: string; taxId?: string | null; entityType?: EntityType; isReportingParent?: boolean; validFrom?: string | null; validTo?: string | null }, expectedVersion?: number): Promise<number> {
  return withActor(actor, async (tx) => {
    const cur = await tx.selectFrom("core.legal_entities").selectAll().where("id", "=", id).forUpdate().executeTakeFirst();
    if (!cur) throw notFound();
    await ownerFor(tx, actor, cur.owner_tenant_id);
    if (expectedVersion !== undefined && cur.row_version !== expectedVersion) throw new HttpError(409, "version_conflict");
    const r = await tx
      .updateTable("core.legal_entities")
      .set({
        ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
        ...(patch.taxId !== undefined ? { tax_id: patch.taxId } : {}),
        ...(patch.entityType !== undefined ? { entity_type: patch.entityType } : {}),
        ...(patch.isReportingParent !== undefined ? { is_reporting_parent: patch.isReportingParent } : {}),
        ...(patch.validFrom !== undefined ? { valid_from: patch.validFrom } : {}),
        ...(patch.validTo !== undefined ? { valid_to: patch.validTo } : {}),
      })
      .where("id", "=", id)
      .returning("row_version")
      .executeTakeFirstOrThrow()
      .catch(pgError);
    await audit(tx, actor, { action: "org.entity_update", objectType: "legal_entity", objectId: id, ownerTenantId: cur.owner_tenant_id, before: cur, after: patch });
    return r.row_version;
  });
}

/**
 * Records an ownership/control relation for a period. The database refuses overlapping periods for the same pair;
 * here we refuse loops (A owns B owns A) and more than 100 % of a child held at any date.
 */
export async function addOwnershipEdge(actor: Actor, input: { parentEntityId: string; childEntityId: string; sharePct: number; control: Control; validFrom: string; validTo?: string | null; sourceNote?: string | null }): Promise<string> {
  if (!(input.sharePct > 0 && input.sharePct <= 100)) throw new HttpError(422, "invalid_share");
  return withActor(actor, async (tx) => {
    const ents = await tx.selectFrom("core.legal_entities").select(["id", "owner_tenant_id"]).where("id", "in", [input.parentEntityId, input.childEntityId]).execute();
    if (ents.length !== 2 || ents[0].owner_tenant_id !== ents[1].owner_tenant_id) throw notFound("entity_not_found");
    const owner = await ownerFor(tx, actor, ents[0].owner_tenant_id);
    const to = input.validTo ?? "infinity";
    // overlapping edges of the same tenant during the new edge's period
    const overlapping = await sql<{ parent_entity_id: string; child_entity_id: string; share_pct: string }>`
      select parent_entity_id, child_entity_id, share_pct from core.ownership_edges
      where owner_tenant_id = ${owner} and daterange(valid_from, coalesce(valid_to, 'infinity'::date), '[]') && daterange(${input.validFrom}::date, ${to}::date, '[]')`.execute(tx);
    const deps = new Map<string, string[]>();
    for (const e of overlapping.rows) deps.set(e.parent_entity_id, [...(deps.get(e.parent_entity_id) ?? []), e.child_entity_id]);
    // a loop: the new child already (directly or indirectly) owns the new parent
    const stack = [input.childEntityId];
    const seen = new Set<string>();
    while (stack.length) {
      const x = stack.pop()!;
      if (x === input.parentEntityId) throw new HttpError(422, "ownership_cycle");
      if (seen.has(x)) continue;
      seen.add(x);
      stack.push(...(deps.get(x) ?? []));
    }
    const held = overlapping.rows.filter((e) => e.child_entity_id === input.childEntityId && e.parent_entity_id !== input.parentEntityId).reduce((s, e) => s + Number(e.share_pct), 0);
    if (held + input.sharePct > 100 + 1e-9) throw new HttpError(422, "shares_exceed_100");
    const r = await tx
      .insertInto("core.ownership_edges")
      .values({ owner_tenant_id: owner, parent_entity_id: input.parentEntityId, child_entity_id: input.childEntityId, share_pct: String(input.sharePct), control: input.control, valid_from: input.validFrom, valid_to: input.validTo ?? null, source_note: input.sourceNote ?? null, created_by: actor.userId })
      .returning("id")
      .executeTakeFirstOrThrow()
      .catch(pgError);
    await audit(tx, actor, { action: "org.ownership_add", objectType: "ownership_edge", objectId: r.id, ownerTenantId: owner, after: input });
    return r.id;
  });
}

/** Ends an ownership relation on a date (a sale, a merger); the history stays. */
export async function endOwnershipEdge(actor: Actor, edgeId: string, validTo: string): Promise<void> {
  await withActor(actor, async (tx) => {
    const e = await tx.selectFrom("core.ownership_edges").selectAll().where("id", "=", edgeId).forUpdate().executeTakeFirst();
    if (!e) throw notFound();
    await ownerFor(tx, actor, e.owner_tenant_id);
    if (e.valid_to !== null && e.valid_to <= validTo) throw new HttpError(409, "already_ended");
    if (validTo < e.valid_from) throw new HttpError(422, "invalid_date");
    await tx.updateTable("core.ownership_edges").set({ valid_to: validTo }).where("id", "=", edgeId).execute();
    await audit(tx, actor, { action: "org.ownership_end", objectType: "ownership_edge", objectId: edgeId, ownerTenantId: e.owner_tenant_id, before: { validTo: e.valid_to }, after: { validTo } });
  });
}

export async function createFacility(
  actor: Actor,
  input: { legalEntityId: string; name: string; kind?: FacilityKind; countryCode?: string; city?: string | null; naceCode?: string | null; operated?: boolean; cbamInstallation?: boolean; responsibleUserId?: string | null; validFrom?: string | null; validTo?: string | null; legacySiteId?: string | null },
): Promise<string> {
  return withActor(actor, async (tx) => {
    const ent = await tx.selectFrom("core.legal_entities").select("owner_tenant_id").where("id", "=", input.legalEntityId).executeTakeFirst();
    if (!ent) throw notFound("entity_not_found");
    const owner = await ownerFor(tx, actor, ent.owner_tenant_id);
    const r = await tx
      .insertInto("core.facilities")
      .values({
        owner_tenant_id: owner,
        legal_entity_id: input.legalEntityId,
        name: input.name.trim(),
        kind: input.kind ?? "plant",
        country_code: input.countryCode ?? "TR",
        city: input.city ?? null,
        nace_code: input.naceCode ?? null,
        operated: input.operated ?? true,
        cbam_installation: input.cbamInstallation ?? false,
        responsible_user_id: input.responsibleUserId ?? null,
        valid_from: input.validFrom ?? null,
        valid_to: input.validTo ?? null,
        legacy_site_id: input.legacySiteId ?? null,
        created_by: actor.userId,
      })
      .returning("id")
      .executeTakeFirstOrThrow()
      .catch(pgError);
    await audit(tx, actor, { action: "org.facility_create", objectType: "facility", objectId: r.id, ownerTenantId: owner, after: input });
    return r.id;
  });
}

export async function updateFacility(actor: Actor, id: string, patch: { name?: string; kind?: FacilityKind; city?: string | null; operated?: boolean; cbamInstallation?: boolean; responsibleUserId?: string | null; validTo?: string | null }, expectedVersion?: number): Promise<number> {
  return withActor(actor, async (tx) => {
    const cur = await tx.selectFrom("core.facilities").selectAll().where("id", "=", id).forUpdate().executeTakeFirst();
    if (!cur) throw notFound();
    await ownerFor(tx, actor, cur.owner_tenant_id);
    if (expectedVersion !== undefined && cur.row_version !== expectedVersion) throw new HttpError(409, "version_conflict");
    const r = await tx
      .updateTable("core.facilities")
      .set({
        ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
        ...(patch.kind !== undefined ? { kind: patch.kind } : {}),
        ...(patch.city !== undefined ? { city: patch.city } : {}),
        ...(patch.operated !== undefined ? { operated: patch.operated } : {}),
        ...(patch.cbamInstallation !== undefined ? { cbam_installation: patch.cbamInstallation } : {}),
        ...(patch.responsibleUserId !== undefined ? { responsible_user_id: patch.responsibleUserId } : {}),
        ...(patch.validTo !== undefined ? { valid_to: patch.validTo } : {}),
      })
      .where("id", "=", id)
      .returning("row_version")
      .executeTakeFirstOrThrow()
      .catch(pgError);
    await audit(tx, actor, { action: "org.facility_update", objectType: "facility", objectId: id, ownerTenantId: cur.owner_tenant_id, before: cur, after: patch });
    return r.row_version;
  });
}

export type Tree = Awaited<ReturnType<typeof organizationTree>>;

/**
 * The tree of one owner tenant as it stood on `asOf` (entities and facilities alive that day, edges with their
 * periods). Without `ownerTenantId` the acting tenant's own tree; a grant holder passes the customer's id.
 */
export async function organizationTree(actor: Actor, opts: { ownerTenantId?: string; asOf?: string } = {}) {
  return withActor(actor, async (tx) => {
    const owner = opts.ownerTenantId ?? actor.actingTenantId!;
    const orgs = await tx.selectFrom("core.organizations").selectAll().where("owner_tenant_id", "=", owner).orderBy("created_at").execute();
    if (!orgs.length && owner !== actor.actingTenantId) {
      // the tree of another tenant is visible only through membership, stewardship or a grant (RLS); nothing → 404
      const t = await tx.selectFrom("core.tenants").select("id").where("id", "=", owner).executeTakeFirst();
      if (!t) throw notFound("tenant_not_found");
    }
    const entities = await tx.selectFrom("core.legal_entities").selectAll().where("owner_tenant_id", "=", owner).orderBy("is_reporting_parent", "desc").orderBy("name").execute();
    const edges = await tx.selectFrom("core.ownership_edges").selectAll().where("owner_tenant_id", "=", owner).orderBy("valid_from").execute();
    const facilities = await tx.selectFrom("core.facilities").selectAll().where("owner_tenant_id", "=", owner).orderBy("name").execute();
    const asOf = opts.asOf ?? null;
    const alive = (from: string | null, to: string | null) => !asOf || ((!from || from <= asOf) && (!to || to >= asOf));
    return {
      ownerTenantId: owner,
      asOf,
      organizations: orgs,
      entities: entities.map((e) => ({ ...e, alive: alive(e.valid_from, e.valid_to) })),
      edges: edges.map((e) => ({ ...e, alive: alive(e.valid_from, e.valid_to) })),
      facilities: facilities.map((f) => ({ ...f, alive: alive(f.valid_from, f.valid_to) })),
    };
  });
}
