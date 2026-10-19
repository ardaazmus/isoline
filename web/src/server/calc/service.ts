/**
 * Calculation runs, metric facts, quality issues and lineage (G4-02, G4-07, G4-08; plan 09 §4–7).
 *
 * A run reads only accepted observation versions of one cycle inside the approved boundary, resolves the factors
 * for the reporting year, and calls a pure engine. Everything the result depends on is digested: the input
 * snapshot, the factor values (by id and value) and the engine version; the same digests reuse the same run, so a
 * click twice never makes two results. Each result becomes a metric fact revision (validating while a blocker is
 * open, otherwise ready for review). A fact is approved by someone other than the person who ran the calculation,
 * and only after the run's issues are dispositioned: blockers are cleared by fixing the input and running again,
 * warnings may be resolved or accepted as an exception with a reason. `reproduceRun` rebuilds the result from the
 * stored observation versions, factor values and evidence bytes and compares the output digest (G4 gate).
 */
import { createHash } from "node:crypto";
import { sql } from "kysely";
import { importTrialBalance } from "@/lib/spreadsheet";
import type { TrialBalance } from "@/lib/trial-balance";
import { audit, canonicalJson } from "../audit/audit";
import { withActor, type Actor, type Tx } from "../db/client";
import { getObjectBytes } from "../evidence/storage";
import { forbidden, HttpError, notFound } from "../policy/policy";
import { requireProjectAction } from "../tenancy/service";
import { factorDigest, resolveFactors, type Resolution, type ResolvedFactor } from "./factors";
import { computeGhg, ghgTargets, type FacilityIn, type GhgOutput, type Obs, type Warning } from "./ghg-engine";
import { cbamTargets, computeCbam, computeEnvironment, computeEts, computeFinance, computeWorkforce, type FactOut } from "./engines";

/** Engine release; a build may append its commit (ISOLINE_BUILD_SHA) so runs name the exact code that made them. */
export const ENGINE_VERSION = `isoline-calc 2026.10.19${process.env.ISOLINE_BUILD_SHA ? `+${process.env.ISOLINE_BUILD_SHA.slice(0, 12)}` : ""}`;
export const RULE_VERSION = "quality-2026.10.19";

export const RUN_KINDS = ["ghg", "environment", "workforce", "finance", "cbam", "ets"] as const;
export type RunKind = (typeof RUN_KINDS)[number];
export type BoundaryKind = "ghg_operational_control" | "ghg_financial_control" | "ghg_equity_share" | "financial_reporting" | "cbam_facility_product";

/** Data points each run reads. */
export const RUN_METRICS: Record<RunKind, string[]> = {
  ghg: ["ghg_stationary", "ghg_mobile", "ghg_process", "ghg_refrigerants", "ghg_electricity", "ghg_certificates", "ghg_purchases", "ghg_transport", "ghg_travel", "ghg_production", "net_sales"],
  environment: ["env_energy", "env_renewable", "env_water_withdrawal", "env_water_discharge", "env_waste", "net_sales"],
  workforce: ["work_headcount", "work_diversity", "work_training", "ohs_hours", "ohs_incidents"],
  finance: ["net_sales", "tb_export"],
  cbam: ["cbam_goods", "cbam_see"],
  ets: ["ets_emissions"],
};

const GHG_BOUNDARIES: BoundaryKind[] = ["ghg_operational_control", "ghg_financial_control", "ghg_equity_share"];
/** Boundary kinds a run may use; the first is the default. Finance needs none (the trial balance is the entity's). */
export const RUN_BOUNDARIES: Record<RunKind, BoundaryKind[]> = {
  ghg: GHG_BOUNDARIES,
  environment: GHG_BOUNDARIES,
  workforce: GHG_BOUNDARIES,
  finance: ["financial_reporting"],
  cbam: ["cbam_facility_product"],
  ets: ["ghg_operational_control"],
};

/** Rule severity: a blocker keeps the run's facts in "validating"; unknown codes are warnings. */
export const SEVERITY: Record<string, "blocker" | "warning"> = {
  factor_missing: "blocker",
  unknown_fuel: "blocker",
  fuel_unit_unsupported: "blocker",
  certificates_exceed_consumption: "blocker",
  input_not_accepted: "blocker",
  duplicate_input: "blocker",
  tb_year_mismatch: "blocker",
  tb_not_balanced: "blocker",
  renewable_exceeds_energy: "blocker",
  women_exceed_headcount: "blocker",
  value_not_finite: "blocker",
};

/** Year-on-year change that asks for an explanation (headline metrics only). */
export const YOY_TOLERANCE = 0.3;
const YOY_METRICS = new Set(["ghg.scope1", "ghg.scope2.location", "ghg.scope3", "env.energy_gj", "env.water_withdrawal_m3", "env.waste_t", "finance.net_sales", "workforce.headcount"]);
/** Share of estimated data above which the run asks for a disclosure check (TSRS 2 / IFRS S2 measurement uncertainty). */
export const ESTIMATED_SHARE_LIMIT = 0.2;

const sha = (v: unknown) => createHash("sha256").update(typeof v === "string" ? v : canonicalJson(v)).digest("hex");

// ---------------------------------------------------------------- snapshot and evaluation (pure)

export type TbSnapshot = { evidenceId: string; filename: string; sha256: string; uploadedAt: string; parsed: TrialBalance };
export type Snapshot = {
  kind: RunKind;
  year: number;
  boundary: { id: string; kind: BoundaryKind; revision: number } | null;
  facilities: FacilityIn[];
  observations: Obs[];
  tb: TbSnapshot | null;
  /** Requests of the run's data points still open ("id:status") and slots answered twice: part of the input state. */
  pending: string[];
  duplicates: string[];
};

export type Evaluation = { facts: FactOut[]; warnings: Warning[]; used: { observations: string[]; factors: string[] }; result: Record<string, unknown> };

function ghgFacts(o: GhgOutput, snap: Snapshot): FactOut[] {
  const g = o.group;
  const est = g.estimatedShare;
  const f = (metricKey: string, valueNum: number, unit = "tCO2e", facilityId: string | null = null, estimatedShare = est): FactOut => ({ metricKey, facilityId, valueNum, unit, estimatedShare });
  const out: FactOut[] = [
    f("ghg.scope1", g.scope1),
    f("ghg.scope1.stationary", g.scope1Stationary),
    f("ghg.scope1.mobile", g.scope1Mobile),
    f("ghg.scope1.process", g.scope1Process),
    f("ghg.scope1.fugitive", g.scope1Fugitive),
    f("ghg.scope2.location", g.scope2Location),
    f("ghg.scope2.market", g.scope2Market),
    f("ghg.total.location", g.totalLocation),
    f("ghg.total.market", g.totalMarket),
    f("ghg.energy_gj", g.energyGj, "GJ"),
    f("ghg.electricity_mwh", g.electricityMwh, "MWh"),
  ];
  const hasScope3 = snap.observations.some((x) => ["ghg_purchases", "ghg_transport", "ghg_travel"].includes(x.metricCode));
  if (hasScope3) {
    out.push(f("ghg.scope3", g.scope3));
    for (const [cat, v] of Object.entries(o.org.scope3ByCategory)) out.push(f(`ghg.scope3.cat${cat}`, v));
  }
  for (const fr of o.facilities) {
    out.push(f("ghg.scope1", fr.scope1, "tCO2e", fr.facilityId, fr.estimatedShare));
    out.push(f("ghg.scope2.location", fr.scope2Location, "tCO2e", fr.facilityId, fr.estimatedShare));
    out.push(f("ghg.scope2.market", fr.scope2Market, "tCO2e", fr.facilityId, fr.estimatedShare));
  }
  const sales = snap.observations.filter((x) => x.metricCode === "net_sales" && x.facilityId === null).reduce((s, x) => s + Number(x.canonical ?? 0), 0);
  if (sales > 0) out.push(f("ghg.intensity.revenue", (g.scope1 + g.scope2Location) / (sales / 1_000_000), "tCO2e/mTRY"));
  return out;
}

/** The pure part of a run: the same snapshot and factors give the same facts, digests and warnings. */
export function evaluate(snap: Snapshot, factors: Record<string, ResolvedFactor>): Evaluation {
  const scoped = { facilities: snap.facilities, observations: snap.observations };
  let facts: FactOut[];
  let warnings: Warning[];
  let used: Evaluation["used"];
  let result: Record<string, unknown>;
  if (snap.kind === "ghg") {
    const o = computeGhg({ year: snap.year, facilities: snap.facilities, observations: snap.observations, factors });
    facts = ghgFacts(o, snap);
    warnings = o.warnings;
    used = o.used;
    result = { group: o.group, org: o.org, facilities: o.facilities.map(({ raw, ...rest }) => ({ ...rest, raw: { combustionGases: raw.combustionGases, renewableShare: raw.renewableShare, intensityProduct: raw.intensityProduct } })) };
    if (o.group.estimatedShare > ESTIMATED_SHARE_LIMIT) warnings.push({ code: "estimated_share_high", target: "ghg.scope1", detail: { share: o.group.estimatedShare, limit: ESTIMATED_SHARE_LIMIT } });
  } else {
    const r =
      snap.kind === "environment"
        ? computeEnvironment(scoped)
        : snap.kind === "workforce"
          ? computeWorkforce(scoped)
          : snap.kind === "finance"
            ? computeFinance({ ...scoped, year: snap.year, tb: snap.tb ? { evidenceId: snap.tb.evidenceId, filename: snap.tb.filename, sha256: snap.tb.sha256, parsed: snap.tb.parsed } : null })
            : snap.kind === "cbam"
              ? computeCbam({ ...scoped, year: snap.year, factors })
              : computeEts(scoped);
    facts = r.facts;
    warnings = r.warnings;
    used = r.used;
    result = r.detail ?? {};
  }
  for (const f of facts)
    if (f.valueNum !== undefined && !Number.isFinite(f.valueNum)) {
      warnings.push({ code: "value_not_finite", target: f.metricKey });
      f.valueNum = 0;
    }
  facts.sort((a, b) => `${a.metricKey}|${a.facilityId ?? ""}`.localeCompare(`${b.metricKey}|${b.facilityId ?? ""}`));
  return { facts, warnings, used, result: { ...result, facts } };
}

export const outputDigest = (facts: FactOut[]) => sha(facts.map((f) => ({ k: f.metricKey, f: f.facilityId, v: f.valueNum ?? null, t: f.valueText ?? null, u: f.unit, s: f.suppressed ?? false })));
export const inputDigest = (snap: Snapshot) =>
  sha({
    kind: snap.kind,
    year: snap.year,
    boundary: snap.boundary,
    facilities: snap.facilities,
    observations: snap.observations.map((o) => ({ id: o.versionId, m: o.metricCode, f: o.facilityId, v: o.canonical, u: o.canonicalUnit, l: o.lines, q: o.quality })),
    tb: snap.tb?.sha256 ?? null,
    pending: snap.pending,
    duplicates: snap.duplicates,
  });

// ---------------------------------------------------------------- loading a snapshot

type Pending = { requestId: string; metric: string; facilityId: string | null; status: string };

async function loadSnapshot(tx: Tx, cycle: { id: string; owner_tenant_id: string; reporting_year: number }, kind: RunKind, boundaryKind: BoundaryKind | null): Promise<{ snap: Snapshot; pending: Pending[]; duplicates: string[]; evidenceIds: string[] }> {
  let boundary: Snapshot["boundary"] = null;
  const pct = new Map<string, number>();
  if (boundaryKind) {
    const b = await tx.selectFrom("core.reporting_boundaries").select(["id", "kind", "revision"]).where("cycle_id", "=", cycle.id).where("kind", "=", boundaryKind).where("status", "=", "approved").executeTakeFirst();
    if (!b) throw new HttpError(422, "boundary_not_approved");
    boundary = { id: b.id, kind: b.kind as BoundaryKind, revision: b.revision };
    for (const m of await tx.selectFrom("core.boundary_members").select(["facility_id", "inclusion_pct"]).where("boundary_id", "=", b.id).where("facility_id", "is not", null).execute()) pct.set(m.facility_id!, Number(m.inclusion_pct));
  }
  const facRows = pct.size ? await tx.selectFrom("core.facilities").select(["id", "grid_connection", "country_code"]).where("owner_tenant_id", "=", cycle.owner_tenant_id).where("id", "in", [...pct.keys()]).execute() : [];
  const facilities: FacilityIn[] = facRows.map((f) => ({ id: f.id, pct: pct.get(f.id) ?? 0, connection: f.grid_connection as FacilityIn["connection"], country: f.country_code })).sort((a, b) => a.id.localeCompare(b.id));
  const inBoundary = (facilityId: string | null) => facilityId === null || (pct.get(facilityId) ?? 0) > 0;

  const requests = await tx.selectFrom("core.data_requests").select(["id", "metric_code", "facility_id", "status"]).where("cycle_id", "=", cycle.id).where("metric_code", "in", RUN_METRICS[kind]).execute();
  const pending = requests.filter((r) => !["accepted", "withdrawn", "not_applicable"].includes(r.status) && inBoundary(r.facility_id)).map((r) => ({ requestId: r.id, metric: r.metric_code, facilityId: r.facility_id, status: r.status }));
  const accepted = requests.filter((r) => r.status === "accepted" && inBoundary(r.facility_id));
  const versions = accepted.length
    ? await tx
        .selectFrom("core.observation_versions")
        .select(["id", "request_id", "revision", "canonical_value", "canonical_unit", "lines", "quality", "decided_at"])
        .where("request_id", "in", accepted.map((r) => r.id))
        .where("status", "=", "accepted")
        .execute()
    : [];
  // one accepted version per request (the highest revision); two requests for the same slot would double count
  const latest = new Map<string, (typeof versions)[number]>();
  for (const v of versions) if (!latest.has(v.request_id) || latest.get(v.request_id)!.revision < v.revision) latest.set(v.request_id, v);
  const bySlot = new Map<string, { req: (typeof accepted)[number]; v: (typeof versions)[number] }[]>();
  for (const r of accepted) {
    const v = latest.get(r.id);
    if (!v) continue;
    const k = `${r.metric_code}|${r.facility_id ?? ""}`;
    bySlot.set(k, [...(bySlot.get(k) ?? []), { req: r, v }]);
  }
  const duplicates: string[] = [];
  const observations: Obs[] = [];
  for (const [slot, list] of bySlot) {
    list.sort((a, b) => (b.v.decided_at?.getTime() ?? 0) - (a.v.decided_at?.getTime() ?? 0));
    if (list.length > 1) duplicates.push(slot);
    const { req, v } = list[0];
    if (req.metric_code === "tb_export") continue; // a file, read below
    observations.push({ versionId: v.id, metricCode: req.metric_code, facilityId: req.facility_id, canonical: v.canonical_value, canonicalUnit: v.canonical_unit, lines: (v.lines as Obs["lines"]) ?? null, quality: v.quality as Obs["quality"] });
  }
  observations.sort((a, b) => a.versionId.localeCompare(b.versionId));

  const usedRequests = accepted.map((r) => r.id);
  const evidence = usedRequests.length
    ? await tx
        .selectFrom("core.evidence_links as l")
        .innerJoin("core.evidence_objects as e", "e.id", "l.evidence_id")
        .innerJoin("core.data_requests as r", "r.id", "l.target_id")
        .select(["e.id", "e.filename", "e.sha256", "e.storage_key", "e.scan_status", "e.uploaded_at", "r.metric_code"])
        .where("l.target_type", "=", "data_request")
        .where("l.target_id", "in", usedRequests)
        .where("l.unlinked_at", "is", null)
        .execute()
    : [];
  let tb: TbSnapshot | null = null;
  if (kind === "finance") {
    const files = evidence.filter((e) => e.metric_code === "tb_export" && e.scan_status === "available").sort((a, b) => b.uploaded_at.getTime() - a.uploaded_at.getTime());
    if (files[0]) tb = await readTrialBalance(files[0]);
  }
  duplicates.sort();
  return {
    snap: { kind, year: cycle.reporting_year, boundary, facilities, observations, tb, pending: pending.map((p) => `${p.requestId}:${p.status}`).sort(), duplicates },
    pending,
    duplicates,
    // every linked file except quarantined or rejected ones: one still being scanned is part of the source all the same
    evidenceIds: [...new Set(evidence.filter((e) => e.scan_status !== "quarantined" && e.scan_status !== "rejected").map((e) => e.id))].sort(),
  };
}

async function readTrialBalance(e: { id: string; filename: string; sha256: string; storage_key: string; uploaded_at: Date }): Promise<TbSnapshot | null> {
  const bytes = await getObjectBytes(e.storage_key);
  if (createHash("sha256").update(bytes).digest("hex") !== e.sha256) throw new HttpError(409, "evidence_digest_mismatch");
  const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const { tb } = await importTrialBalance(buf, e.filename, e.uploaded_at);
  return tb ? { evidenceId: e.id, filename: e.filename, sha256: e.sha256, uploadedAt: e.uploaded_at.toISOString(), parsed: tb } : null;
}

function targetsFor(snap: Snapshot): string[] {
  if (snap.kind === "ghg") return ghgTargets(snap.facilities, snap.observations);
  if (snap.kind === "cbam") return cbamTargets(snap);
  return [];
}

// ---------------------------------------------------------------- running

export type RunResult = { runId: string; reused: boolean; facts: number; blockers: number; warnings: number };

export const ISSUE_TARGET = (w: Warning): { type: "run" | "factor" | "data_request" | "observation_version"; id: string } => {
  if (w.code.startsWith("factor_") || w.code.startsWith("cbam_other")) return { type: "factor", id: w.target };
  if (w.code === "input_not_accepted") return { type: "data_request", id: w.target };
  return { type: "run", id: w.target };
};

export async function runCalculation(actor: Actor, cycleId: string, input: { kind: RunKind; boundaryKind?: BoundaryKind | null; mode?: "preview" | "final" }): Promise<RunResult> {
  const mode = input.mode ?? "final";
  return withActor(actor, async (tx) => {
    const cycle = await tx.selectFrom("core.reporting_cycles").select(["id", "project_id", "owner_tenant_id", "reporting_year", "status"]).where("id", "=", cycleId).executeTakeFirst();
    if (!cycle) throw notFound("cycle_not_found");
    await requireProjectAction(tx, actor, cycle.project_id, "calc.run");
    if (["frozen", "released"].includes(cycle.status)) throw new HttpError(409, "cycle_frozen");
    const allowed = RUN_BOUNDARIES[input.kind];
    const boundaryKind = input.kind === "finance" ? null : (input.boundaryKind ?? allowed[0]);
    if (boundaryKind && !allowed.includes(boundaryKind)) throw new HttpError(422, "boundary_kind_not_allowed");

    const { snap, pending, duplicates, evidenceIds } = await loadSnapshot(tx, cycle, input.kind, boundaryKind);
    const resolution: Resolution = await resolveFactors(tx, cycle.project_id, cycle.reporting_year, targetsFor(snap));
    const ev = evaluate(snap, resolution.factors);
    const warnings: Warning[] = [
      ...resolution.warnings.filter((w) => w.code !== "factor_missing").map((w) => ({ code: w.code, target: w.target, detail: w.detail })),
      ...ev.warnings,
      ...pending.map((p) => ({ code: "input_not_accepted", target: p.requestId, detail: { metric: p.metric, facilityId: p.facilityId, status: p.status } })),
      ...duplicates.map((d) => ({ code: "duplicate_input", target: d })),
    ];
    const fDigest = factorDigest(resolution);
    const iDigest = inputDigest(snap);
    const oDigest = outputDigest(ev.facts);

    const existing = await tx
      .selectFrom("core.calculation_runs")
      .select("id")
      .where("project_id", "=", cycle.project_id)
      .where("kind", "=", input.kind)
      .where(sql<boolean>`coalesce(boundary_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(${snap.boundary?.id ?? null}::uuid, '00000000-0000-0000-0000-000000000000'::uuid)`)
      .where("input_digest", "=", iDigest)
      .where("engine_version", "=", ENGINE_VERSION)
      .where("factor_digest", "=", fDigest)
      .where("mode", "=", mode)
      .executeTakeFirst();
    if (existing) {
      const counts = await issueCounts(tx, existing.id);
      const facts = await tx.selectFrom("core.metric_fact_versions").select(sql<number>`count(*)::int`.as("n")).where("run_id", "=", existing.id).executeTakeFirstOrThrow();
      return { runId: existing.id, reused: true, facts: facts.n, ...counts };
    }

    const run = await tx
      .insertInto("core.calculation_runs")
      .values({
        owner_tenant_id: cycle.owner_tenant_id,
        project_id: cycle.project_id,
        cycle_id: cycle.id,
        boundary_id: snap.boundary?.id ?? null,
        kind: input.kind,
        mode,
        engine_version: ENGINE_VERSION,
        rule_version: RULE_VERSION,
        factor_digest: fDigest,
        input_digest: iDigest,
        output_digest: oDigest,
        inputs: JSON.stringify({ ...snap, tb: snap.tb ? { evidenceId: snap.tb.evidenceId, filename: snap.tb.filename, sha256: snap.tb.sha256, uploadedAt: snap.tb.uploadedAt } : null, pendingDetail: pending }),
        factors: JSON.stringify(resolution),
        result: JSON.stringify({ ...ev.result, warnings }),
        performed_by: actor.userId,
      })
      .returning("id")
      .executeTakeFirstOrThrow();

    // lineage rows: the observation versions, evidence files and factor values the result depends on
    const base = { run_id: run.id, owner_tenant_id: cycle.owner_tenant_id, project_id: cycle.project_id };
    const rows = [
      ...ev.used.observations.map((id) => ({ ...base, observation_version_id: id, role: "observation" })),
      ...(snap.tb ? [{ ...base, evidence_id: snap.tb.evidenceId, role: "evidence" }] : []),
      ...evidenceIds.filter((id) => id !== snap.tb?.evidenceId).map((id) => ({ ...base, evidence_id: id, role: "evidence" })),
      ...[...new Set(ev.used.factors.map((t) => resolution.factors[t]?.valueId).filter(Boolean))].map((id) => ({ ...base, factor_value_id: id as string, role: "factor" })),
    ];
    if (rows.length) await tx.insertInto("core.run_inputs").values(rows).execute();

    let blockers = 0;
    let warningsN = 0;
    if (mode === "final") {
      await supersedeOpenIssues(tx, cycle.id, input.kind);
      const counts = await recordIssues(tx, actor, { id: run.id, owner: cycle.owner_tenant_id, project: cycle.project_id, cycle: cycle.id, boundaryKind }, warnings);
      blockers = counts.blockers;
      warningsN = counts.warnings;
      const written = await writeFacts(tx, { id: run.id, owner: cycle.owner_tenant_id, project: cycle.project_id, cycle: cycle.id, boundaryKind }, ev.facts, blockers > 0);
      warningsN += await yoyIssues(tx, actor, { id: run.id, owner: cycle.owner_tenant_id, project: cycle.project_id, cycle: cycle.id, year: cycle.reporting_year, boundaryKind }, written);
      if (cycle.status === "collection" || cycle.status === "planning") await tx.updateTable("core.reporting_cycles").set({ status: "calculation" }).where("id", "=", cycle.id).execute();
    }
    await audit(tx, actor, { action: "calc.run", objectType: "calculation_run", objectId: run.id, ownerTenantId: cycle.owner_tenant_id, projectId: cycle.project_id, after: { kind: input.kind, mode, boundary: snap.boundary, inputDigest: iDigest, factorDigest: fDigest, outputDigest: oDigest, engine: ENGINE_VERSION, facts: ev.facts.length, blockers, warnings: warningsN } });
    return { runId: run.id, reused: false, facts: mode === "final" ? ev.facts.length : 0, blockers, warnings: warningsN };
  });
}

export async function issueCounts(tx: Tx, runId: string) {
  const r = await tx
    .selectFrom("core.quality_issues")
    .select([sql<number>`count(*) filter (where severity = 'blocker')::int`.as("blockers"), sql<number>`count(*) filter (where severity = 'warning')::int`.as("warnings")])
    .where("run_id", "=", runId)
    .executeTakeFirstOrThrow();
  return { blockers: r.blockers, warnings: r.warnings };
}

export type RunRef = { id: string; owner: string; project: string; cycle: string; boundaryKind: BoundaryKind | null };

/** Open findings of earlier final runs of this kind in the cycle give way to the new run's findings. */
export async function supersedeOpenIssues(tx: Tx, cycleId: string, kind: string): Promise<void> {
  await tx
    .updateTable("core.quality_issues")
    .set({ status: "superseded" })
    .where("cycle_id", "=", cycleId)
    .where("status", "=", "open")
    .where("run_id", "in", (eb) => eb.selectFrom("core.calculation_runs").select("id").where("cycle_id", "=", cycleId).where("kind", "=", kind).where("mode", "=", "final"))
    .execute();
}

/** Writes a run's findings with their severity (SEVERITY table, else the given default); returns the counts. */
export async function recordIssues(tx: Tx, actor: Actor, run: RunRef, warnings: (Warning & { severity?: "blocker" | "warning"; expected?: Record<string, unknown>; tolerance?: string })[]): Promise<{ blockers: number; warnings: number }> {
  let blockers = 0;
  let warningsN = 0;
  for (const w of warnings) {
    const sev = w.severity ?? SEVERITY[w.code] ?? "warning";
    if (sev === "blocker") blockers++;
    else warningsN++;
    const t = ISSUE_TARGET(w);
    await tx
      .insertInto("core.quality_issues")
      .values({ owner_tenant_id: run.owner, project_id: run.project, cycle_id: run.cycle, run_id: run.id, rule_id: w.code, rule_version: RULE_VERSION, severity: sev, target_type: t.type, target_id: t.id, observed: w.detail ? JSON.stringify(w.detail) : null, expected: w.expected ? JSON.stringify(w.expected) : null, tolerance: w.tolerance ?? null, detected_by: actor.userId })
      .execute();
  }
  return { blockers, warnings: warningsN };
}

export async function writeFacts(tx: Tx, run: RunRef, facts: FactOut[], blocked: boolean): Promise<{ id: string; metricKey: string; facilityId: string | null; value: number | null }[]> {
  const out: { id: string; metricKey: string; facilityId: string | null; value: number | null }[] = [];
  for (const f of facts) {
    const prev = await tx
      .selectFrom("core.metric_fact_versions")
      .select(["id", "revision", "status"])
      .where("cycle_id", "=", run.cycle)
      .where("metric_key", "=", f.metricKey)
      .where((eb) => (f.facilityId ? eb("facility_id", "=", f.facilityId) : eb("facility_id", "is", null)))
      .where((eb) => (run.boundaryKind ? eb("boundary_kind", "=", run.boundaryKind) : eb("boundary_kind", "is", null)))
      .orderBy("revision", "desc")
      .executeTakeFirst();
    // drafts of earlier runs give way; an approved revision stays in force until the new one is approved
    await tx
      .updateTable("core.metric_fact_versions")
      .set({ status: "superseded" })
      .where("cycle_id", "=", run.cycle)
      .where("metric_key", "=", f.metricKey)
      .where((eb) => (f.facilityId ? eb("facility_id", "=", f.facilityId) : eb("facility_id", "is", null)))
      .where((eb) => (run.boundaryKind ? eb("boundary_kind", "=", run.boundaryKind) : eb("boundary_kind", "is", null)))
      .where("status", "in", ["validating", "ready_for_review"])
      .execute();
    const row = await tx
      .insertInto("core.metric_fact_versions")
      .values({
        owner_tenant_id: run.owner,
        project_id: run.project,
        cycle_id: run.cycle,
        metric_key: f.metricKey,
        facility_id: f.facilityId,
        boundary_kind: run.boundaryKind,
        revision: (prev?.revision ?? 0) + 1,
        value_num: f.valueExact ?? (f.valueNum === undefined ? null : String(f.valueNum)),
        value_text: f.valueExact === undefined && f.valueNum === undefined ? (f.valueText ?? "") : null,
        unit: f.unit,
        run_id: run.id,
        status: blocked ? "validating" : "ready_for_review",
        estimated_share: f.estimatedShare === undefined ? null : String(Math.min(1, Math.max(0, f.estimatedShare))),
        suppressed: f.suppressed ?? false,
        supersedes_id: prev?.id ?? null,
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    out.push({ id: row.id, metricKey: f.metricKey, facilityId: f.facilityId, value: f.valueExact !== undefined ? Number(f.valueExact) : (f.valueNum ?? null) });
  }
  return out;
}

/** Headline facts that moved more than 30 % against the previous year's approved figure ask for an explanation. */
async function yoyIssues(tx: Tx, actor: Actor, run: RunRef & { year: number }, written: { id: string; metricKey: string; facilityId: string | null; value: number | null }[]): Promise<number> {
  const prevCycle = await tx.selectFrom("core.reporting_cycles").select("id").where("project_id", "=", run.project).where("reporting_year", "=", run.year - 1).executeTakeFirst();
  if (!prevCycle) return 0;
  let n = 0;
  for (const w of written.filter((x) => x.facilityId === null && x.value !== null && YOY_METRICS.has(x.metricKey))) {
    const p = await tx
      .selectFrom("core.metric_fact_versions")
      .select(["id", "value_num"])
      .where("cycle_id", "=", prevCycle.id)
      .where("metric_key", "=", w.metricKey)
      .where("facility_id", "is", null)
      .where((eb) => (run.boundaryKind ? eb("boundary_kind", "=", run.boundaryKind) : eb("boundary_kind", "is", null)))
      .where("status", "in", ["approved", "locked"])
      .orderBy("revision", "desc")
      .executeTakeFirst();
    if (!p || p.value_num === null) continue;
    const prev = Number(p.value_num);
    if (prev === 0) continue;
    const change = (w.value! - prev) / Math.abs(prev);
    if (Math.abs(change) <= YOY_TOLERANCE) continue;
    n++;
    await tx
      .insertInto("core.quality_issues")
      .values({ owner_tenant_id: run.owner, project_id: run.project, cycle_id: run.cycle, run_id: run.id, rule_id: "yoy_change", rule_version: RULE_VERSION, severity: "warning", target_type: "fact", target_id: w.id, observed: JSON.stringify({ metric: w.metricKey, current: w.value, previous: prev, previousFact: p.id, change }), expected: JSON.stringify({ maxChange: YOY_TOLERANCE }), tolerance: "30%", detected_by: actor.userId })
      .execute();
  }
  return n;
}

// ---------------------------------------------------------------- review

async function factForReview(tx: Tx, actor: Actor, factId: string) {
  const f = await tx
    .selectFrom("core.metric_fact_versions as f")
    .innerJoin("core.calculation_runs as r", "r.id", "f.run_id")
    .innerJoin("core.reporting_cycles as c", "c.id", "f.cycle_id")
    .select(["f.id", "f.owner_tenant_id", "f.project_id", "f.cycle_id", "f.metric_key", "f.facility_id", "f.boundary_kind", "f.status", "f.run_id", "f.revision", "f.value_num", "f.value_text", "r.performed_by", "c.status as cycle_status"])
    .where("f.id", "=", factId)
    .forUpdate()
    .executeTakeFirst();
  if (!f) throw notFound();
  await requireProjectAction(tx, actor, f.project_id, "quality.review");
  if (["frozen", "released"].includes(f.cycle_status)) throw new HttpError(409, "cycle_frozen");
  return f;
}

async function approveOne(tx: Tx, actor: Actor, f: Awaited<ReturnType<typeof factForReview>>) {
  if (f.status !== "ready_for_review") throw new HttpError(409, "invalid_transition");
  if (f.performed_by === actor.userId) throw forbidden("own_calculation");
  const open = await tx.selectFrom("core.quality_issues").select(sql<number>`count(*)::int`.as("n")).where("run_id", "=", f.run_id).where("status", "=", "open").executeTakeFirstOrThrow();
  if (open.n > 0) throw new HttpError(409, "open_issues");
  await tx
    .updateTable("core.metric_fact_versions")
    .set({ status: "superseded" })
    .where("cycle_id", "=", f.cycle_id)
    .where("metric_key", "=", f.metric_key)
    .where((eb) => (f.facility_id ? eb("facility_id", "=", f.facility_id) : eb("facility_id", "is", null)))
    .where((eb) => (f.boundary_kind ? eb("boundary_kind", "=", f.boundary_kind) : eb("boundary_kind", "is", null)))
    .where("status", "=", "approved")
    .execute();
  await tx.updateTable("core.metric_fact_versions").set({ status: "approved", approved_by: actor.userId, approved_at: new Date() }).where("id", "=", f.id).execute();
  await audit(tx, actor, { action: "fact.approve", objectType: "metric_fact", objectId: f.id, ownerTenantId: f.owner_tenant_id, projectId: f.project_id, after: { metric: f.metric_key, facility: f.facility_id, revision: f.revision, value: f.value_num ?? f.value_text, run: f.run_id } });
}

/** Approves one fact (four-eyes: never the person who ran the calculation; the run's issues dispositioned). */
export async function approveFact(actor: Actor, factId: string): Promise<void> {
  await withActor(actor, async (tx) => approveOne(tx, actor, await factForReview(tx, actor, factId)));
}

/** Approves every fact of a run that is ready for review. */
export async function approveRun(actor: Actor, runId: string): Promise<{ approved: number }> {
  return withActor(actor, async (tx) => {
    const ids = await tx.selectFrom("core.metric_fact_versions").select("id").where("run_id", "=", runId).where("status", "=", "ready_for_review").execute();
    const run = await tx.selectFrom("core.calculation_runs").select(["id", "project_id"]).where("id", "=", runId).executeTakeFirst();
    if (!run) throw notFound();
    await requireProjectAction(tx, actor, run.project_id, "quality.review");
    if (!ids.length) throw new HttpError(409, "nothing_to_approve");
    for (const { id } of ids) await approveOne(tx, actor, await factForReview(tx, actor, id));
    return { approved: ids.length };
  });
}

export async function rejectFact(actor: Actor, factId: string, reason: string): Promise<void> {
  if (reason.trim().length < 10) throw new HttpError(422, "reason_required");
  await withActor(actor, async (tx) => {
    const f = await factForReview(tx, actor, factId);
    if (!["ready_for_review", "validating"].includes(f.status)) throw new HttpError(409, "invalid_transition");
    await tx.updateTable("core.metric_fact_versions").set({ status: "rejected" }).where("id", "=", f.id).execute();
    await audit(tx, actor, { action: "fact.reject", objectType: "metric_fact", objectId: f.id, ownerTenantId: f.owner_tenant_id, projectId: f.project_id, after: { reason: reason.trim(), metric: f.metric_key, revision: f.revision } });
  });
}

/**
 * Disposition of a warning by a reviewer other than the person who ran the calculation: "resolved" (explained,
 * not an error) or "accepted_exception" (a known deviation to disclose). Blockers clear only by a new run.
 */
export async function resolveIssue(actor: Actor, issueId: string, input: { decision: "resolved" | "accepted_exception"; resolution: string }): Promise<void> {
  const text = input.resolution.trim();
  if (text.length < 10) throw new HttpError(422, "reason_required");
  await withActor(actor, async (tx) => {
    const i = await tx.selectFrom("core.quality_issues").selectAll().where("id", "=", issueId).forUpdate().executeTakeFirst();
    if (!i) throw notFound();
    await requireProjectAction(tx, actor, i.project_id, "quality.review");
    if (i.status !== "open") throw new HttpError(409, "invalid_transition");
    const c = await tx.selectFrom("core.reporting_cycles").select("status").where("id", "=", i.cycle_id).executeTakeFirstOrThrow();
    if (["frozen", "released"].includes(c.status)) throw new HttpError(409, "cycle_frozen");
    if (i.severity === "blocker") throw new HttpError(409, "blocker_requires_rerun");
    if (i.detected_by === actor.userId) throw forbidden("own_calculation");
    await tx.updateTable("core.quality_issues").set({ status: input.decision, resolution: text, resolved_by: actor.userId, resolved_at: new Date() }).where("id", "=", issueId).execute();
    await audit(tx, actor, { action: "quality.resolve", objectType: "quality_issue", objectId: issueId, ownerTenantId: i.owner_tenant_id, projectId: i.project_id, after: { rule: i.rule_id, decision: input.decision, resolution: text } });
  });
}

// ---------------------------------------------------------------- reading

export async function listRuns(actor: Actor, projectId: string, cycleId?: string | null) {
  return withActor(actor, async (tx) => {
    await requireProjectAction(tx, actor, projectId, "project.read");
    let q = tx
      .selectFrom("core.calculation_runs as r")
      .leftJoin("user as u", "u.id", "r.performed_by")
      .select([
        "r.id",
        "r.cycle_id",
        "r.kind",
        "r.mode",
        "r.engine_version",
        "r.rule_version",
        "r.input_digest",
        "r.factor_digest",
        "r.output_digest",
        "r.performed_at",
        "r.boundary_id",
        "u.name as performed_by_name",
        sql<number>`(select count(*)::int from core.metric_fact_versions f where f.run_id = r.id)`.as("facts"),
        sql<number>`(select count(*)::int from core.quality_issues i where i.run_id = r.id and i.status = 'open' and i.severity = 'blocker')`.as("open_blockers"),
        sql<number>`(select count(*)::int from core.quality_issues i where i.run_id = r.id and i.status = 'open' and i.severity = 'warning')`.as("open_warnings"),
      ])
      .where("r.project_id", "=", projectId);
    if (cycleId) q = q.where("r.cycle_id", "=", cycleId);
    return q.orderBy("r.performed_at", "desc").limit(100).execute();
  });
}

export async function getRun(actor: Actor, runId: string) {
  return withActor(actor, async (tx) => {
    const run = await tx.selectFrom("core.calculation_runs as r").leftJoin("user as u", "u.id", "r.performed_by").selectAll("r").select("u.name as performed_by_name").where("r.id", "=", runId).executeTakeFirst();
    if (!run) throw notFound();
    await requireProjectAction(tx, actor, run.project_id, "project.read");
    const facts = await tx
      .selectFrom("core.metric_fact_versions as f")
      .leftJoin("core.facilities as fa", "fa.id", "f.facility_id")
      .leftJoin("user as a", "a.id", "f.approved_by")
      .select(["f.id", "f.metric_key", "f.facility_id", "fa.name as facility_name", "f.revision", "f.value_num", "f.value_text", "f.unit", "f.status", "f.estimated_share", "f.suppressed", "f.approved_at", "a.name as approved_by_name"])
      .where("f.run_id", "=", runId)
      .orderBy("f.metric_key")
      .orderBy("fa.name")
      .execute();
    const issues = await tx.selectFrom("core.quality_issues as i").leftJoin("user as u", "u.id", "i.resolved_by").selectAll("i").select("u.name as resolved_by_name").where("i.run_id", "=", runId).orderBy("i.severity").orderBy("i.created_at").execute();
    return { run, facts, issues };
  });
}

/** Current facts of a cycle: the newest revision per metric key, facility and boundary kind (superseded ones hidden). */
export async function listFacts(actor: Actor, cycleId: string) {
  return withActor(actor, async (tx) => {
    const c = await tx.selectFrom("core.reporting_cycles").select(["project_id"]).where("id", "=", cycleId).executeTakeFirst();
    if (!c) throw notFound("cycle_not_found");
    await requireProjectAction(tx, actor, c.project_id, "project.read");
    return tx
      .selectFrom("core.metric_fact_versions as f")
      .leftJoin("core.facilities as fa", "fa.id", "f.facility_id")
      .select(["f.id", "f.metric_key", "f.facility_id", "fa.name as facility_name", "f.boundary_kind", "f.revision", "f.value_num", "f.value_text", "f.unit", "f.status", "f.estimated_share", "f.suppressed", "f.run_id", "f.created_at"])
      .where("f.cycle_id", "=", cycleId)
      .where("f.status", "not in", ["superseded"])
      .orderBy("f.metric_key")
      .orderBy("f.facility_id")
      .orderBy("f.revision", "desc")
      .execute();
  });
}

export async function listIssues(actor: Actor, cycleId: string, status: "open" | "all" = "open") {
  return withActor(actor, async (tx) => {
    const c = await tx.selectFrom("core.reporting_cycles").select(["project_id"]).where("id", "=", cycleId).executeTakeFirst();
    if (!c) throw notFound("cycle_not_found");
    await requireProjectAction(tx, actor, c.project_id, "project.read");
    let q = tx.selectFrom("core.quality_issues as i").leftJoin("core.calculation_runs as r", "r.id", "i.run_id").leftJoin("user as u", "u.id", "i.resolved_by").selectAll("i").select(["r.kind as run_kind", "u.name as resolved_by_name"]).where("i.cycle_id", "=", cycleId);
    if (status === "open") q = q.where("i.status", "=", "open");
    else q = q.where("i.status", "!=", "superseded");
    return q.orderBy("i.severity").orderBy("i.created_at", "desc").execute();
  });
}

/** From a fact back to the run, observation versions (who entered, who accepted), evidence files and factors. */
export async function factLineage(actor: Actor, factId: string) {
  return withActor(actor, async (tx) => {
    const fact = await tx
      .selectFrom("core.metric_fact_versions as f")
      .leftJoin("core.facilities as fa", "fa.id", "f.facility_id")
      .leftJoin("user as a", "a.id", "f.approved_by")
      .selectAll("f")
      .select(["fa.name as facility_name", "a.name as approved_by_name"])
      .where("f.id", "=", factId)
      .executeTakeFirst();
    if (!fact) throw notFound();
    await requireProjectAction(tx, actor, fact.project_id, "project.read");
    const run = await tx
      .selectFrom("core.calculation_runs as r")
      .leftJoin("user as u", "u.id", "r.performed_by")
      .leftJoin("core.reporting_boundaries as b", "b.id", "r.boundary_id")
      .select(["r.id", "r.kind", "r.mode", "r.engine_version", "r.rule_version", "r.input_digest", "r.factor_digest", "r.output_digest", "r.performed_at", "u.name as performed_by_name", "b.kind as boundary_kind", "b.revision as boundary_revision", "r.factors"])
      .where("r.id", "=", fact.run_id)
      .executeTakeFirstOrThrow();
    const history = await tx
      .selectFrom("core.metric_fact_versions")
      .select(["id", "revision", "value_num", "value_text", "unit", "status", "run_id", "created_at", "approved_at"])
      .where("cycle_id", "=", fact.cycle_id)
      .where("metric_key", "=", fact.metric_key)
      .where((eb) => (fact.facility_id ? eb("facility_id", "=", fact.facility_id) : eb("facility_id", "is", null)))
      .where((eb) => (fact.boundary_kind ? eb("boundary_kind", "=", fact.boundary_kind) : eb("boundary_kind", "is", null)))
      .orderBy("revision", "desc")
      .execute();
    let obsQ = tx
      .selectFrom("core.run_inputs as i")
      .innerJoin("core.observation_versions as o", "o.id", "i.observation_version_id")
      .innerJoin("core.data_requests as r", "r.id", "o.request_id")
      .leftJoin("core.facilities as fa", "fa.id", "r.facility_id")
      .leftJoin("user as e", "e.id", "o.entered_by")
      .leftJoin("user as d", "d.id", "o.decided_by")
      .select(["o.id", "o.revision", "o.value_num", "o.unit_code", "o.canonical_value", "o.canonical_unit", "o.lines", "o.quality", "o.source_ref", "o.method_note", "o.decided_at", "r.id as request_id", "r.metric_code", "r.facility_id", "fa.name as facility_name", "e.name as entered_by_name", "d.name as decided_by_name"])
      .where("i.run_id", "=", fact.run_id);
    if (fact.facility_id) obsQ = obsQ.where((eb) => eb.or([eb("r.facility_id", "=", fact.facility_id), eb("r.facility_id", "is", null)]));
    const observations = await obsQ.orderBy("r.metric_code").execute();
    const evidence = await tx
      .selectFrom("core.run_inputs as i")
      .innerJoin("core.evidence_objects as e", "e.id", "i.evidence_id")
      .select(["e.id", "e.filename", "e.sha256", "e.scan_status", "e.uploaded_at", "e.size_bytes"])
      .where("i.run_id", "=", fact.run_id)
      .execute();
    const factorRows = await tx
      .selectFrom("core.run_inputs as i")
      .innerJoin("core.factor_values as v", "v.id", "i.factor_value_id")
      .innerJoin("core.factor_sets as s", "s.id", "v.set_id")
      .select(["v.id", "v.kind", "v.key", "v.label", "v.value", "v.unit", "v.ncv", "v.ch4", "v.n2o", "s.code", "s.name as set_name", "s.publisher", "s.licence", "s.edition_year", "s.url", "s.content_sha256", "s.as_of"])
      .where("i.run_id", "=", fact.run_id)
      .execute();
    const resolution = run.factors as unknown as Resolution;
    const factors = factorRows.map((f) => {
      const r = Object.values(resolution.factors ?? {}).find((x) => x.valueId === f.id);
      return { ...f, target: r?.target ?? null, chosen: r?.chosen ?? false };
    });
    const issues = await tx.selectFrom("core.quality_issues").select(["id", "rule_id", "severity", "status", "target_type", "target_id", "observed", "resolution"]).where("run_id", "=", fact.run_id).execute();
    const { factors: _f, ...runOut } = run;
    void _f;
    return { fact, run: runOut, history, observations, evidence, factors, issues };
  });
}

/**
 * Rebuilds a run from what it recorded — the stored observation versions, factor values (by id) and evidence
 * bytes — and recomputes. `matches` is true when the output digest is the same (G4 gate: reproducible result with
 * the exact factor version and source).
 */
export async function reproduceRun(actor: Actor, runId: string): Promise<{ matches: boolean; outputDigest: string; recomputed: string; inputsMatch: boolean; factorsMatch: boolean; observations: number; factors: number; evidence: number }> {
  return withActor(actor, async (tx) => {
    const run = await tx.selectFrom("core.calculation_runs").selectAll().where("id", "=", runId).executeTakeFirst();
    if (!run) throw notFound();
    await requireProjectAction(tx, actor, run.project_id, "project.read");
    const stored = run.inputs as unknown as Snapshot & { tb: { evidenceId: string; filename: string; sha256: string; uploadedAt: string } | null };
    const resolution = run.factors as unknown as Resolution;
    // observation versions are immutable once accepted; read them back from their table
    const ids = stored.observations.map((o) => o.versionId);
    const rows = ids.length ? await tx.selectFrom("core.observation_versions as o").innerJoin("core.data_requests as r", "r.id", "o.request_id").select(["o.id", "o.canonical_value", "o.canonical_unit", "o.lines", "o.quality", "r.metric_code", "r.facility_id"]).where("o.id", "in", ids).execute() : [];
    const observations: Obs[] = rows
      .map((v) => ({ versionId: v.id, metricCode: v.metric_code, facilityId: v.facility_id, canonical: v.canonical_value, canonicalUnit: v.canonical_unit, lines: (v.lines as Obs["lines"]) ?? null, quality: v.quality as Obs["quality"] }))
      .sort((a, b) => a.versionId.localeCompare(b.versionId));
    // factor values by id from the registry (rows are never edited; a changed value is a new row)
    const valueIds = Object.values(resolution.factors).map((f) => f.valueId);
    const values = valueIds.length ? await tx.selectFrom("core.factor_values").select(["id", "value", "ncv", "ch4", "n2o"]).where("id", "in", valueIds).execute() : [];
    const factors: Record<string, ResolvedFactor> = {};
    for (const [t, f] of Object.entries(resolution.factors)) {
      const v = values.find((x) => x.id === f.valueId);
      if (v) factors[t] = { ...f, value: Number(v.value), ncv: v.ncv === null ? null : Number(v.ncv), ch4: v.ch4 === null ? null : Number(v.ch4), n2o: v.n2o === null ? null : Number(v.n2o) };
    }
    const factorsMatch = factorDigest({ factors, warnings: [] }) === run.factor_digest;
    let tb: TbSnapshot | null = null;
    if (stored.tb) {
      const e = await tx.selectFrom("core.evidence_objects").select(["id", "filename", "sha256", "storage_key", "uploaded_at"]).where("id", "=", stored.tb.evidenceId).executeTakeFirst();
      if (!e) throw new HttpError(409, "evidence_missing");
      tb = await readTrialBalance(e);
    }
    const snap: Snapshot = { kind: run.kind as RunKind, year: stored.year, boundary: stored.boundary, facilities: stored.facilities, observations, tb, pending: stored.pending ?? [], duplicates: stored.duplicates ?? [] };
    const inputsMatch = inputDigest(snap) === run.input_digest;
    const recomputed = outputDigest(evaluate(snap, factors).facts);
    const evidence = await tx.selectFrom("core.run_inputs").select(sql<number>`count(*)::int`.as("n")).where("run_id", "=", runId).where("role", "=", "evidence").executeTakeFirstOrThrow();
    await audit(tx, actor, { action: "calc.reproduce", objectType: "calculation_run", objectId: runId, ownerTenantId: run.owner_tenant_id, projectId: run.project_id, after: { matches: recomputed === run.output_digest, inputsMatch, factorsMatch } });
    return { matches: recomputed === run.output_digest && inputsMatch && factorsMatch, outputDigest: run.output_digest, recomputed, inputsMatch, factorsMatch, observations: observations.length, factors: Object.keys(factors).length, evidence: evidence.n };
  });
}
