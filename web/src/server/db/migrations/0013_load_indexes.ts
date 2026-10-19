/**
 * G8-07 load test: indexes for the lists that run on every visit of the portfolio, its KPIs and the review queue.
 * With 200 other customers in the database these filtered by columns no index starts with (cycle, pending status,
 * steward), so PostgreSQL read whole tables and evaluated the row-level security functions on every row
 * (docs/erp/G8/02_YUK_TESTI.md). Partial indexes keep only the rows the lists look for. Built inside the migration
 * transaction (no CONCURRENTLY): the tables are small at this stage; a large installation would build them ahead.
 */
import { sql, type Kysely } from "kysely";

const INDEXES: [name: string, definition: string][] = [
  // portfolio KPIs: requests, blockers and reports of each project's current cycle
  ["data_requests_cycle_idx", "core.data_requests (cycle_id, status)"],
  ["quality_issues_cycle_idx", "core.quality_issues (cycle_id, status, severity)"],
  ["reports_cycle_idx", "core.reports (cycle_id)"],
  // reachable projects: the provisional clients a workspace stewards
  ["tenants_steward_idx", "core.tenants (steward_tenant_id) where lifecycle = 'provisional'"],
  // review queue: what waits for a decision in the reachable projects
  ["metric_facts_review_idx", "core.metric_fact_versions (project_id, created_at) where status = 'ready_for_review'"],
  ["quality_issues_open_idx", "core.quality_issues (project_id, created_at) where status = 'open'"],
  ["entity_financials_submitted_idx", "core.entity_financials (project_id) where status = 'submitted'"],
];

export async function up(db: Kysely<unknown>): Promise<void> {
  for (const [name, definition] of INDEXES) await sql.raw(`create index ${name} on ${definition}`).execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  for (const [name] of [...INDEXES].reverse()) await sql.raw(`drop index if exists core.${name}`).execute(db);
}
