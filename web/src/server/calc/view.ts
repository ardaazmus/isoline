/**
 * What the calculations page of one cycle shows, after one access check and in one statement (G8-07 load test: the page
 * used to open seven transactions that repeated the same check, and under load every round trip waits its turn).
 * The fact, run and factor-choice lists are the same queries as listFacts, listRuns and listChoices (shared builders);
 * the rest is only what the page uses: open quality findings as the issue row shows them, the kinds of approved
 * boundaries (the run panel), and the active factor sets for the choice form.
 */
import { sql, type Expression } from "kysely";
import { withActor, type Actor } from "../db/client";
import { notFound } from "../policy/policy";
import { requireProjectAction } from "../tenancy/service";
import { choicesQuery } from "./factors";
import { factsQuery, runsQuery } from "./service";

/** Timestamps arrive in a JSON aggregate as ISO text. */
type Jsonified<T> = { [K in keyof T]: T[K] extends Date ? string : T[K] extends Date | null ? string | null : T[K] };
type Row<Q> = Q extends { execute(): Promise<(infer R)[]> } ? R : never;

/**
 * A subquery's rows as one JSON array. The order is given to json_agg as well: PostgreSQL keeps a sorted subquery's
 * order inside an aggregate only "usually".
 */
const rows = <R>(query: Expression<unknown>, order: string) => sql<Jsonified<R>[]>`(select coalesce(json_agg(x order by ${sql.raw(order)}), '[]'::json) from (${query}) as x)`;

export type IssueRowView = { id: string; rule_id: string; severity: string; status: string; target_type: string; target_id: string; observed: unknown; resolution: string | null; resolved_by_name: string | null; run_kind: string | null };
export type FactorSetOption = { id: string; code: string; name: string; edition_year: number | null; licence: string };

export async function calculationsView(actor: Actor, projectId: string, cycleId: string, opts: { factorSets: boolean }) {
  return withActor(actor, async (tx) => {
    await requireProjectAction(tx, actor, projectId, "project.read");
    const facts = factsQuery(tx, cycleId);
    const runs = runsQuery(tx, projectId, cycleId);
    const choices = choicesQuery(tx, projectId);
    // as listIssues(…, "open"), with the columns the issue row shows
    const issues = tx
      .selectFrom("core.quality_issues as i")
      .leftJoin("core.calculation_runs as r", "r.id", "i.run_id")
      .leftJoin("user as u", "u.id", "i.resolved_by")
      .select(["i.id", "i.rule_id", "i.severity", "i.status", "i.target_type", "i.target_id", "i.observed", "i.resolution", "u.name as resolved_by_name", "r.kind as run_kind", "i.created_at"])
      .where("i.cycle_id", "=", cycleId)
      .where("i.status", "=", "open")
      .orderBy("i.severity")
      .orderBy("i.created_at", "desc");
    const sets = tx
      .selectFrom("core.factor_sets")
      .select(["id", "code", "name", "edition_year", "licence", "family"])
      .where("status", "=", "active")
      .orderBy("family")
      .orderBy("edition_year", "desc")
      .orderBy("code");
    const r = await tx
      .selectNoFrom([
        tx.selectFrom("core.reporting_cycles").select("project_id").where("id", "=", cycleId).$asScalar().as("cycle_project"),
        rows<Row<typeof facts>>(facts, "x.metric_key, x.facility_id, x.revision desc").as("facts"),
        rows<Row<typeof issues>>(issues, "x.severity, x.created_at desc").as("issues"),
        rows<Row<typeof runs>>(runs, "x.performed_at desc").as("runs"),
        rows<Row<typeof choices>>(choices, "x.target").as("choices"),
        (opts.factorSets ? rows<Row<typeof sets>>(sets, "x.family, x.edition_year desc, x.code") : sql<Jsonified<Row<typeof sets>>[]>`'[]'::json`).as("sets"),
        sql<string[]>`(select coalesce(array_agg(distinct kind order by kind), '{}') from core.reporting_boundaries where cycle_id = ${cycleId} and status = 'approved')`.as("approved"),
      ])
      .executeTakeFirstOrThrow();
    if (r.cycle_project !== projectId) throw notFound("cycle_not_found");
    return {
      facts: r.facts.map((f) => ({ ...f, created_at: new Date(f.created_at) })),
      issues: r.issues.map((i): IssueRowView => ({ id: i.id, rule_id: i.rule_id, severity: i.severity, status: i.status, target_type: i.target_type, target_id: i.target_id, observed: i.observed, resolution: i.resolution, resolved_by_name: i.resolved_by_name, run_kind: i.run_kind })),
      runs: r.runs.map((x) => ({ ...x, performed_at: new Date(x.performed_at) })),
      choices: r.choices.map((c) => ({ ...c, created_at: new Date(c.created_at) })),
      approvedBoundaries: r.approved,
      factorSets: r.sets.map((x): FactorSetOption => ({ id: x.id, code: x.code, name: x.name, edition_year: x.edition_year, licence: x.licence })),
    };
  });
}

export type CalculationsView = Awaited<ReturnType<typeof calculationsView>>;
