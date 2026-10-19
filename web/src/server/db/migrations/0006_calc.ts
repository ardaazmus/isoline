/**
 * G4 (plan 09 §4–7, ADR-009): factor registry, calculation runs, metric fact versions, quality issues.
 *   - factor_sets / factor_values: built-in (owner null) and tenant-private sets with licence, edition year and a
 *     content digest; a run records the exact set rows and values it used.
 *   - calculation_runs: idempotent on (project, kind, boundary, input digest, engine, factor digest).
 *   - metric_fact_versions: numeric(38,12) values with run, status and supersedes; the approver is never the person
 *     who ran the calculation (checked in the service against run.performed_by).
 *   - quality_issues: deterministic rule results with rule version, severity, observed/expected and resolution.
 */
import { sql, type Kysely } from "kysely";

const T = (name: string) => [`alter table core.${name} enable row level security`, `alter table core.${name} force row level security`];

const UP: string[] = [
  `alter table core.facilities add column grid_connection text not null default 'distribution' check (grid_connection in ('transmission','distribution'))`,

  // ---------------------------------------------------------------- factor registry (G4-01)
  `create table core.factor_sets (
    id uuid primary key default gen_random_uuid(),
    owner_tenant_id uuid references core.tenants(id),
    code text not null check (code ~ '^[a-z0-9_]+$'),
    family text,
    edition_year smallint,
    name text not null,
    publisher text not null,
    licence text not null check (licence in ('open','public_sector','user_licensed')),
    licence_note text,
    url text,
    published_on date,
    as_of date,
    rights_confirmed boolean not null default false,
    rights_confirmed_by uuid references "user"(id),
    rights_confirmed_at timestamptz,
    content_sha256 char(64) not null,
    status text not null default 'active' check (status in ('active','withdrawn')),
    created_by uuid references "user"(id),
    created_at timestamptz not null default now(),
    check (owner_tenant_id is not null or licence <> 'user_licensed'),
    check (licence <> 'user_licensed' or (rights_confirmed and rights_confirmed_by is not null))
  )`,
  `create unique index factor_sets_builtin_uq on core.factor_sets(code, content_sha256) where owner_tenant_id is null`,
  `create unique index factor_sets_tenant_uq on core.factor_sets(owner_tenant_id, code, content_sha256) where owner_tenant_id is not null`,
  `create table core.factor_values (
    id uuid primary key default gen_random_uuid(),
    set_id uuid not null references core.factor_sets(id) on delete cascade,
    kind text not null check (kind in ('fuel_co2','grid','gwp','scope3','cbam_default')),
    key text not null,
    label text,
    value numeric(38,12) not null,
    unit text,
    ncv numeric(38,12),
    ch4 numeric(38,12),
    n2o numeric(38,12),
    direct numeric(38,12),
    indirect numeric(38,12),
    year smallint,
    categories smallint[] not null default '{}',
    unique (set_id, kind, key)
  )`,
  `create table core.factor_choices (
    id uuid primary key default gen_random_uuid(),
    owner_tenant_id uuid not null references core.tenants(id),
    project_id uuid not null,
    target text not null check (target ~ '^[a-z0-9_:./-]+$'),
    factor_value_id uuid not null references core.factor_values(id),
    reason text,
    chosen_by uuid not null references "user"(id),
    created_at timestamptz not null default now(),
    revoked_at timestamptz,
    foreign key (owner_tenant_id, project_id) references core.projects(owner_tenant_id, id)
  )`,
  `create unique index factor_choices_active on core.factor_choices(project_id, target) where revoked_at is null`,

  // ---------------------------------------------------------------- runs (G4-02)
  `create table core.calculation_runs (
    id uuid primary key default gen_random_uuid(),
    owner_tenant_id uuid not null references core.tenants(id),
    project_id uuid not null,
    cycle_id uuid not null,
    boundary_id uuid,
    kind text not null check (kind in ('ghg','environment','workforce','finance','cbam','ets')),
    mode text not null default 'final' check (mode in ('preview','final')),
    engine_version text not null,
    rule_version text not null,
    factor_digest char(64) not null,
    input_digest char(64) not null,
    output_digest char(64) not null,
    inputs jsonb not null,
    factors jsonb not null,
    result jsonb not null,
    performed_by uuid not null references "user"(id),
    performed_at timestamptz not null default now(),
    foreign key (owner_tenant_id, project_id) references core.projects(owner_tenant_id, id),
    foreign key (project_id, cycle_id) references core.reporting_cycles(project_id, id),
    foreign key (owner_tenant_id, boundary_id) references core.reporting_boundaries(owner_tenant_id, id),
    unique (owner_tenant_id, id)
  )`,
  `create unique index calculation_runs_idempotent on core.calculation_runs(project_id, kind, coalesce(boundary_id, '00000000-0000-0000-0000-000000000000'::uuid), input_digest, engine_version, factor_digest, mode)`,
  `create table core.run_inputs (
    run_id uuid not null references core.calculation_runs(id) on delete cascade,
    owner_tenant_id uuid not null references core.tenants(id),
    project_id uuid not null,
    observation_version_id uuid,
    evidence_id uuid,
    factor_value_id uuid references core.factor_values(id),
    role text not null check (role in ('observation','evidence','factor')),
    check ((observation_version_id is not null)::int + (evidence_id is not null)::int + (factor_value_id is not null)::int = 1)
  )`,
  `create index run_inputs_run_idx on core.run_inputs(run_id)`,
  `create index run_inputs_obs_idx on core.run_inputs(observation_version_id) where observation_version_id is not null`,

  // ---------------------------------------------------------------- facts (G4-08)
  `create table core.metric_fact_versions (
    id uuid primary key default gen_random_uuid(),
    owner_tenant_id uuid not null references core.tenants(id),
    project_id uuid not null,
    cycle_id uuid not null,
    metric_key text not null check (metric_key ~ '^[a-z0-9_.]+$'),
    facility_id uuid,
    boundary_kind text,
    revision integer not null check (revision >= 1),
    value_num numeric(38,12),
    value_text text,
    unit text not null,
    run_id uuid not null,
    status text not null default 'ready_for_review' check (status in ('validating','ready_for_review','approved','locked','superseded','rejected')),
    estimated_share numeric(9,6),
    suppressed boolean not null default false,
    supersedes_id uuid references core.metric_fact_versions(id),
    approved_by uuid references "user"(id),
    approved_at timestamptz,
    locked_at timestamptz,
    created_at timestamptz not null default now(),
    foreign key (owner_tenant_id, project_id) references core.projects(owner_tenant_id, id),
    foreign key (project_id, cycle_id) references core.reporting_cycles(project_id, id),
    foreign key (owner_tenant_id, run_id) references core.calculation_runs(owner_tenant_id, id),
    foreign key (owner_tenant_id, facility_id) references core.facilities(owner_tenant_id, id),
    unique (owner_tenant_id, id),
    check ((value_num is not null) <> (value_text is not null)),
    check (status not in ('approved','locked') or approved_by is not null)
  )`,
  `create unique index metric_facts_revision on core.metric_fact_versions(cycle_id, metric_key, coalesce(facility_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(boundary_kind, ''), revision)`,
  `create index metric_facts_scope_idx on core.metric_fact_versions(owner_tenant_id, project_id, cycle_id, metric_key, status)`,

  // ---------------------------------------------------------------- quality (G4-07)
  `create table core.quality_issues (
    id uuid primary key default gen_random_uuid(),
    owner_tenant_id uuid not null references core.tenants(id),
    project_id uuid not null,
    cycle_id uuid not null,
    run_id uuid,
    rule_id text not null,
    rule_version text not null,
    severity text not null check (severity in ('blocker','warning')),
    target_type text not null check (target_type in ('cycle','run','fact','observation_version','data_request','factor')),
    target_id text not null,
    observed jsonb,
    expected jsonb,
    tolerance text,
    status text not null default 'open' check (status in ('open','resolved','accepted_exception','superseded')),
    resolution text,
    resolved_by uuid references "user"(id),
    resolved_at timestamptz,
    detected_by uuid references "user"(id),
    created_at timestamptz not null default now(),
    foreign key (owner_tenant_id, project_id) references core.projects(owner_tenant_id, id),
    foreign key (project_id, cycle_id) references core.reporting_cycles(project_id, id),
    check (status <> 'accepted_exception' or severity = 'warning'),
    check (status not in ('resolved','accepted_exception') or (resolved_by is not null and length(btrim(coalesce(resolution, ''))) >= 10))
  )`,
  `create index quality_issues_scope_idx on core.quality_issues(owner_tenant_id, project_id, cycle_id, status, severity)`,

  // ---------------------------------------------------------------- privileges and RLS
  `grant select on core.factor_sets, core.factor_values to isoline_app`,
  `grant insert on core.factor_sets, core.factor_values to isoline_app`,
  `grant update (status) on core.factor_sets to isoline_app`,
  `grant select, insert, update on core.factor_choices, core.calculation_runs, core.metric_fact_versions, core.quality_issues to isoline_app`,
  `grant select, insert on core.run_inputs to isoline_app`,
  `grant select, insert, update, delete on core.factor_sets, core.factor_values, core.factor_choices, core.calculation_runs, core.run_inputs, core.metric_fact_versions, core.quality_issues to isoline_system`,
  ...T("factor_sets"),
  `create policy factor_sets_read on core.factor_sets for select using (owner_tenant_id is null or authz.can_read(owner_tenant_id, null) or authz.has_grant_from(owner_tenant_id))`,
  `create policy factor_sets_insert on core.factor_sets for insert with check (owner_tenant_id = authz.acting_tenant() and authz.can_write(owner_tenant_id, null))`,
  `create policy factor_sets_update on core.factor_sets for update using (owner_tenant_id = authz.acting_tenant() and authz.can_write(owner_tenant_id, null))`,
  ...T("factor_values"),
  `create policy factor_values_read on core.factor_values for select using (exists (select 1 from core.factor_sets s where s.id = set_id))`,
  `create policy factor_values_insert on core.factor_values for insert with check (exists (select 1 from core.factor_sets s where s.id = set_id and s.owner_tenant_id = authz.acting_tenant()))`,
  ...["factor_choices", "calculation_runs", "metric_fact_versions", "quality_issues", "run_inputs"].flatMap((t) => [
    ...T(t),
    `create policy ${t}_read on core.${t} for select using (authz.can_read(owner_tenant_id, project_id))`,
    `create policy ${t}_insert on core.${t} for insert with check (authz.can_write(owner_tenant_id, project_id))`,
    ...(t === "run_inputs" ? [] : [`create policy ${t}_update on core.${t} for update using (authz.can_write(owner_tenant_id, project_id)) with check (authz.can_write(owner_tenant_id, project_id))`]),
  ]),
];

const DOWN: string[] = [
  "drop table if exists core.quality_issues",
  "drop table if exists core.metric_fact_versions",
  "drop table if exists core.run_inputs",
  "drop table if exists core.calculation_runs",
  "drop table if exists core.factor_choices",
  "drop table if exists core.factor_values",
  "drop table if exists core.factor_sets",
  "alter table core.facilities drop column if exists grid_connection",
];

export async function up(db: Kysely<unknown>): Promise<void> {
  for (const s of UP) await sql.raw(s).execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  for (const s of DOWN) await sql.raw(s).execute(db);
}
