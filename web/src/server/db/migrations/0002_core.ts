/**
 * Core platform schema for G1 (ADR-002, ADR-005, ADR-006): tenants, memberships, invitations, projects
 * (extended in G2), project-scoped external grants and consent, append-only hash-chained audit, outbox,
 * idempotency keys and evidence metadata — with row-level security on every tenant table.
 *
 * Access model in SQL (the server policy layer narrows further):
 *   read  a row of tenant T, project P  ⇔  acting tenant = T and the user is an active member of T
 *                                          or an active, unexpired grant on P exists for the acting tenant
 *                                          (and the user is a member of it)
 *                                          or T is provisional and was opened by the acting tenant (steward)
 *   write the same, minus viewers, minus read-only grant roles (reviewer, design, assurance)
 * Helper functions are SECURITY DEFINER owned by isoline_rls (BYPASSRLS) with a pinned search_path, so
 * policies can read memberships and grants without recursing into their own policies.
 */
import { sql, type Kysely } from "kysely";

const MEMBER_ROLES = "'owner','admin','project_lead','data_owner','contributor','report_editor','management_signer','viewer','preparer','reviewer'";
const GRANT_ROLES = "'preparer','reviewer','methodology','design','assurance'";

const UP: string[] = [
  `create schema core authorization isoline_owner`,
  `create schema authz authorization isoline_owner`,

  // ---------------------------------------------------------------- tables
  `create table core.tenants (
    id uuid primary key default gen_random_uuid(),
    name text not null check (length(btrim(name)) between 1 and 200),
    kind text not null check (kind in ('company','advisory','partner')),
    lifecycle text not null default 'active' check (lifecycle in ('provisional','active','suspended','closed')),
    region text not null default 'tr',
    created_by uuid not null references "user"(id),
    steward_tenant_id uuid references core.tenants(id),
    claimed_at timestamptz,
    claimed_by uuid references "user"(id),
    terms_version text,
    require_mfa boolean not null default false,
    sample boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    row_version bigint not null default 1,
    check (lifecycle <> 'provisional' or (steward_tenant_id is not null and claimed_at is null))
  )`,
  `create table core.memberships (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references core.tenants(id),
    user_id uuid not null references "user"(id),
    role text not null check (role in (${MEMBER_ROLES})),
    scope jsonb not null default '{}'::jsonb,
    invited_by uuid references "user"(id),
    accepted_at timestamptz not null default now(),
    revoked_at timestamptz,
    revoked_by uuid references "user"(id),
    created_at timestamptz not null default now()
  )`,
  `create unique index memberships_active_uq on core.memberships(tenant_id, user_id) where revoked_at is null`,
  `create index memberships_user_idx on core.memberships(user_id) where revoked_at is null`,
  `create table core.invitations (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references core.tenants(id),
    email citext not null,
    role text not null check (role in (${MEMBER_ROLES})),
    kind text not null default 'member' check (kind in ('member','claim')),
    token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
    invited_by uuid not null references "user"(id),
    expires_at timestamptz not null,
    accepted_at timestamptz,
    accepted_by uuid references "user"(id),
    revoked_at timestamptz,
    created_at timestamptz not null default now(),
    check (expires_at > created_at)
  )`,
  `create table core.projects (
    id uuid primary key default gen_random_uuid(),
    owner_tenant_id uuid not null references core.tenants(id),
    name text not null check (length(btrim(name)) between 1 and 200),
    status text not null default 'planning' check (status in ('planning','active','closed','archived')),
    created_by uuid not null references "user"(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    row_version bigint not null default 1,
    unique (owner_tenant_id, id)
  )`,
  `create table core.external_grants (
    id uuid primary key default gen_random_uuid(),
    owner_tenant_id uuid not null references core.tenants(id),
    recipient_tenant_id uuid not null references core.tenants(id),
    project_id uuid not null,
    role text not null check (role in (${GRANT_ROLES})),
    scope jsonb not null default '{}'::jsonb,
    data_classes text[] not null default '{}',
    purpose text not null check (length(btrim(purpose)) > 0),
    can_download boolean not null default false,
    expires_at timestamptz not null,
    revoked_at timestamptz,
    revoked_by uuid references "user"(id),
    granted_by uuid not null references "user"(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    row_version bigint not null default 1,
    foreign key (owner_tenant_id, project_id) references core.projects(owner_tenant_id, id),
    check (owner_tenant_id <> recipient_tenant_id),
    check (expires_at > created_at)
  )`,
  `create unique index external_grants_active_uq on core.external_grants(project_id, recipient_tenant_id) where revoked_at is null`,
  `create index external_grants_recipient_idx on core.external_grants(recipient_tenant_id, project_id) where revoked_at is null`,
  `create table core.consent_records (
    id uuid primary key default gen_random_uuid(),
    owner_tenant_id uuid not null references core.tenants(id),
    grant_id uuid not null references core.external_grants(id),
    given_by uuid not null references "user"(id),
    purpose text not null,
    scope jsonb not null,
    data_classes text[] not null,
    terms_version text not null,
    created_at timestamptz not null default now()
  )`,
  `create table core.audit_events (
    id bigint generated always as identity primary key,
    owner_tenant_id uuid references core.tenants(id),
    acting_tenant_id uuid references core.tenants(id),
    actor_user_id uuid references "user"(id),
    project_id uuid,
    action text not null,
    object_type text not null,
    object_id text not null,
    before_digest text,
    after_digest text,
    payload jsonb not null default '{}'::jsonb,
    request_id text,
    prev_hash text,
    hash text not null default '',
    occurred_at timestamptz not null default now()
  )`,
  `create index audit_events_tenant_idx on core.audit_events(owner_tenant_id, occurred_at desc)`,
  `create table core.outbox_events (
    id bigint generated always as identity primary key,
    owner_tenant_id uuid references core.tenants(id),
    kind text not null,
    payload jsonb not null,
    dedupe_key text unique,
    status text not null default 'pending' check (status in ('pending','processing','done','dead')),
    attempts integer not null default 0,
    next_attempt_at timestamptz not null default now(),
    last_error text,
    created_at timestamptz not null default now(),
    processed_at timestamptz
  )`,
  `create index outbox_ready_idx on core.outbox_events(next_attempt_at) where status = 'pending'`,
  `create table core.idempotency_keys (
    user_id uuid not null references "user"(id),
    key text not null check (length(key) between 8 and 200),
    route text not null,
    request_hash text not null,
    status integer not null,
    response jsonb not null,
    created_at timestamptz not null default now(),
    primary key (user_id, key)
  )`,
  `create table core.evidence_objects (
    id uuid primary key default gen_random_uuid(),
    owner_tenant_id uuid not null references core.tenants(id),
    project_id uuid not null,
    storage_key text not null unique,
    filename text not null check (length(filename) between 1 and 255),
    mime text not null,
    size_bytes bigint not null check (size_bytes >= 0),
    sha256 char(64) not null check (sha256 ~ '^[0-9a-f]{64}$'),
    classification text not null default 'internal' check (classification in ('public','internal','confidential','personal')),
    scan_status text not null default 'scanning' check (scan_status in ('awaiting_file','scanning','available','quarantined','rejected')),
    scan_detail text,
    uploaded_by uuid not null references "user"(id),
    uploaded_at timestamptz not null default now(),
    retention_until date,
    legal_hold boolean not null default false,
    row_version bigint not null default 1,
    foreign key (owner_tenant_id, project_id) references core.projects(owner_tenant_id, id),
    unique (owner_tenant_id, id),
    unique (project_id, sha256)
  )`,
  `create table core.evidence_access_log (
    id bigint generated always as identity primary key,
    owner_tenant_id uuid not null references core.tenants(id),
    evidence_id uuid not null references core.evidence_objects(id),
    actor_user_id uuid not null references "user"(id),
    acting_tenant_id uuid references core.tenants(id),
    action text not null check (action in ('upload','view','download','link')),
    at timestamptz not null default now()
  )`,
  `create table core.retention_rules (
    id uuid primary key default gen_random_uuid(),
    owner_tenant_id uuid not null references core.tenants(id),
    data_class text not null,
    keep_years integer not null check (keep_years between 0 and 100),
    note text,
    created_at timestamptz not null default now(),
    unique (owner_tenant_id, data_class)
  )`,

  // ---------------------------------------------------------------- row version on update
  `create function core.touch_row() returns trigger language plpgsql as $$
   begin
     new.row_version := old.row_version + 1;
     new.updated_at := now();
     return new;
   end $$`,
  `create trigger tenants_touch before update on core.tenants for each row execute function core.touch_row()`,
  `create trigger projects_touch before update on core.projects for each row execute function core.touch_row()`,
  `create trigger external_grants_touch before update on core.external_grants for each row execute function core.touch_row()`,
  `create function core.touch_version() returns trigger language plpgsql as $$
   begin new.row_version := old.row_version + 1; return new; end $$`,
  `create trigger evidence_touch before update on core.evidence_objects for each row execute function core.touch_version()`,

  // ---------------------------------------------------------------- authorization helpers
  `create function authz.uid() returns uuid language sql stable as
   $$ select nullif(current_setting('app.user_id', true), '')::uuid $$`,
  `create function authz.acting_tenant() returns uuid language sql stable as
   $$ select nullif(current_setting('app.acting_tenant_id', true), '')::uuid $$`,
  `create function authz.is_member(t uuid) returns boolean language sql stable security definer
   set search_path = pg_catalog, core as
   $$ select exists (select 1 from core.memberships m where m.tenant_id = t and m.user_id = authz.uid() and m.revoked_at is null) $$`,
  `create function authz.has_role(t uuid, roles text[]) returns boolean language sql stable security definer
   set search_path = pg_catalog, core as
   $$ select exists (select 1 from core.memberships m where m.tenant_id = t and m.user_id = authz.uid() and m.revoked_at is null and m.role = any(roles)) $$`,
  `create function authz.acting_member() returns boolean language sql stable as
   $$ select authz.acting_tenant() is not null and authz.is_member(authz.acting_tenant()) $$`,
  `create function authz.is_steward(t uuid) returns boolean language sql stable security definer
   set search_path = pg_catalog, core as
   $$ select authz.acting_member() and exists (
        select 1 from core.tenants x where x.id = t and x.lifecycle = 'provisional' and x.steward_tenant_id = authz.acting_tenant()) $$`,
  `create function authz.grant_role(p uuid) returns text language sql stable security definer
   set search_path = pg_catalog, core as
   $$ select g.role from core.external_grants g
       where g.project_id = p and g.recipient_tenant_id = authz.acting_tenant()
         and g.revoked_at is null and g.expires_at > now() and authz.acting_member()
       limit 1 $$`,
  `create function authz.can_read(owner uuid, project uuid) returns boolean language sql stable as
   $$ select (owner = authz.acting_tenant() and authz.is_member(owner))
          or authz.is_steward(owner)
          or (project is not null and authz.grant_role(project) is not null) $$`,
  `create function authz.can_write(owner uuid, project uuid) returns boolean language sql stable as
   $$ select (owner = authz.acting_tenant() and authz.is_member(owner) and not authz.has_role(owner, array['viewer']))
          or authz.is_steward(owner)
          or (project is not null and authz.grant_role(project) in ('preparer','methodology')) $$`,
  `create function authz.has_grant_from(owner uuid) returns boolean language sql stable security definer
   set search_path = pg_catalog, core as
   $$ select authz.acting_member() and exists (
        select 1 from core.external_grants g where g.owner_tenant_id = owner and g.recipient_tenant_id = authz.acting_tenant()
          and g.revoked_at is null and g.expires_at > now()) $$`,

  // audit hash chain (per owner tenant; NULL tenant = identity events) — detection aid, not an immutability proof
  `create function authz.audit_chain() returns trigger language plpgsql security definer
   set search_path = pg_catalog, core as $$
   declare prev text;
   begin
     perform pg_advisory_xact_lock(hashtext('audit:' || coalesce(new.owner_tenant_id::text, '-')));
     select a.hash into prev from core.audit_events a
       where a.owner_tenant_id is not distinct from new.owner_tenant_id order by a.id desc limit 1;
     new.prev_hash := prev;
     new.hash := encode(public.digest(coalesce(prev, '') || '|' || new.action || '|' || new.object_type || '|' || new.object_id || '|' ||
       coalesce(new.actor_user_id::text, '') || '|' || coalesce(new.after_digest, '') || '|' || new.payload::text || '|' ||
       to_char(new.occurred_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'), 'sha256'), 'hex');
     return new;
   end $$`,
  `create trigger audit_chain before insert on core.audit_events for each row execute function authz.audit_chain()`,

  // queueing goes through one definer function so the dedupe (ON CONFLICT) needs no read access to the queue
  `create function authz.enqueue(p_kind text, p_payload jsonb, p_dedupe text, p_tenant uuid, p_at timestamptz) returns void
   language sql security definer set search_path = pg_catalog, core as
   $$ insert into core.outbox_events(kind, payload, dedupe_key, owner_tenant_id, next_attempt_at)
      values (p_kind, p_payload, p_dedupe, p_tenant, coalesce(p_at, now()))
      on conflict (dedupe_key) do nothing $$`,

  // helpers run with isoline_rls rights (BYPASSRLS) — it must be able to read what they read
  `grant usage on schema core, authz to isoline_rls`,
  `grant create on schema authz to isoline_rls`,
  `grant select on core.memberships, core.tenants, core.external_grants to isoline_rls`,
  `grant select on core.audit_events to isoline_rls`,
  `grant select, insert on core.outbox_events to isoline_rls`,
  `grant usage on all sequences in schema core to isoline_rls`,
  `alter function authz.is_member(uuid) owner to isoline_rls`,
  `alter function authz.has_role(uuid, text[]) owner to isoline_rls`,
  `alter function authz.is_steward(uuid) owner to isoline_rls`,
  `alter function authz.grant_role(uuid) owner to isoline_rls`,
  `alter function authz.has_grant_from(uuid) owner to isoline_rls`,
  `alter function authz.audit_chain() owner to isoline_rls`,
  `alter function authz.enqueue(text, jsonb, text, uuid, timestamptz) owner to isoline_rls`,
  `revoke all on all functions in schema authz from public`,
  `grant execute on all functions in schema authz to isoline_app, isoline_system, isoline_rls`,
  `grant usage on schema core, authz to isoline_app, isoline_system`,

  // ---------------------------------------------------------------- privileges (least privilege for the app)
  `grant select on core.tenants to isoline_app`,
  // owners change only the name and the security policy; lifecycle, steward and claim move through server paths
  `grant update (name, require_mfa) on core.tenants to isoline_app`,
  `grant select, insert, update on core.memberships, core.invitations, core.projects, core.external_grants to isoline_app`,
  `grant select, insert on core.consent_records, core.evidence_access_log, core.idempotency_keys to isoline_app`,
  `grant update (status, response), delete on core.idempotency_keys to isoline_app`,
  `grant select, insert on core.audit_events to isoline_app`,
  `grant select, insert on core.evidence_objects to isoline_app`,
  `grant update (classification, retention_until, legal_hold) on core.evidence_objects to isoline_app`,
  `grant select, insert, update, delete on core.retention_rules to isoline_app`,
  `grant usage on all sequences in schema core to isoline_app`,
  // system role: narrow server paths (sign-up bootstrap, invitations, worker); still no update/delete on audit
  `grant select, insert, update on all tables in schema core to isoline_system`,
  `revoke update, delete on core.audit_events from isoline_system`,
  `grant usage on all sequences in schema core to isoline_system`,

  // ---------------------------------------------------------------- row-level security
  ...["tenants", "memberships", "invitations", "projects", "external_grants", "consent_records", "audit_events", "outbox_events", "idempotency_keys", "evidence_objects", "evidence_access_log", "retention_rules"].flatMap((t) => [
    `alter table core.${t} enable row level security`,
    `alter table core.${t} force row level security`,
  ]),

  `create policy tenants_read on core.tenants for select using (authz.is_member(id) or authz.is_steward(id) or authz.has_grant_from(id))`,
  `create policy tenants_admin on core.tenants for update using (authz.has_role(id, array['owner','admin'])) with check (authz.has_role(id, array['owner','admin']))`,

  `create policy memberships_read on core.memberships for select using (user_id = authz.uid() or authz.is_member(tenant_id))`,
  `create policy memberships_admin_insert on core.memberships for insert with check (tenant_id = authz.acting_tenant() and authz.has_role(tenant_id, array['owner','admin']))`,
  `create policy memberships_admin_update on core.memberships for update using (tenant_id = authz.acting_tenant() and authz.has_role(tenant_id, array['owner','admin'])) with check (tenant_id = authz.acting_tenant() and authz.has_role(tenant_id, array['owner','admin']))`,

  `create policy invitations_admin on core.invitations for all using (tenant_id = authz.acting_tenant() and authz.has_role(tenant_id, array['owner','admin'])) with check (tenant_id = authz.acting_tenant() and authz.has_role(tenant_id, array['owner','admin']))`,

  `create policy projects_read on core.projects for select using (authz.can_read(owner_tenant_id, id))`,
  `create policy projects_insert on core.projects for insert with check (
     created_by = authz.uid() and (
       (owner_tenant_id = authz.acting_tenant() and authz.has_role(owner_tenant_id, array['owner','admin','project_lead']))
       or authz.is_steward(owner_tenant_id)))`,
  `create policy projects_update on core.projects for update using (authz.can_write(owner_tenant_id, id)) with check (authz.can_write(owner_tenant_id, id))`,

  `create policy grants_read on core.external_grants for select using (
     (owner_tenant_id = authz.acting_tenant() and authz.is_member(owner_tenant_id))
     or (recipient_tenant_id = authz.acting_tenant() and authz.is_member(recipient_tenant_id)))`,
  `create policy grants_insert on core.external_grants for insert with check (
     granted_by = authz.uid() and owner_tenant_id = authz.acting_tenant() and authz.has_role(owner_tenant_id, array['owner','admin']))`,
  `create policy grants_update on core.external_grants for update using (
     owner_tenant_id = authz.acting_tenant() and authz.has_role(owner_tenant_id, array['owner','admin']))
     with check (owner_tenant_id = authz.acting_tenant() and authz.has_role(owner_tenant_id, array['owner','admin']))`,

  `create policy consent_read on core.consent_records for select using (authz.can_read(owner_tenant_id, null) or authz.has_grant_from(owner_tenant_id))`,
  `create policy consent_insert on core.consent_records for insert with check (given_by = authz.uid() and owner_tenant_id = authz.acting_tenant() and authz.has_role(owner_tenant_id, array['owner','admin']))`,

  `create policy audit_read on core.audit_events for select using (
     actor_user_id = authz.uid() or (owner_tenant_id = authz.acting_tenant() and authz.has_role(owner_tenant_id, array['owner','admin'])))`,
  `create policy audit_insert on core.audit_events for insert with check (actor_user_id = authz.uid())`,


  `create policy idem_own on core.idempotency_keys for all using (user_id = authz.uid()) with check (user_id = authz.uid())`,

  `create policy evidence_read on core.evidence_objects for select using (
     authz.can_read(owner_tenant_id, project_id) and (scan_status in ('available','awaiting_file') or uploaded_by = authz.uid()))`,
  `create policy evidence_insert on core.evidence_objects for insert with check (uploaded_by = authz.uid() and authz.can_write(owner_tenant_id, project_id))`,
  `create policy evidence_update on core.evidence_objects for update using (authz.can_write(owner_tenant_id, project_id)) with check (authz.can_write(owner_tenant_id, project_id))`,

  `create policy evidence_log_insert on core.evidence_access_log for insert with check (actor_user_id = authz.uid())`,
  `create policy evidence_log_read on core.evidence_access_log for select using (owner_tenant_id = authz.acting_tenant() and authz.has_role(owner_tenant_id, array['owner','admin']))`,

  `create policy retention_admin on core.retention_rules for all using (owner_tenant_id = authz.acting_tenant() and authz.has_role(owner_tenant_id, array['owner','admin'])) with check (owner_tenant_id = authz.acting_tenant() and authz.has_role(owner_tenant_id, array['owner','admin']))`,

  // the system role still bypasses RLS (BYPASSRLS); these policies document its scope for reviewers
];

export async function up(db: Kysely<unknown>): Promise<void> {
  for (const s of UP) await sql.raw(s).execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql.raw("drop schema if exists authz cascade").execute(db);
  await sql.raw("drop schema if exists core cascade").execute(db);
}
