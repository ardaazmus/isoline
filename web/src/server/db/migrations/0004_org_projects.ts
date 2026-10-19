/**
 * G2 (plan 03 §2, 05 §1–2, 06 §2): the reporting organisation and the work around it.
 *   organisation → legal entities → facilities, with dated ownership/control edges (no overlapping periods);
 *   engagements and deliverables (one contract, several reports);
 *   projects gain organisation and engagement; reporting cycles per project (periods never overlap);
 *   versioned reporting boundaries (operational control, financial control, equity share, financial reporting,
 *   CBAM installation) with members and reasons;
 *   framework versions (global catalogue) and applicability assessments with a named expert decision;
 *   participants with RACI roles; work packages with dependencies (the 13-gate plan).
 * Every tenant table: owner_tenant_id, composite FKs that keep children in the same tenant, FORCE RLS.
 */
import { sql, type Kysely } from "kysely";

const T = (name: string) => [
  `alter table core.${name} enable row level security`,
  `alter table core.${name} force row level security`,
];

const UP: string[] = [
  // ---------------------------------------------------------------- organisation tree
  `create table core.organizations (
    id uuid primary key default gen_random_uuid(),
    owner_tenant_id uuid not null references core.tenants(id),
    name text not null check (length(btrim(name)) between 1 and 200),
    country_code char(2) not null default 'TR' check (country_code ~ '^[A-Z]{2}$'),
    sector_code text check (sector_code is null or sector_code ~ '^[A-U]([0-9]{2}(\\.[0-9]{1,2})?)?$'),
    fiscal_year_start_month smallint not null default 1 check (fiscal_year_start_month between 1 and 12),
    mapping_status text not null default 'mapped' check (mapping_status in ('mapped','unmapped')),
    legacy_import_id uuid references core.legacy_imports(id),
    created_by uuid not null references "user"(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    row_version bigint not null default 1,
    unique (owner_tenant_id, id)
  )`,
  `create table core.legal_entities (
    id uuid primary key default gen_random_uuid(),
    owner_tenant_id uuid not null references core.tenants(id),
    organization_id uuid not null,
    name text not null check (length(btrim(name)) between 1 and 200),
    country_code char(2) not null default 'TR' check (country_code ~ '^[A-Z]{2}$'),
    tax_id text check (tax_id is null or tax_id ~ '^[0-9A-Za-z-]{5,20}$'),
    trade_registry_no text,
    entity_type text not null default 'unlisted_company' check (entity_type in ('listed','bank','bank_tmsf','nonbank_fi','insurer','capital_markets_fi','precious_metals','unlisted_company','public_body')),
    is_reporting_parent boolean not null default false,
    valid_from date,
    valid_to date,
    created_by uuid not null references "user"(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    row_version bigint not null default 1,
    foreign key (owner_tenant_id, organization_id) references core.organizations(owner_tenant_id, id),
    unique (owner_tenant_id, id),
    check (valid_to is null or valid_from is null or valid_to >= valid_from)
  )`,
  `create unique index legal_entities_one_parent on core.legal_entities(organization_id) where is_reporting_parent`,
  `create table core.ownership_edges (
    id uuid primary key default gen_random_uuid(),
    owner_tenant_id uuid not null references core.tenants(id),
    parent_entity_id uuid not null,
    child_entity_id uuid not null,
    share_pct numeric(7,4) not null check (share_pct > 0 and share_pct <= 100),
    control text not null check (control in ('operational','financial','joint','significant_influence','none')),
    valid_from date not null,
    valid_to date,
    source_note text,
    created_by uuid not null references "user"(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    row_version bigint not null default 1,
    foreign key (owner_tenant_id, parent_entity_id) references core.legal_entities(owner_tenant_id, id),
    foreign key (owner_tenant_id, child_entity_id) references core.legal_entities(owner_tenant_id, id),
    check (parent_entity_id <> child_entity_id),
    check (valid_to is null or valid_to >= valid_from),
    constraint ownership_no_overlap exclude using gist (
      parent_entity_id with =, child_entity_id with =, daterange(valid_from, coalesce(valid_to, 'infinity'::date), '[]') with &&)
  )`,
  `create table core.facilities (
    id uuid primary key default gen_random_uuid(),
    owner_tenant_id uuid not null references core.tenants(id),
    legal_entity_id uuid not null,
    name text not null check (length(btrim(name)) between 1 and 200),
    kind text not null default 'plant' check (kind in ('plant','office','warehouse','store','site','mine','vessel','other')),
    country_code char(2) not null default 'TR' check (country_code ~ '^[A-Z]{2}$'),
    city text,
    nace_code text,
    operated boolean not null default true,
    cbam_installation boolean not null default false,
    responsible_user_id uuid references "user"(id),
    valid_from date,
    valid_to date,
    legacy_site_id text,
    created_by uuid not null references "user"(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    row_version bigint not null default 1,
    foreign key (owner_tenant_id, legal_entity_id) references core.legal_entities(owner_tenant_id, id),
    unique (owner_tenant_id, id),
    check (valid_to is null or valid_from is null or valid_to >= valid_from)
  )`,

  // ---------------------------------------------------------------- engagements and deliverables
  `create table core.engagements (
    id uuid primary key default gen_random_uuid(),
    owner_tenant_id uuid not null references core.tenants(id),
    advisory_tenant_id uuid references core.tenants(id),
    title text not null check (length(btrim(title)) between 1 and 200),
    scope text,
    status text not null default 'draft' check (status in ('draft','accepted','active','review','paused','closed','cancelled')),
    starts_on date,
    ends_on date,
    created_by uuid not null references "user"(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    row_version bigint not null default 1,
    unique (owner_tenant_id, id),
    check (advisory_tenant_id is null or advisory_tenant_id <> owner_tenant_id),
    check (ends_on is null or starts_on is null or ends_on >= starts_on)
  )`,
  `alter table core.projects add column organization_id uuid, add column engagement_id uuid, add column description text,
    add constraint projects_org_fk foreign key (owner_tenant_id, organization_id) references core.organizations(owner_tenant_id, id),
    add constraint projects_engagement_fk foreign key (owner_tenant_id, engagement_id) references core.engagements(owner_tenant_id, id)`,
  `create table core.deliverables (
    id uuid primary key default gen_random_uuid(),
    owner_tenant_id uuid not null references core.tenants(id),
    engagement_id uuid not null,
    project_id uuid,
    title text not null check (length(btrim(title)) between 1 and 200),
    report_kind text not null check (report_kind in ('tsrs','gri','esrs','vsme','annual_report','integrated','ghg_inventory','cbam','tr_ets','cdp','other')),
    due_on date,
    status text not null default 'planned' check (status in ('planned','in_progress','delivered','accepted','cancelled')),
    created_by uuid not null references "user"(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    row_version bigint not null default 1,
    foreign key (owner_tenant_id, engagement_id) references core.engagements(owner_tenant_id, id),
    foreign key (owner_tenant_id, project_id) references core.projects(owner_tenant_id, id)
  )`,

  // ---------------------------------------------------------------- cycles and boundaries
  `alter table core.projects add constraint projects_project_id_uq unique (id, owner_tenant_id)`,
  `create table core.reporting_cycles (
    id uuid primary key default gen_random_uuid(),
    owner_tenant_id uuid not null references core.tenants(id),
    project_id uuid not null,
    label text not null check (length(btrim(label)) between 1 and 120),
    reporting_year smallint not null check (reporting_year between 2000 and 2100),
    period_start date not null,
    period_end date not null,
    publish_due date,
    status text not null default 'planning' check (status in ('planning','collection','calculation','close_review','frozen','released','reopened')),
    is_base_year boolean not null default false,
    created_by uuid not null references "user"(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    row_version bigint not null default 1,
    foreign key (owner_tenant_id, project_id) references core.projects(owner_tenant_id, id),
    unique (owner_tenant_id, id),
    unique (project_id, id),
    check (period_end >= period_start),
    check (publish_due is null or publish_due >= period_end),
    constraint cycles_no_overlap exclude using gist (project_id with =, daterange(period_start, period_end, '[]') with &&)
  )`,
  `create table core.reporting_boundaries (
    id uuid primary key default gen_random_uuid(),
    owner_tenant_id uuid not null references core.tenants(id),
    project_id uuid not null,
    cycle_id uuid not null,
    kind text not null check (kind in ('ghg_operational_control','ghg_financial_control','ghg_equity_share','financial_reporting','cbam_facility_product')),
    revision integer not null default 1 check (revision >= 1),
    status text not null default 'draft' check (status in ('draft','approved','superseded')),
    as_of date not null,
    note text,
    approved_by uuid references "user"(id),
    approved_at timestamptz,
    created_by uuid not null references "user"(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    row_version bigint not null default 1,
    foreign key (owner_tenant_id, project_id) references core.projects(owner_tenant_id, id),
    foreign key (project_id, cycle_id) references core.reporting_cycles(project_id, id),
    unique (cycle_id, kind, revision),
    unique (owner_tenant_id, id),
    unique (project_id, id),
    check ((status = 'approved') = (approved_by is not null and approved_at is not null) or status = 'superseded')
  )`,
  // one approved and at most one draft revision per cycle and kind; approving the draft supersedes the old one
  `create unique index boundaries_one_approved on core.reporting_boundaries(cycle_id, kind) where status = 'approved'`,
  `create unique index boundaries_one_draft on core.reporting_boundaries(cycle_id, kind) where status = 'draft'`,
  `create table core.boundary_members (
    id uuid primary key default gen_random_uuid(),
    owner_tenant_id uuid not null references core.tenants(id),
    project_id uuid not null,
    boundary_id uuid not null,
    legal_entity_id uuid,
    facility_id uuid,
    included boolean not null,
    inclusion_pct numeric(7,4) not null check (inclusion_pct between 0 and 100),
    suggested_pct numeric(7,4) check (suggested_pct is null or suggested_pct between 0 and 100),
    reason text,
    foreign key (owner_tenant_id, boundary_id) references core.reporting_boundaries(owner_tenant_id, id),
    foreign key (project_id, boundary_id) references core.reporting_boundaries(project_id, id) on delete cascade,
    foreign key (owner_tenant_id, legal_entity_id) references core.legal_entities(owner_tenant_id, id),
    foreign key (owner_tenant_id, facility_id) references core.facilities(owner_tenant_id, id),
    check ((legal_entity_id is null) <> (facility_id is null)),
    check (included or inclusion_pct = 0),
    -- a manual change from the rule's suggestion carries its reason
    check (suggested_pct is null or inclusion_pct = suggested_pct or length(btrim(coalesce(reason, ''))) >= 5)
  )`,
  `create unique index boundary_members_entity on core.boundary_members(boundary_id, legal_entity_id) where legal_entity_id is not null`,
  `create unique index boundary_members_facility on core.boundary_members(boundary_id, facility_id) where facility_id is not null`,

  // ---------------------------------------------------------------- frameworks and applicability (ADR-010)
  `create table core.framework_versions (
    id text primary key check (id ~ '^[a-z0-9_]+@[0-9a-z._-]+$'),
    pack text not null,
    version text not null,
    title text not null,
    jurisdiction text not null check (jurisdiction in ('TR','EU','GLOBAL')),
    status text not null check (status in ('draft','published_future_effective','effective','superseded','revoked')),
    published_on date,
    effective_from date,
    effective_to date,
    source_ids text[] not null default '{}',
    checked_on date not null,
    note text,
    unique (pack, version)
  )`,
  `create table core.applicability_assessments (
    id uuid primary key default gen_random_uuid(),
    owner_tenant_id uuid not null references core.tenants(id),
    project_id uuid not null,
    cycle_id uuid not null,
    regime text not null check (regime ~ '^[a-z0-9_]+$'),
    framework_version_id text references core.framework_versions(id),
    engine_version text not null,
    inputs jsonb not null,
    inputs_digest char(64) not null,
    suggestion text not null check (suggestion in ('required','voluntary','not_applicable','review','indirect')),
    first_year smallint,
    notes text[] not null default '{}',
    source_ids text[] not null default '{}',
    decision text check (decision in ('in_scope','voluntary','not_applicable','needs_review')),
    decided_by uuid references "user"(id),
    decided_at timestamptz,
    rationale text,
    decision_source text,
    -- the customer's accountable person confirms a decision prepared by someone else (RACI: scope A = customer owner)
    confirmed_by uuid references "user"(id),
    confirmed_at timestamptz,
    superseded_at timestamptz,
    created_by uuid not null references "user"(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    row_version bigint not null default 1,
    foreign key (owner_tenant_id, project_id) references core.projects(owner_tenant_id, id),
    foreign key (project_id, cycle_id) references core.reporting_cycles(project_id, id),
    check (decision is null or (decided_by is not null and decided_at is not null and length(btrim(coalesce(rationale, ''))) >= 10)),
    check (confirmed_by is null or (decision is not null and confirmed_at is not null))
  )`,
  `create unique index assessments_current on core.applicability_assessments(cycle_id, regime) where superseded_at is null`,

  // ---------------------------------------------------------------- team and plan
  `create table core.project_participants (
    id uuid primary key default gen_random_uuid(),
    owner_tenant_id uuid not null references core.tenants(id),
    project_id uuid not null,
    user_id uuid not null references "user"(id),
    member_tenant_id uuid not null references core.tenants(id),
    raci_role text not null check (raci_role in ('project_lead','data_lead','data_owner','contributor','technical_reviewer','report_editor','management_signer','advisor_preparer','advisor_reviewer','assurance','design')),
    responsibilities text,
    facility_ids uuid[] not null default '{}',
    added_by uuid not null references "user"(id),
    created_at timestamptz not null default now(),
    revoked_at timestamptz,
    revoked_by uuid references "user"(id),
    foreign key (owner_tenant_id, project_id) references core.projects(owner_tenant_id, id)
  )`,
  `create unique index participants_active on core.project_participants(project_id, user_id, raci_role) where revoked_at is null`,
  `create table core.work_packages (
    id uuid primary key default gen_random_uuid(),
    owner_tenant_id uuid not null references core.tenants(id),
    project_id uuid not null,
    cycle_id uuid not null,
    gate text not null check (gate ~ '^G([0-9]|1[0-2])$'),
    title text not null check (length(btrim(title)) between 1 and 200),
    status text not null default 'not_ready' check (status in ('not_ready','ready','active','review','done','blocked','rework')),
    responsible_user_id uuid references "user"(id),
    accountable_user_id uuid references "user"(id),
    starts_on date not null,
    due_on date not null,
    critical boolean not null default false,
    blocked_reason text,
    sort smallint not null default 0,
    created_by uuid not null references "user"(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    row_version bigint not null default 1,
    foreign key (owner_tenant_id, project_id) references core.projects(owner_tenant_id, id),
    foreign key (project_id, cycle_id) references core.reporting_cycles(project_id, id),
    unique (owner_tenant_id, id),
    unique (project_id, id),
    check (due_on >= starts_on),
    check (status <> 'blocked' or length(btrim(coalesce(blocked_reason, ''))) >= 3)
  )`,
  `create table core.work_package_deps (
    owner_tenant_id uuid not null references core.tenants(id),
    project_id uuid not null,
    work_package_id uuid not null,
    depends_on_id uuid not null,
    primary key (work_package_id, depends_on_id),
    foreign key (project_id, work_package_id) references core.work_packages(project_id, id) on delete cascade,
    foreign key (project_id, depends_on_id) references core.work_packages(project_id, id) on delete cascade,
    check (work_package_id <> depends_on_id)
  )`,

  // ---------------------------------------------------------------- row versions
  ...["organizations", "legal_entities", "ownership_edges", "facilities", "engagements", "deliverables", "reporting_cycles", "reporting_boundaries", "applicability_assessments", "work_packages"].map(
    (t) => `create trigger ${t}_touch before update on core.${t} for each row execute function core.touch_row()`,
  ),

  // ---------------------------------------------------------------- privileges
  `grant select, insert, update on core.organizations, core.legal_entities, core.ownership_edges, core.facilities, core.engagements, core.deliverables,
     core.reporting_cycles, core.reporting_boundaries, core.boundary_members, core.applicability_assessments, core.project_participants, core.work_packages, core.work_package_deps to isoline_app`,
  `grant delete on core.boundary_members, core.work_package_deps to isoline_app`,
  `grant select on core.framework_versions to isoline_app`,
  `grant select, insert, update on core.organizations, core.legal_entities, core.ownership_edges, core.facilities, core.engagements, core.deliverables,
     core.reporting_cycles, core.reporting_boundaries, core.boundary_members, core.applicability_assessments, core.project_participants, core.work_packages, core.work_package_deps to isoline_system`,
  `grant delete on core.boundary_members, core.work_package_deps, core.work_packages, core.reporting_cycles, core.reporting_boundaries, core.applicability_assessments, core.project_participants, core.deliverables, core.facilities, core.ownership_edges, core.legal_entities, core.organizations to isoline_system`,
  `grant select, insert, update on core.framework_versions to isoline_system`,
  `grant select on core.engagements to isoline_rls`,
  // an advisory named on an engagement may read the customer's name (not its data)
  `create function authz.is_engaged_by(owner uuid) returns boolean language sql stable security definer
   set search_path = pg_catalog, core as
   $$ select authz.acting_member() and exists (select 1 from core.engagements e where e.owner_tenant_id = owner
        and e.advisory_tenant_id = authz.acting_tenant() and e.status not in ('cancelled')) $$`,
  `alter function authz.is_engaged_by(uuid) owner to isoline_rls`,
  `revoke all on function authz.is_engaged_by(uuid) from public`,
  `grant execute on function authz.is_engaged_by(uuid) to isoline_app, isoline_system, isoline_rls`,
  `drop policy tenants_read on core.tenants`,
  `create policy tenants_read on core.tenants for select using (authz.is_member(id) or authz.is_steward(id) or authz.has_grant_from(id) or authz.is_engaged_by(id))`,

  // ---------------------------------------------------------------- row-level security
  ...["organizations", "legal_entities", "ownership_edges", "facilities"].flatMap((t) => [
    ...T(t),
    // the customer's tree is readable by members, the steward and any workspace holding an active grant from it
    `create policy ${t}_read on core.${t} for select using (authz.can_read(owner_tenant_id, null) or authz.has_grant_from(owner_tenant_id))`,
    `create policy ${t}_insert on core.${t} for insert with check (authz.can_write(owner_tenant_id, null))`,
    `create policy ${t}_update on core.${t} for update using (authz.can_write(owner_tenant_id, null)) with check (authz.can_write(owner_tenant_id, null))`,
  ]),
  ...T("engagements"),
  `create policy engagements_read on core.engagements for select using (authz.can_read(owner_tenant_id, null) or (advisory_tenant_id = authz.acting_tenant() and authz.acting_member()))`,
  `create policy engagements_insert on core.engagements for insert with check (authz.can_write(owner_tenant_id, null))`,
  `create policy engagements_update on core.engagements for update using (authz.can_write(owner_tenant_id, null)) with check (authz.can_write(owner_tenant_id, null))`,
  ...T("deliverables"),
  `create policy deliverables_read on core.deliverables for select using (
     authz.can_read(owner_tenant_id, project_id)
     or exists (select 1 from core.engagements e where e.id = engagement_id and e.advisory_tenant_id = authz.acting_tenant() and authz.acting_member()))`,
  `create policy deliverables_insert on core.deliverables for insert with check (authz.can_write(owner_tenant_id, null))`,
  `create policy deliverables_update on core.deliverables for update using (authz.can_write(owner_tenant_id, null)) with check (authz.can_write(owner_tenant_id, null))`,
  ...["reporting_cycles", "reporting_boundaries", "boundary_members", "applicability_assessments", "project_participants", "work_packages", "work_package_deps"].flatMap((t) => [
    ...T(t),
    `create policy ${t}_read on core.${t} for select using (authz.can_read(owner_tenant_id, project_id))`,
    `create policy ${t}_insert on core.${t} for insert with check (authz.can_write(owner_tenant_id, project_id))`,
    `create policy ${t}_update on core.${t} for update using (authz.can_write(owner_tenant_id, project_id)) with check (authz.can_write(owner_tenant_id, project_id))`,
  ]),
  `create policy boundary_members_delete on core.boundary_members for delete using (authz.can_write(owner_tenant_id, project_id))`,
  `create policy work_package_deps_delete on core.work_package_deps for delete using (authz.can_write(owner_tenant_id, project_id))`,

  // ---------------------------------------------------------------- indexes
  `create index legal_entities_org_idx on core.legal_entities(owner_tenant_id, organization_id)`,
  `create index facilities_entity_idx on core.facilities(owner_tenant_id, legal_entity_id)`,
  `create index ownership_child_idx on core.ownership_edges(owner_tenant_id, child_entity_id)`,
  `create index cycles_project_idx on core.reporting_cycles(owner_tenant_id, project_id, period_start desc)`,
  `create index work_packages_scope_idx on core.work_packages(owner_tenant_id, project_id, status, due_on)`,
  `create index participants_user_idx on core.project_participants(user_id) where revoked_at is null`,
];


// Framework versions known on 19.10.2026 (plan 07 §1; source ids from web/src/data/sources.ts). Status follows the
// effective date: a published text that is not yet in force is "published_future_effective" (plan 07 §2).
const FRAMEWORKS: [string, string, string, string, "TR" | "EU" | "GLOBAL", string, string | null, string | null, string | null, string[], string | null][] = [
  // id, pack, version, title, jurisdiction, status, published_on, effective_from, effective_to, sources, note
  ["tsrs@2024", "tsrs", "2024", "TSRS 1 ve TSRS 2 (KGK)", "TR", "effective", "2023-12-29", "2024-01-01", null, ["tsrs1", "tsrs2", "kgk_scope_decision", "kgk_scope_2026", "kgk_relief_ext"], "Kapsam eşikleri 2025 ve sonrası için KGK 13.01.2026 kararı"],
  ["tsrs2_ghg@2026", "tsrs2_ghg", "2026", "TSRS 2 sera gazı değişiklikleri", "TR", "effective", "2026-07-28", null, null, ["tsrs2_amend"], "Uygulama başlangıcı değişiklik metninden ayrıca teyit edilmeli"],
  ["gri@2021", "gri", "2021", "GRI 1/2/3 Universal Standards 2021", "GLOBAL", "effective", "2021-10-05", "2023-01-01", null, ["gri_standards"], null],
  ["gri_101@2024", "gri_101", "2024", "GRI 101: Biodiversity 2024", "GLOBAL", "effective", "2024-01-25", "2026-01-01", null, ["gri_standards"], null],
  ["gri_102@2025", "gri_102", "2025", "GRI 102: Climate Change 2025", "GLOBAL", "published_future_effective", "2025-06-25", "2027-01-01", null, ["gri_standards"], "2026 raporlaması için zorunlu değil"],
  ["gri_103@2025", "gri_103", "2025", "GRI 103: Energy 2025", "GLOBAL", "published_future_effective", "2025-06-25", "2027-01-01", null, ["gri_standards"], "2026 raporlaması için zorunlu değil"],
  ["esrs@2023", "esrs", "2023", "ESRS Set 1 (Delegated Reg. 2023/2772)", "EU", "effective", "2023-12-22", "2024-01-01", "2026-12-31", ["esrs_topics", "csrd_omnibus", "stop_clock"], null],
  ["esrs@2026", "esrs", "2026", "Sadeleştirilmiş ESRS (Delegated Reg. 2026/1563)", "EU", "published_future_effective", "2026-09-21", "2027-01-01", null, ["esrs_2026"], "Yürürlük 10.11.2026; 2027 ve sonrası başlayan dönemler"],
  ["vss@2026", "vss", "2026", "AB gönüllü sürdürülebilirlik raporlama standardı (Delegated Reg. 2026/1560)", "EU", "published_future_effective", "2026-09-21", null, null, ["vss_2026"], "Değer zinciri talep sınırı; yürürlük tarihi metinden teyit edilmeli"],
  ["csrd@2026", "csrd", "2026", "CSRD (Directive 2026/470 Omnibus I ile değişik)", "EU", "effective", "2026-02-26", null, null, ["csrd_omnibus"], null],
  ["csddd@2026", "csddd", "2026", "CSDDD (Directive 2026/470 ile değişik)", "EU", "effective", "2026-02-26", null, null, ["csrd_omnibus"], null],
  ["annual_report_tr@2012", "annual_report_tr", "2012", "Yıllık Faaliyet Raporu Asgari İçerik Yönetmeliği (RG 28395)", "TR", "effective", "2012-08-28", "2012-08-28", null, ["ar_min_content", "ttk", "spk_ii_14_1", "bddk_ar"], "Şirket türüne göre SPK ve BDDK ek kuralları"],
  ["cbam@2025", "cbam", "2025", "CBAM Tüzüğü 2023/956 (2025/2083 ile değişik)", "EU", "effective", "2025-10-20", "2026-01-01", null, ["cbam_reg", "cbam_defaults", "cbam_guidance3"], "Kesin dönem 2026"],
  ["tr_ets@2026", "tr_ets", "2026", "Türkiye Emisyon Ticaret Sistemi Yönetmeliği", "TR", "effective", "2026-08-27", "2026-08-27", null, ["tr_ets_reg", "kpk_2026_1", "climate_law"], "Pilot dönem"],
  ["tr_taxonomy@2026", "tr_taxonomy", "2026", "Türkiye Yeşil Taksonomisi Yönetmeliği", "TR", "effective", "2026-09-24", null, null, ["tr_taxonomy"], "Kaynak ikincil; resmî metin ayrıca teyit edilmeli"],
  ["eudr@2025", "eudr", "2025", "EUDR 2023/1115 (2025/2650 ile değişik)", "EU", "effective", null, null, null, ["eudr"], null],
  ["espr@2024", "espr", "2024", "ESPR 2024/1781 — Dijital Ürün Pasaportu", "EU", "effective", "2024-06-28", null, null, ["espr_dpp"], "Ürün grubu uygulama tasarrufları bekleniyor"],
  ["ghg_protocol@2004", "ghg_protocol", "2004", "GHG Protocol Corporate Standard + Scope 2 Guidance", "GLOBAL", "effective", "2004-03-01", null, null, ["ghg_protocol", "ghg_revision"], "ISO ile birleşik standart planı izleniyor"],
  ["cdp@2026", "cdp", "2026", "CDP 2026 bildirim döngüsü", "GLOBAL", "effective", null, null, null, ["cdp_2026"], "Program gereği; puan tahmini sertifika değildir"],
];

const lit = (v: string | null) => (v === null ? "null" : `'${v.replace(/'/g, "''")}'`);
const SEED = FRAMEWORKS.map(
  ([id, pack, version, title, jur, status, pub, from, to, sources, note]) =>
    `insert into core.framework_versions (id, pack, version, title, jurisdiction, status, published_on, effective_from, effective_to, source_ids, checked_on, note) values (${lit(id)}, ${lit(pack)}, ${lit(version)}, ${lit(title)}, ${lit(jur)}, ${lit(status)}, ${lit(pub)}, ${lit(from)}, ${lit(to)}, array[${sources.map(lit).join(",")}]::text[], '2026-10-19', ${lit(note)})`,
);

const DOWN: string[] = [
  "drop policy if exists tenants_read on core.tenants",
  "create policy tenants_read on core.tenants for select using (authz.is_member(id) or authz.is_steward(id) or authz.has_grant_from(id))",
  "drop function if exists authz.is_engaged_by(uuid)",
  "drop table if exists core.work_package_deps",
  "drop table if exists core.work_packages",
  "drop table if exists core.project_participants",
  "drop table if exists core.applicability_assessments",
  "drop table if exists core.framework_versions",
  "drop table if exists core.boundary_members",
  "drop table if exists core.reporting_boundaries",
  "drop table if exists core.reporting_cycles",
  "drop table if exists core.deliverables",
  "alter table core.projects drop constraint if exists projects_project_id_uq, drop constraint if exists projects_org_fk, drop constraint if exists projects_engagement_fk",
  "alter table core.projects drop column if exists organization_id, drop column if exists engagement_id, drop column if exists description",
  "drop table if exists core.engagements",
  "drop table if exists core.facilities",
  "drop table if exists core.ownership_edges",
  "drop table if exists core.legal_entities",
  "drop table if exists core.organizations",
];

export async function up(db: Kysely<unknown>): Promise<void> {
  for (const s of [...UP, ...SEED]) await sql.raw(s).execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  for (const s of DOWN) await sql.raw(s).execute(db);
}
