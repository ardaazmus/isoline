/**
 * UX Faz 3 (19.10.2026): structured worksheets of a reporting cycle — the inputs the toolkit kept in the browser,
 * now versioned, reviewed and in PostgreSQL:
 *   materiality   double materiality topics and threshold (step 1, scope)
 *   taxonomy      taxonomy activities and KPI denominators (step 3; a "taxonomy" run turns the approved sheet into
 *                 metric facts)
 *   annual_report the minimum-content checklist of one annual report (step 6; the release needs it approved)
 *   pathway, ets, cbam_cost   scenario assumptions of the analysis area (run on approved figures)
 * Every save is a new version; a person submits it and someone else approves it (CHECK approver ≠ author). An
 * approved version is never edited — a newer one supersedes it.
 */
import { sql, type Kysely } from "kysely";

const KINDS = "('materiality','taxonomy','annual_report','pathway','ets','cbam_cost')";

const UP: string[] = [
  `create table core.cycle_worksheets (
    id uuid primary key default gen_random_uuid(),
    owner_tenant_id uuid not null references core.tenants(id),
    project_id uuid not null,
    cycle_id uuid not null,
    kind text not null check (kind in ${KINDS}),
    report_id uuid,
    version integer not null check (version > 0),
    payload jsonb not null,
    payload_sha256 char(64) not null,
    status text not null default 'draft' check (status in ('draft','submitted','approved','superseded')),
    note text check (note is null or length(note) <= 2000),
    entered_by uuid not null references "user"(id),
    approved_by uuid references "user"(id),
    approved_at timestamptz,
    created_at timestamptz not null default now(),
    foreign key (owner_tenant_id, project_id) references core.projects(owner_tenant_id, id),
    foreign key (project_id, cycle_id) references core.reporting_cycles(project_id, id),
    foreign key (report_id) references core.reports(id) on delete cascade,
    check ((kind = 'annual_report') = (report_id is not null)),
    check (approved_by is null or approved_by <> entered_by),
    check (status <> 'approved' or approved_by is not null)
  )`,
  `create unique index cycle_worksheets_version on core.cycle_worksheets(cycle_id, kind, coalesce(report_id, '00000000-0000-0000-0000-000000000000'::uuid), version)`,
  `create index cycle_worksheets_scope_idx on core.cycle_worksheets(owner_tenant_id, project_id, cycle_id, kind, status)`,
  `grant select, insert on core.cycle_worksheets to isoline_app`,
  `grant update (status, approved_by, approved_at) on core.cycle_worksheets to isoline_app`,
  `grant select, insert, update, delete on core.cycle_worksheets to isoline_system`,
  `alter table core.cycle_worksheets enable row level security`,
  `alter table core.cycle_worksheets force row level security`,
  `create policy cycle_worksheets_read on core.cycle_worksheets for select using (authz.can_read(owner_tenant_id, project_id))`,
  `create policy cycle_worksheets_insert on core.cycle_worksheets for insert with check (authz.can_write(owner_tenant_id, project_id))`,
  `create policy cycle_worksheets_update on core.cycle_worksheets for update using (authz.can_write(owner_tenant_id, project_id)) with check (authz.can_write(owner_tenant_id, project_id))`,
  // a payload never changes after it is written (the grant above already leaves it out; the trigger guards the owner role too)
  `create function core.cycle_worksheets_immutable() returns trigger language plpgsql as $$
   begin
     if new.payload is distinct from old.payload or new.payload_sha256 is distinct from old.payload_sha256 or new.version is distinct from old.version or new.entered_by is distinct from old.entered_by then
       raise exception 'worksheet versions are immutable' using errcode = '23514';
     end if;
     return new;
   end $$`,
  `create trigger cycle_worksheets_immutable before update on core.cycle_worksheets for each row execute function core.cycle_worksheets_immutable()`,
  // the taxonomy run writes the approved sheet's KPIs as metric facts
  `alter table core.calculation_runs drop constraint calculation_runs_kind_check`,
  `alter table core.calculation_runs add constraint calculation_runs_kind_check check (kind in ('ghg','environment','workforce','finance','cbam','ets','consolidation','reconciliation','industry','taxonomy'))`,
];

const DOWN: string[] = [
  "delete from core.quality_issues where run_id in (select id from core.calculation_runs where kind = 'taxonomy')",
  "delete from core.metric_fact_versions where run_id in (select id from core.calculation_runs where kind = 'taxonomy')",
  "delete from core.calculation_runs where kind = 'taxonomy'",
  "alter table core.calculation_runs drop constraint calculation_runs_kind_check",
  "alter table core.calculation_runs add constraint calculation_runs_kind_check check (kind in ('ghg','environment','workforce','finance','cbam','ets','consolidation','reconciliation','industry'))",
  "drop table if exists core.cycle_worksheets",
  "drop function if exists core.cycle_worksheets_immutable()",
];

export async function up(db: Kysely<unknown>): Promise<void> {
  for (const s of UP) await sql.raw(s).execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  for (const s of DOWN) await sql.raw(s).execute(db);
}
