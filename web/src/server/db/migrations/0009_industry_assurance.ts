/**
 * G7 (plan 08, plan 10 §5): industry packs and the assurance room.
 *   - project_industry_packs: a versioned pack switched on for a project and the facilities (activities) it covers;
 *     several packs per project (a holding can be steel and logistics at once).
 *   - calculation_runs gains the kind "industry" (pack formulas over accepted data and current facts).
 *   - assurance_engagements: the assurance assignment of a cycle (standard, level, status); the opinion file is
 *     added by the company as evidence — the platform never issues assurance itself.
 *   - assurance_questions: the assurer asks about a fact, a file or a report; the company answers with text and
 *     evidence; the assurer closes. The assurer never changes data (RLS: an assurance grant cannot write).
 */
import { sql, type Kysely } from "kysely";

const T = (name: string) => [`alter table core.${name} enable row level security`, `alter table core.${name} force row level security`];

const UP: string[] = [
  `alter table core.calculation_runs drop constraint calculation_runs_kind_check`,
  `alter table core.calculation_runs add constraint calculation_runs_kind_check check (kind in ('ghg','environment','workforce','finance','cbam','ets','consolidation','reconciliation','industry'))`,

  `create table core.project_industry_packs (
    id uuid primary key default gen_random_uuid(),
    owner_tenant_id uuid not null references core.tenants(id),
    project_id uuid not null,
    pack_id text not null check (pack_id ~ '^[a-z0-9_]+$'),
    pack_version text not null,
    facility_ids uuid[] not null default '{}',
    enabled_by uuid not null references "user"(id),
    enabled_at timestamptz not null default now(),
    disabled_by uuid references "user"(id),
    disabled_at timestamptz,
    foreign key (owner_tenant_id, project_id) references core.projects(owner_tenant_id, id)
  )`,
  `create unique index project_industry_packs_active on core.project_industry_packs(project_id, pack_id) where disabled_at is null`,

  `create table core.assurance_engagements (
    id uuid primary key default gen_random_uuid(),
    owner_tenant_id uuid not null references core.tenants(id),
    project_id uuid not null,
    cycle_id uuid not null,
    provider_tenant_id uuid references core.tenants(id),
    standard text not null check (standard in ('isae3000','isae3410','issa5000','kgk_gds','other')),
    level text not null check (level in ('limited','reasonable')),
    status text not null default 'preparing' check (status in ('preparing','ready','in_progress','opinion_received','withdrawn')),
    opinion_evidence_id uuid,
    opinion_recorded_by uuid references "user"(id),
    opinion_recorded_at timestamptz,
    created_by uuid not null references "user"(id),
    created_at timestamptz not null default now(),
    foreign key (owner_tenant_id, project_id) references core.projects(owner_tenant_id, id),
    foreign key (project_id, cycle_id) references core.reporting_cycles(project_id, id),
    foreign key (owner_tenant_id, opinion_evidence_id) references core.evidence_objects(owner_tenant_id, id),
    check (status <> 'opinion_received' or opinion_evidence_id is not null)
  )`,
  `create table core.assurance_questions (
    id uuid primary key default gen_random_uuid(),
    owner_tenant_id uuid not null references core.tenants(id),
    project_id uuid not null,
    cycle_id uuid not null,
    engagement_id uuid references core.assurance_engagements(id),
    target_type text not null check (target_type in ('fact','evidence','report','general')),
    target_id text,
    question text not null check (length(btrim(question)) between 10 and 4000),
    asked_by uuid not null references "user"(id),
    asked_tenant_id uuid references core.tenants(id),
    asked_at timestamptz not null default now(),
    status text not null default 'open' check (status in ('open','answered','closed')),
    answer text check (answer is null or length(answer) <= 8000),
    answer_evidence_ids uuid[] not null default '{}',
    answered_by uuid references "user"(id),
    answered_at timestamptz,
    closed_by uuid references "user"(id),
    closed_at timestamptz,
    foreign key (owner_tenant_id, project_id) references core.projects(owner_tenant_id, id),
    foreign key (project_id, cycle_id) references core.reporting_cycles(project_id, id),
    check (status = 'open' or (answer is not null and answered_by is not null)),
    check (answered_by is null or answered_by <> asked_by)
  )`,

  `grant select, insert on core.project_industry_packs, core.assurance_engagements, core.assurance_questions to isoline_app`,
  `grant update (facility_ids, disabled_by, disabled_at) on core.project_industry_packs to isoline_app`,
  `grant update (status, provider_tenant_id, opinion_evidence_id, opinion_recorded_by, opinion_recorded_at) on core.assurance_engagements to isoline_app`,
  `grant update (status, answer, answer_evidence_ids, answered_by, answered_at, closed_by, closed_at) on core.assurance_questions to isoline_app`,
  `grant select, insert, update, delete on core.project_industry_packs, core.assurance_engagements, core.assurance_questions to isoline_system`,
  ...["project_industry_packs", "assurance_engagements"].flatMap((t) => [
    ...T(t),
    `create policy ${t}_read on core.${t} for select using (authz.can_read(owner_tenant_id, project_id))`,
    `create policy ${t}_insert on core.${t} for insert with check (authz.can_write(owner_tenant_id, project_id))`,
    `create policy ${t}_update on core.${t} for update using (authz.can_write(owner_tenant_id, project_id)) with check (authz.can_write(owner_tenant_id, project_id))`,
  ]),
  ...T("assurance_questions"),
  `create policy assurance_questions_read on core.assurance_questions for select using (authz.can_read(owner_tenant_id, project_id))`,
  // only an assurance grant asks; the company answers; the asker closes
  `create policy assurance_questions_insert on core.assurance_questions for insert with check (asked_by = authz.uid() and authz.grant_role(project_id) = 'assurance')`,
  `create policy assurance_questions_update on core.assurance_questions for update using (authz.can_write(owner_tenant_id, project_id) or (authz.grant_role(project_id) = 'assurance' and asked_by = authz.uid())) with check (authz.can_write(owner_tenant_id, project_id) or (authz.grant_role(project_id) = 'assurance' and asked_by = authz.uid()))`,
];

const DOWN: string[] = [
  "drop table if exists core.assurance_questions",
  "drop table if exists core.assurance_engagements",
  "drop table if exists core.project_industry_packs",
  "delete from core.quality_issues where run_id in (select id from core.calculation_runs where kind = 'industry')",
  "delete from core.metric_fact_versions where run_id in (select id from core.calculation_runs where kind = 'industry')",
  "delete from core.calculation_runs where kind = 'industry'",
  "alter table core.calculation_runs drop constraint calculation_runs_kind_check",
  "alter table core.calculation_runs add constraint calculation_runs_kind_check check (kind in ('ghg','environment','workforce','finance','cbam','ets','consolidation','reconciliation'))",
];

export async function up(db: Kysely<unknown>): Promise<void> {
  for (const s of UP) await sql.raw(s).execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  for (const s of DOWN) await sql.raw(s).execute(db);
}
