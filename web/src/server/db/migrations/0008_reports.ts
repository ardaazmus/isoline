/**
 * G6 (plan 10): report studio and release.
 *   - reports / report_sections / report_section_versions: a report of one cycle built from a template outline;
 *     each section is versioned text; the reviewer of a version is never its author (CHECK).
 *   - metric_references: a number in the text is a reference to one metric fact version, never typed digits; a
 *     newer revision of that fact makes the reference stale.
 *   - report_approvals: technical review, customer review and management sign-off, each bound to the digest of the
 *     exact release candidate it approved.
 *   - report_releases / release_assets: immutable releases (manifest + digest, frozen cycle snapshot, assets with
 *     SHA-256); a correction is an amended release that points to the one it replaces.
 *   - design_proofs: proof PDFs a design partner uploads for a release, decided by the customer.
 *   - A "design" grant reads releases and their assets only: authz.can_read no longer counts it, and the release
 *     tables use authz.can_read_release (plan 10 §7: the agency never sees raw data).
 */
import { sql, type Kysely } from "kysely";

const T = (name: string) => [`alter table core.${name} enable row level security`, `alter table core.${name} force row level security`];

const UP: string[] = [
  `create or replace function authz.can_read(owner uuid, project uuid) returns boolean language sql stable as
   $$ select (owner = authz.acting_tenant() and authz.is_member(owner))
          or authz.is_steward(owner)
          or (project is not null and coalesce(authz.grant_role(project), 'design') <> 'design') $$`,
  `create function authz.can_read_release(owner uuid, project uuid) returns boolean language sql stable as
   $$ select authz.can_read(owner, project) or (project is not null and authz.grant_role(project) = 'design') $$`,

  `create table core.reports (
    id uuid primary key default gen_random_uuid(),
    owner_tenant_id uuid not null references core.tenants(id),
    project_id uuid not null,
    cycle_id uuid not null,
    template_id text not null check (template_id ~ '^[a-z0-9_]+$'),
    kind text not null check (kind in ('sustainability','annual','carbon','finance')),
    title text not null check (length(btrim(title)) between 1 and 200),
    language text not null default 'tr' check (language in ('tr','en')),
    status text not null default 'drafting' check (status in ('drafting','tech_review','customer_review','management_signoff','released')),
    created_by uuid not null references "user"(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    row_version bigint not null default 1,
    foreign key (owner_tenant_id, project_id) references core.projects(owner_tenant_id, id),
    foreign key (project_id, cycle_id) references core.reporting_cycles(project_id, id),
    unique (owner_tenant_id, id),
    unique (project_id, id)
  )`,
  `create trigger reports_touch before update on core.reports for each row execute function core.touch_version()`,
  `create table core.report_sections (
    id uuid primary key default gen_random_uuid(),
    owner_tenant_id uuid not null references core.tenants(id),
    project_id uuid not null,
    report_id uuid not null,
    section_key text not null check (section_key ~ '^[a-z0-9_]+$'),
    position integer not null,
    refs text[] not null default '{}',
    tools text[] not null default '{}',
    owner_user_id uuid references "user"(id),
    due_on date,
    status text not null default 'empty' check (status in ('empty','draft','submitted','approved')),
    current_version_id uuid,
    foreign key (project_id, report_id) references core.reports(project_id, id) on delete cascade,
    unique (report_id, section_key),
    unique (project_id, id)
  )`,
  `create table core.report_section_versions (
    id uuid primary key default gen_random_uuid(),
    owner_tenant_id uuid not null references core.tenants(id),
    project_id uuid not null,
    section_id uuid not null,
    version integer not null check (version >= 1),
    body text not null check (length(body) <= 100000),
    author_id uuid not null references "user"(id),
    author_tenant_id uuid references core.tenants(id),
    status text not null default 'draft' check (status in ('draft','submitted','approved','rejected','superseded')),
    reviewed_by uuid references "user"(id),
    reviewed_at timestamptz,
    review_note text,
    created_at timestamptz not null default now(),
    foreign key (project_id, section_id) references core.report_sections(project_id, id) on delete cascade,
    unique (section_id, version),
    check (reviewed_by is null or reviewed_by <> author_id),
    check (status <> 'rejected' or length(btrim(coalesce(review_note, ''))) >= 10)
  )`,
  `create table core.metric_references (
    id uuid primary key default gen_random_uuid(),
    owner_tenant_id uuid not null references core.tenants(id),
    project_id uuid not null,
    section_version_id uuid not null references core.report_section_versions(id) on delete cascade,
    token text not null,
    fact_id uuid references core.metric_fact_versions(id),
    rendered text,
    unit text,
    created_at timestamptz not null default now()
  )`,
  `create index metric_references_version_idx on core.metric_references(section_version_id)`,
  `create index metric_references_fact_idx on core.metric_references(fact_id)`,
  `create table core.report_approvals (
    id uuid primary key default gen_random_uuid(),
    owner_tenant_id uuid not null references core.tenants(id),
    project_id uuid not null,
    report_id uuid not null,
    stage text not null check (stage in ('tech_review','customer_review','management_signoff')),
    decision text not null check (decision in ('approved','changes_requested')),
    candidate_sha256 char(64) not null,
    comment text,
    user_id uuid not null references "user"(id),
    acting_tenant_id uuid references core.tenants(id),
    decided_at timestamptz not null default now(),
    foreign key (project_id, report_id) references core.reports(project_id, id) on delete cascade,
    check (decision <> 'changes_requested' or length(btrim(coalesce(comment, ''))) >= 10)
  )`,
  `create table core.report_releases (
    id uuid primary key default gen_random_uuid(),
    owner_tenant_id uuid not null references core.tenants(id),
    project_id uuid not null,
    report_id uuid not null,
    version integer not null check (version >= 1),
    status text not null default 'released' check (status in ('released','superseded')),
    manifest jsonb not null,
    manifest_sha256 char(64) not null,
    snapshot_id uuid not null references core.cycle_snapshots(id),
    amendment_of uuid references core.report_releases(id),
    amendment_reason text,
    signoff_id uuid not null references core.report_approvals(id),
    released_by uuid not null references "user"(id),
    released_at timestamptz not null default now(),
    foreign key (project_id, report_id) references core.reports(project_id, id),
    unique (report_id, version),
    check (amendment_of is null or length(btrim(coalesce(amendment_reason, ''))) >= 20)
  )`,
  `create table core.release_assets (
    id uuid primary key default gen_random_uuid(),
    owner_tenant_id uuid not null references core.tenants(id),
    project_id uuid not null,
    release_id uuid not null references core.report_releases(id),
    path text not null check (path ~ '^[a-z0-9_./-]+$'),
    mime text not null,
    sha256 char(64) not null,
    size_bytes bigint not null,
    storage_key text not null unique,
    created_at timestamptz not null default now(),
    unique (release_id, path)
  )`,
  `create table core.design_proofs (
    id uuid primary key default gen_random_uuid(),
    owner_tenant_id uuid not null references core.tenants(id),
    project_id uuid not null,
    release_id uuid not null references core.report_releases(id),
    version integer not null,
    filename text not null,
    storage_key text not null unique,
    sha256 char(64) not null,
    size_bytes bigint not null,
    uploaded_by uuid not null references "user"(id),
    uploaded_at timestamptz not null default now(),
    status text not null default 'submitted' check (status in ('submitted','changes_requested','approved')),
    decided_by uuid references "user"(id),
    decided_at timestamptz,
    decision_note text,
    unique (release_id, version),
    check (decided_by is null or decided_by <> uploaded_by),
    check (status <> 'changes_requested' or length(btrim(coalesce(decision_note, ''))) >= 10)
  )`,

  // ---------------------------------------------------------------- privileges and RLS
  `grant select, insert on core.reports, core.report_sections, core.report_section_versions, core.metric_references, core.report_approvals, core.report_releases, core.release_assets, core.design_proofs to isoline_app`,
  `grant update (status, title, language) on core.reports to isoline_app`,
  `grant update (status, current_version_id, owner_user_id, due_on) on core.report_sections to isoline_app`,
  `grant update (status, reviewed_by, reviewed_at, review_note) on core.report_section_versions to isoline_app`,
  `grant update (status) on core.report_releases to isoline_app`,
  `grant update (status, decided_by, decided_at, decision_note) on core.design_proofs to isoline_app`,
  `grant select, insert, update, delete on core.reports, core.report_sections, core.report_section_versions, core.metric_references, core.report_approvals, core.report_releases, core.release_assets, core.design_proofs to isoline_system`,
  ...["reports", "report_sections", "report_section_versions", "metric_references", "report_approvals"].flatMap((t) => [
    ...T(t),
    `create policy ${t}_read on core.${t} for select using (authz.can_read(owner_tenant_id, project_id))`,
    `create policy ${t}_insert on core.${t} for insert with check (authz.can_write(owner_tenant_id, project_id) or (authz.grant_role(project_id) = 'reviewer' and '${t}' = 'report_approvals'))`,
    ...(t === "metric_references" || t === "report_approvals" ? [] : [`create policy ${t}_update on core.${t} for update using (authz.can_write(owner_tenant_id, project_id) or authz.grant_role(project_id) = 'reviewer') with check (authz.can_write(owner_tenant_id, project_id) or authz.grant_role(project_id) = 'reviewer')`]),
  ]),
  ...["report_releases", "release_assets", "design_proofs"].flatMap((t) => [
    ...T(t),
    `create policy ${t}_read on core.${t} for select using (authz.can_read_release(owner_tenant_id, project_id))`,
    t === "design_proofs"
      ? `create policy ${t}_insert on core.${t} for insert with check (authz.can_write(owner_tenant_id, project_id) or authz.grant_role(project_id) = 'design')`
      : `create policy ${t}_insert on core.${t} for insert with check (authz.can_write(owner_tenant_id, project_id))`,
    `create policy ${t}_update on core.${t} for update using (authz.can_write(owner_tenant_id, project_id)) with check (authz.can_write(owner_tenant_id, project_id))`,
  ]),
];

const DOWN: string[] = [
  "drop table if exists core.design_proofs",
  "drop table if exists core.release_assets",
  "drop table if exists core.report_releases",
  "drop table if exists core.report_approvals",
  "drop table if exists core.metric_references",
  "drop table if exists core.report_section_versions",
  "drop table if exists core.report_sections",
  "drop table if exists core.reports",
  "drop function if exists authz.can_read_release(uuid, uuid)",
  `create or replace function authz.can_read(owner uuid, project uuid) returns boolean language sql stable as
   $$ select (owner = authz.acting_tenant() and authz.is_member(owner))
          or authz.is_steward(owner)
          or (project is not null and authz.grant_role(project) is not null) $$`,
];

export async function up(db: Kysely<unknown>): Promise<void> {
  for (const s of UP) await sql.raw(s).execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  for (const s of DOWN) await sql.raw(s).execute(db);
}
