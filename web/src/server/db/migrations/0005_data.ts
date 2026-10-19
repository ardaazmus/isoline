/**
 * G3 (plan 05 §3, 06 §2, 09 §1–2): data campaigns and requests, versioned observations, evidence links, comments,
 * source imports and in-app notifications.
 *   - A request is the slot (metric × facility × period) with a state machine; reviewer ≠ assignee (CHECK).
 *   - Observation versions are never overwritten; the decider of a version is never the person who entered it
 *     (CHECK — separation of duties holds even against a faulty service).
 *   - Row-level visibility: contributors see only requests assigned to them (or they review); a supplier grant
 *     sees only its own requests; leads, data owners, stewards and preparer/methodology/reviewer grants see all.
 */
import { sql, type Kysely } from "kysely";

const T = (name: string) => [`alter table core.${name} enable row level security`, `alter table core.${name} force row level security`];
const GRANT_ROLES_OLD = "'preparer','reviewer','methodology','design','assurance'";
const GRANT_ROLES_NEW = "'preparer','reviewer','methodology','design','assurance','supplier'";

const UP: string[] = [
  // ---------------------------------------------------------------- catalogue (global, append-only)
  `create table core.metric_definitions (
    code text not null check (code ~ '^[a-z0-9_]+$'),
    version integer not null check (version >= 1),
    section text not null,
    role text not null,
    unit_key text not null,
    dimensions text[] not null,
    aggregation text not null check (aggregation in ('sum','last','average','none')),
    grain text not null check (grain in ('facility','organization')),
    period_kind text not null check (period_kind in ('year','prior','base','history','plan')),
    crosswalk text,
    sensitive boolean not null default false,
    evidence_required boolean not null default true,
    multiline boolean not null default false,
    line_keys text[] not null default '{}',
    catalog_version text not null,
    created_at timestamptz not null default now(),
    primary key (code, version)
  )`,

  // ---------------------------------------------------------------- campaigns and requests
  `create table core.data_campaigns (
    id uuid primary key default gen_random_uuid(),
    owner_tenant_id uuid not null references core.tenants(id),
    project_id uuid not null,
    cycle_id uuid not null,
    title text not null check (length(btrim(title)) between 1 and 200),
    template_ids text[] not null default '{}',
    status text not null default 'active' check (status in ('draft','active','closed')),
    reminder_policy jsonb not null default '{"beforeDays":[7,2],"afterDays":[1],"criticalOnlyDays":[2]}'::jsonb,
    default_due date,
    created_by uuid not null references "user"(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    row_version bigint not null default 1,
    foreign key (owner_tenant_id, project_id) references core.projects(owner_tenant_id, id),
    foreign key (project_id, cycle_id) references core.reporting_cycles(project_id, id),
    unique (owner_tenant_id, id),
    unique (project_id, id)
  )`,
  `create table core.data_requests (
    id uuid primary key default gen_random_uuid(),
    owner_tenant_id uuid not null references core.tenants(id),
    project_id uuid not null,
    cycle_id uuid not null,
    campaign_id uuid not null,
    metric_code text not null,
    metric_version integer not null,
    facility_id uuid,
    period_label text not null,
    period_start date,
    period_end date,
    status text not null default 'created' check (status in ('created','assigned','sent','submitted','reviewing','accepted','revision_required','withdrawn','not_applicable')),
    assignee_user_id uuid references "user"(id),
    reviewer_user_id uuid references "user"(id),
    due_on date,
    critical boolean not null default false,
    traces jsonb not null default '[]'::jsonb,
    instructions text,
    na_reason text,
    returns integer not null default 0,
    submitted_at timestamptz,
    accepted_at timestamptz,
    accepted_by uuid references "user"(id),
    created_by uuid not null references "user"(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    row_version bigint not null default 1,
    foreign key (owner_tenant_id, project_id) references core.projects(owner_tenant_id, id),
    foreign key (project_id, campaign_id) references core.data_campaigns(project_id, id),
    foreign key (owner_tenant_id, facility_id) references core.facilities(owner_tenant_id, id),
    foreign key (metric_code, metric_version) references core.metric_definitions(code, version),
    unique (owner_tenant_id, id),
    unique (project_id, id),
    check (assignee_user_id is null or reviewer_user_id is null or assignee_user_id <> reviewer_user_id),
    check (status in ('created','withdrawn','not_applicable') or (assignee_user_id is not null and reviewer_user_id is not null)),
    check (status <> 'not_applicable' or length(btrim(coalesce(na_reason, ''))) >= 10),
    check (status <> 'accepted' or (accepted_by is not null and accepted_by <> assignee_user_id)),
    check (period_end is null or period_start is null or period_end >= period_start)
  )`,
  `create unique index data_requests_once on core.data_requests(campaign_id, metric_code, coalesce(facility_id, '00000000-0000-0000-0000-000000000000'::uuid))`,
  `create index data_requests_assignee_idx on core.data_requests(assignee_user_id, status, due_on)`,
  `create index data_requests_reviewer_idx on core.data_requests(reviewer_user_id, status)`,
  `create index data_requests_scope_idx on core.data_requests(owner_tenant_id, project_id, status, due_on)`,

  // ---------------------------------------------------------------- observations (versioned)
  `create table core.observation_versions (
    id uuid primary key default gen_random_uuid(),
    owner_tenant_id uuid not null references core.tenants(id),
    project_id uuid not null,
    request_id uuid not null,
    revision integer not null check (revision >= 1),
    value_num numeric(38,12),
    value_text text check (value_text is null or length(value_text) <= 4000),
    unit_code text,
    canonical_value numeric(38,12),
    canonical_unit text,
    lines jsonb,
    quality text not null default 'measured' check (quality in ('measured','calculated','estimated')),
    method_note text,
    source_ref text,
    status text not null default 'draft' check (status in ('draft','submitted','accepted','rejected','superseded')),
    entered_by uuid not null references "user"(id),
    created_at timestamptz not null default now(),
    submitted_at timestamptz,
    decided_by uuid references "user"(id),
    decided_at timestamptz,
    import_id uuid,
    foreign key (project_id, request_id) references core.data_requests(project_id, id),
    unique (request_id, revision),
    unique (owner_tenant_id, id),
    check (value_num is not null or value_text is not null or lines is not null),
    check (value_num is null or unit_code is not null),
    check (decided_by is null or decided_by <> entered_by)
  )`,
  `create unique index observation_one_draft on core.observation_versions(request_id) where status = 'draft'`,

  // ---------------------------------------------------------------- evidence links, comments
  `create table core.evidence_links (
    id uuid primary key default gen_random_uuid(),
    owner_tenant_id uuid not null references core.tenants(id),
    project_id uuid not null,
    evidence_id uuid not null,
    target_type text not null check (target_type in ('data_request','observation_version','calculation_run','metric_fact','report_section')),
    target_id uuid not null,
    linked_by uuid not null references "user"(id),
    created_at timestamptz not null default now(),
    unlinked_at timestamptz,
    unlinked_by uuid references "user"(id),
    foreign key (owner_tenant_id, evidence_id) references core.evidence_objects(owner_tenant_id, id),
    foreign key (owner_tenant_id, project_id) references core.projects(owner_tenant_id, id)
  )`,
  `create unique index evidence_links_active on core.evidence_links(evidence_id, target_type, target_id) where unlinked_at is null`,
  `create index evidence_links_target_idx on core.evidence_links(target_type, target_id) where unlinked_at is null`,
  `create table core.request_comments (
    id uuid primary key default gen_random_uuid(),
    owner_tenant_id uuid not null references core.tenants(id),
    project_id uuid not null,
    request_id uuid not null,
    author_user_id uuid not null references "user"(id),
    kind text not null default 'comment' check (kind in ('comment','return','resubmit','not_applicable','system')),
    body text not null check (length(btrim(body)) between 1 and 4000),
    created_at timestamptz not null default now(),
    foreign key (project_id, request_id) references core.data_requests(project_id, id)
  )`,

  // ---------------------------------------------------------------- source imports (G3-05)
  `create table core.source_imports (
    id uuid primary key default gen_random_uuid(),
    owner_tenant_id uuid not null references core.tenants(id),
    project_id uuid not null,
    cycle_id uuid not null,
    campaign_id uuid,
    evidence_id uuid not null,
    sha256 char(64) not null,
    file_name text not null,
    sheet text,
    status text not null default 'previewed' check (status in ('previewed','committed','rolled_back')),
    mapping jsonb not null default '{}'::jsonb,
    rows_total integer not null default 0,
    rows_valid integer not null default 0,
    rows_error integer not null default 0,
    errors jsonb not null default '[]'::jsonb,
    -- rows as the server parsed and validated them at preview; commit uses these, never client-sent rows
    parsed jsonb not null default '[]'::jsonb,
    created_versions uuid[] not null default '{}',
    created_by uuid not null references "user"(id),
    created_at timestamptz not null default now(),
    committed_at timestamptz,
    rolled_back_at timestamptz,
    row_version bigint not null default 1,
    foreign key (owner_tenant_id, project_id) references core.projects(owner_tenant_id, id),
    foreign key (project_id, cycle_id) references core.reporting_cycles(project_id, id),
    foreign key (owner_tenant_id, evidence_id) references core.evidence_objects(owner_tenant_id, id)
  )`,
  `create unique index source_imports_once on core.source_imports(project_id, sha256) where status = 'committed'`,
  `alter table core.observation_versions add constraint observation_import_fk foreign key (import_id) references core.source_imports(id)`,

  // ---------------------------------------------------------------- notifications (G3-08)
  `create table core.notifications (
    id bigint generated always as identity primary key,
    user_id uuid not null references "user"(id) on delete cascade,
    owner_tenant_id uuid references core.tenants(id),
    project_id uuid,
    kind text not null,
    payload jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    read_at timestamptz
  )`,
  `create index notifications_user_idx on core.notifications(user_id, created_at desc)`,

  // ---------------------------------------------------------------- supplier grant role (G3-10)
  `alter table core.external_grants drop constraint external_grants_role_check`,
  `alter table core.external_grants add constraint external_grants_role_check check (role in (${GRANT_ROLES_NEW}))`,

  // ---------------------------------------------------------------- who sees every task of a project
  `create function authz.sees_all_tasks(owner uuid, project uuid) returns boolean language sql stable security definer
   set search_path = pg_catalog, core as
   $$ select (owner = authz.acting_tenant() and authz.is_member(owner) and not authz.has_role(owner, array['contributor']))
          or authz.is_steward(owner)
          or coalesce(authz.grant_role(project) in ('preparer','methodology','reviewer','assurance'), false) $$`,
  `alter function authz.sees_all_tasks(uuid, uuid) owner to isoline_rls`,
  `revoke all on function authz.sees_all_tasks(uuid, uuid) from public`,
  `grant execute on function authz.sees_all_tasks(uuid, uuid) to isoline_app, isoline_system, isoline_rls`,

  ...["data_campaigns", "data_requests"].map((t) => `create trigger ${t}_touch before update on core.${t} for each row execute function core.touch_row()`),
  `create trigger source_imports_touch before update on core.source_imports for each row execute function core.touch_version()`,

  // ---------------------------------------------------------------- privileges
  `grant select on core.metric_definitions to isoline_app`,
  `grant select, insert, update, delete on core.metric_definitions to isoline_system`,
  `grant select, insert, update on core.data_campaigns, core.data_requests, core.observation_versions, core.evidence_links, core.source_imports to isoline_app`,
  `grant select, insert on core.request_comments to isoline_app`,
  `grant select, update (read_at) on core.notifications to isoline_app`,
  `grant usage on all sequences in schema core to isoline_app`,
  `grant select, insert, update on core.data_campaigns, core.data_requests, core.observation_versions, core.evidence_links, core.source_imports, core.request_comments, core.notifications to isoline_system`,
  `grant delete on core.observation_versions, core.evidence_links, core.request_comments, core.data_requests, core.data_campaigns, core.source_imports, core.notifications to isoline_system`,
  `grant usage on all sequences in schema core to isoline_system`,

  // ---------------------------------------------------------------- row-level security
  ...T("data_campaigns"),
  `create policy campaigns_read on core.data_campaigns for select using (authz.can_read(owner_tenant_id, project_id))`,
  `create policy campaigns_insert on core.data_campaigns for insert with check (authz.can_write(owner_tenant_id, project_id))`,
  `create policy campaigns_update on core.data_campaigns for update using (authz.can_write(owner_tenant_id, project_id)) with check (authz.can_write(owner_tenant_id, project_id))`,
  ...T("data_requests"),
  `create policy requests_read on core.data_requests for select using (
     authz.can_read(owner_tenant_id, project_id)
     and (authz.sees_all_tasks(owner_tenant_id, project_id) or assignee_user_id = authz.uid() or reviewer_user_id = authz.uid()))`,
  `create policy requests_insert on core.data_requests for insert with check (authz.can_write(owner_tenant_id, project_id))`,
  `create policy requests_update on core.data_requests for update using (
     authz.can_read(owner_tenant_id, project_id)
     and (authz.can_write(owner_tenant_id, project_id) or assignee_user_id = authz.uid())
     and (authz.sees_all_tasks(owner_tenant_id, project_id) or assignee_user_id = authz.uid() or reviewer_user_id = authz.uid()))
   with check (authz.can_read(owner_tenant_id, project_id))`,
  ...T("observation_versions"),
  `create policy observations_read on core.observation_versions for select using (exists (select 1 from core.data_requests r where r.id = request_id))`,
  // the assignee enters a value; a data lead may enter values by file import (then cannot accept them: CHECK above)
  `create policy observations_insert on core.observation_versions for insert with check (
     entered_by = authz.uid() and exists (select 1 from core.data_requests r where r.id = request_id
       and (r.assignee_user_id = authz.uid() or (authz.can_write(r.owner_tenant_id, r.project_id) and authz.sees_all_tasks(r.owner_tenant_id, r.project_id)))))`,
  `create policy observations_update on core.observation_versions for update using (exists (select 1 from core.data_requests r where r.id = request_id)) with check (exists (select 1 from core.data_requests r where r.id = request_id))`,
  ...T("evidence_links"),
  `create policy evidence_links_read on core.evidence_links for select using (authz.can_read(owner_tenant_id, project_id))`,
  `create policy evidence_links_insert on core.evidence_links for insert with check (
     linked_by = authz.uid() and (authz.can_write(owner_tenant_id, project_id)
       or (authz.grant_role(project_id) = 'supplier' and target_type in ('data_request','observation_version'))))`,
  `create policy evidence_links_update on core.evidence_links for update using (authz.can_read(owner_tenant_id, project_id)) with check (authz.can_read(owner_tenant_id, project_id))`,
  ...T("request_comments"),
  `create policy comments_read on core.request_comments for select using (exists (select 1 from core.data_requests r where r.id = request_id))`,
  `create policy comments_insert on core.request_comments for insert with check (author_user_id = authz.uid() and exists (select 1 from core.data_requests r where r.id = request_id))`,
  ...T("source_imports"),
  `create policy imports_read on core.source_imports for select using (authz.can_read(owner_tenant_id, project_id))`,
  `create policy imports_insert on core.source_imports for insert with check (authz.can_write(owner_tenant_id, project_id))`,
  `create policy imports_update on core.source_imports for update using (authz.can_write(owner_tenant_id, project_id)) with check (authz.can_write(owner_tenant_id, project_id))`,
  ...T("notifications"),
  `create policy notifications_own on core.notifications for select using (user_id = authz.uid())`,
  `create policy notifications_read_mark on core.notifications for update using (user_id = authz.uid()) with check (user_id = authz.uid())`,
  // a supplier uploads evidence for its own requests: widen the evidence insert policy for that grant only
  `drop policy evidence_insert on core.evidence_objects`,
  `create policy evidence_insert on core.evidence_objects for insert with check (uploaded_by = authz.uid() and (authz.can_write(owner_tenant_id, project_id) or authz.grant_role(project_id) = 'supplier'))`,
];

const DOWN: string[] = [
  "drop policy if exists evidence_insert on core.evidence_objects",
  "create policy evidence_insert on core.evidence_objects for insert with check (uploaded_by = authz.uid() and authz.can_write(owner_tenant_id, project_id))",
  "drop table if exists core.notifications",
  "alter table core.observation_versions drop constraint if exists observation_import_fk",
  "drop table if exists core.source_imports",
  "drop table if exists core.request_comments",
  "drop table if exists core.evidence_links",
  "drop table if exists core.observation_versions",
  "drop table if exists core.data_requests",
  "drop table if exists core.data_campaigns",
  "drop table if exists core.metric_definitions",
  "drop function if exists authz.sees_all_tasks(uuid, uuid)",
  "delete from core.consent_records where grant_id in (select id from core.external_grants where role = 'supplier')",
  "delete from core.external_grants where role = 'supplier'",
  "alter table core.external_grants drop constraint if exists external_grants_role_check",
  `alter table core.external_grants add constraint external_grants_role_check check (role in (${GRANT_ROLES_OLD}))`,
];

export async function up(db: Kysely<unknown>): Promise<void> {
  for (const s of UP) await sql.raw(s).execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  for (const s of DOWN) await sql.raw(s).execute(db);
}
