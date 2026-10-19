/**
 * Indexes for the cycle-step signals (UX Faz 1–3, server/cycle/progress.ts): the step bar of every project page,
 * "Today" and the portfolio read these tables by cycle. Without an index starting with cycle_id each lookup scans
 * the whole table — every customer's rows — so its cost would grow with other customers' data. With the e2e data
 * set (200 background tenants) the load test showed no measurable difference yet; the pages' latency there came from
 * the saturated web process (docs/erp/G8/02_YUK_TESTI.md §7).
 */
import { sql, type Kysely } from "kysely";

const INDEXES: [name: string, definition: string][] = [
  // dates and owners of each step (the plan's work packages): the largest table the steps read
  ["work_packages_cycle_idx", "core.work_packages (cycle_id, gate)"],
  // last calculation and last reconciliation of the cycle
  ["calculation_runs_cycle_idx", "core.calculation_runs (cycle_id, kind, mode)"],
  ["intercompany_eliminations_cycle_idx", "core.intercompany_eliminations (cycle_id, status)"],
  ["assurance_engagements_cycle_idx", "core.assurance_engagements (cycle_id, created_at)"],
  ["assurance_questions_cycle_idx", "core.assurance_questions (cycle_id, status)"],
];

export async function up(db: Kysely<unknown>): Promise<void> {
  for (const [name, definition] of INDEXES) await sql.raw(`create index ${name} on ${definition}`).execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  for (const [name] of [...INDEXES].reverse()) await sql.raw(`drop index if exists core.${name}`).execute(db);
}
