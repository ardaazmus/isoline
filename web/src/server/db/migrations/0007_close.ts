/**
 * G5 (plan 09 §8–9, plan 05 G9): consolidation inputs, reconciliation and period close.
 *   - calculation_runs gains the kinds "consolidation" (financial, IFRS 10) and "reconciliation" (U1–U10 checks).
 *   - entity_financials: per legal entity figures for the financial consolidation (net sales from the entity's
 *     trial balance), entered by one person and approved by another (CHECK).
 *   - intercompany_eliminations: sales between group entities, removed from consolidated revenue (IFRS 10 B86).
 *   - cycle_snapshots / snapshot_facts: a frozen copy of the approved facts with a content digest; rows are never
 *     updated or deleted by the application (no grant), only a later snapshot marks an earlier one superseded.
 *   - cycle_events: freeze and reopen with the reason, shown on the close screen.
 *   - a locked metric fact cannot change any more (trigger): a restatement is a new revision in a new snapshot.
 */
import { sql, type Kysely } from "kysely";

const T = (name: string) => [`alter table core.${name} enable row level security`, `alter table core.${name} force row level security`];

const UP: string[] = [
  `alter table core.calculation_runs drop constraint calculation_runs_kind_check`,
  `alter table core.calculation_runs add constraint calculation_runs_kind_check check (kind in ('ghg','environment','workforce','finance','cbam','ets','consolidation','reconciliation'))`,

  // ---------------------------------------------------------------- financial consolidation inputs (G5-02)
  `create table core.entity_financials (
    id uuid primary key default gen_random_uuid(),
    owner_tenant_id uuid not null references core.tenants(id),
    project_id uuid not null,
    cycle_id uuid not null,
    legal_entity_id uuid not null,
    net_sales numeric(38,2) not null check (net_sales >= 0),
    currency char(3) not null default 'TRY' check (currency ~ '^[A-Z]{3}$'),
    evidence_id uuid,
    note text check (note is null or length(note) <= 2000),
    status text not null default 'submitted' check (status in ('submitted','approved','superseded')),
    entered_by uuid not null references "user"(id),
    approved_by uuid references "user"(id),
    approved_at timestamptz,
    created_at timestamptz not null default now(),
    foreign key (owner_tenant_id, project_id) references core.projects(owner_tenant_id, id),
    foreign key (project_id, cycle_id) references core.reporting_cycles(project_id, id),
    foreign key (owner_tenant_id, legal_entity_id) references core.legal_entities(owner_tenant_id, id),
    foreign key (owner_tenant_id, evidence_id) references core.evidence_objects(owner_tenant_id, id),
    check (approved_by is null or approved_by <> entered_by),
    check (status <> 'approved' or approved_by is not null)
  )`,
  `create unique index entity_financials_current on core.entity_financials(cycle_id, legal_entity_id) where status in ('submitted','approved')`,
  `create table core.intercompany_eliminations (
    id uuid primary key default gen_random_uuid(),
    owner_tenant_id uuid not null references core.tenants(id),
    project_id uuid not null,
    cycle_id uuid not null,
    seller_entity_id uuid not null,
    buyer_entity_id uuid not null,
    amount numeric(38,2) not null check (amount > 0),
    description text not null check (length(btrim(description)) between 3 and 500),
    evidence_id uuid,
    status text not null default 'submitted' check (status in ('submitted','approved','withdrawn')),
    entered_by uuid not null references "user"(id),
    approved_by uuid references "user"(id),
    approved_at timestamptz,
    created_at timestamptz not null default now(),
    foreign key (owner_tenant_id, project_id) references core.projects(owner_tenant_id, id),
    foreign key (project_id, cycle_id) references core.reporting_cycles(project_id, id),
    foreign key (owner_tenant_id, seller_entity_id) references core.legal_entities(owner_tenant_id, id),
    foreign key (owner_tenant_id, buyer_entity_id) references core.legal_entities(owner_tenant_id, id),
    foreign key (owner_tenant_id, evidence_id) references core.evidence_objects(owner_tenant_id, id),
    check (seller_entity_id <> buyer_entity_id),
    check (approved_by is null or approved_by <> entered_by),
    check (status <> 'approved' or approved_by is not null)
  )`,

  // ---------------------------------------------------------------- snapshots and close (G5-06/07)
  `create table core.cycle_snapshots (
    id uuid primary key default gen_random_uuid(),
    owner_tenant_id uuid not null references core.tenants(id),
    project_id uuid not null,
    cycle_id uuid not null,
    version integer not null check (version >= 1),
    status text not null default 'frozen' check (status in ('frozen','superseded')),
    content_sha256 char(64) not null,
    facts integer not null,
    checklist jsonb not null,
    restated jsonb,
    frozen_by uuid not null references "user"(id),
    frozen_at timestamptz not null default now(),
    foreign key (owner_tenant_id, project_id) references core.projects(owner_tenant_id, id),
    foreign key (project_id, cycle_id) references core.reporting_cycles(project_id, id),
    unique (cycle_id, version),
    unique (owner_tenant_id, id)
  )`,
  `create table core.snapshot_facts (
    snapshot_id uuid not null references core.cycle_snapshots(id),
    owner_tenant_id uuid not null references core.tenants(id),
    project_id uuid not null,
    fact_id uuid not null references core.metric_fact_versions(id),
    metric_key text not null,
    facility_id uuid,
    boundary_kind text,
    revision integer not null,
    value_num numeric(38,12),
    value_text text,
    unit text not null,
    suppressed boolean not null,
    primary key (snapshot_id, fact_id)
  )`,
  `create table core.cycle_events (
    id uuid primary key default gen_random_uuid(),
    owner_tenant_id uuid not null references core.tenants(id),
    project_id uuid not null,
    cycle_id uuid not null,
    action text not null check (action in ('freeze','reopen')),
    reason text,
    snapshot_id uuid references core.cycle_snapshots(id),
    actor_user_id uuid not null references "user"(id),
    created_at timestamptz not null default now(),
    foreign key (project_id, cycle_id) references core.reporting_cycles(project_id, id),
    check (action <> 'reopen' or length(btrim(coalesce(reason, ''))) >= 20)
  )`,

  // a locked fact is part of a frozen snapshot: no column of it may change
  `create function core.locked_fact_immutable() returns trigger language plpgsql as $$
   begin
     if old.status = 'locked' then
       raise exception 'metric fact % is locked', old.id using errcode = '23514';
     end if;
     return new;
   end $$`,
  `create trigger metric_fact_locked before update on core.metric_fact_versions for each row execute function core.locked_fact_immutable()`,

  // ---------------------------------------------------------------- privileges and RLS
  `grant select, insert on core.entity_financials, core.intercompany_eliminations to isoline_app`,
  `grant update (status, approved_by, approved_at) on core.entity_financials, core.intercompany_eliminations to isoline_app`,
  `grant select, insert on core.cycle_snapshots, core.snapshot_facts, core.cycle_events to isoline_app`,
  `grant update (status) on core.cycle_snapshots to isoline_app`,
  `grant select, insert, update, delete on core.entity_financials, core.intercompany_eliminations, core.cycle_snapshots, core.snapshot_facts, core.cycle_events to isoline_system`,
  ...["entity_financials", "intercompany_eliminations", "cycle_snapshots", "snapshot_facts", "cycle_events"].flatMap((t) => [
    ...T(t),
    `create policy ${t}_read on core.${t} for select using (authz.can_read(owner_tenant_id, project_id))`,
    `create policy ${t}_insert on core.${t} for insert with check (authz.can_write(owner_tenant_id, project_id))`,
    ...(["entity_financials", "intercompany_eliminations", "cycle_snapshots"].includes(t) ? [`create policy ${t}_update on core.${t} for update using (authz.can_write(owner_tenant_id, project_id)) with check (authz.can_write(owner_tenant_id, project_id))`] : []),
  ]),
];

const DOWN: string[] = [
  "drop trigger if exists metric_fact_locked on core.metric_fact_versions",
  "drop function if exists core.locked_fact_immutable()",
  "drop table if exists core.cycle_events",
  "drop table if exists core.snapshot_facts",
  "drop table if exists core.cycle_snapshots",
  "drop table if exists core.intercompany_eliminations",
  "drop table if exists core.entity_financials",
  "delete from core.quality_issues where run_id in (select id from core.calculation_runs where kind in ('consolidation','reconciliation'))",
  "delete from core.metric_fact_versions where run_id in (select id from core.calculation_runs where kind in ('consolidation','reconciliation'))",
  "delete from core.calculation_runs where kind in ('consolidation','reconciliation')",
  "alter table core.calculation_runs drop constraint calculation_runs_kind_check",
  "alter table core.calculation_runs add constraint calculation_runs_kind_check check (kind in ('ghg','environment','workforce','finance','cbam','ets'))",
];

export async function up(db: Kysely<unknown>): Promise<void> {
  for (const s of UP) await sql.raw(s).execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  for (const s of DOWN) await sql.raw(s).execute(db);
}
