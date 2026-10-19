/**
 * G1-11: import of browser workspaces (toolkit files v2–v11) into the platform (ADR-008, G0 risk register R1–R10).
 * The migrated source is kept read-only with its SHA-256 (R10); projects and evidence placeholders carry the import
 * id so a rollback removes exactly what the import created. The same file cannot be applied twice (R9).
 */
import { sql, type Kysely } from "kysely";

const UP: string[] = [
  `create table core.legacy_imports (
    id uuid primary key default gen_random_uuid(),
    owner_tenant_id uuid not null references core.tenants(id),
    imported_by uuid not null references "user"(id),
    file_name text not null check (length(file_name) between 1 and 255),
    source_sha256 char(64) not null check (source_sha256 ~ '^[0-9a-f]{64}$'),
    source_version integer not null check (source_version between 2 and 11),
    mode text not null check (mode in ('own','provisional')),
    snapshot jsonb not null,
    report jsonb not null,
    status text not null default 'applied' check (status in ('applied','rolled_back')),
    created_at timestamptz not null default now(),
    rolled_back_at timestamptz,
    rolled_back_by uuid references "user"(id),
    check ((status = 'rolled_back') = (rolled_back_at is not null))
  )`,
  `create unique index legacy_imports_once on core.legacy_imports(owner_tenant_id, source_sha256) where status = 'applied'`,
  `alter table core.projects add column legacy_import_id uuid references core.legacy_imports(id), add column legacy_client_id text`,
  `alter table core.evidence_objects add column legacy_import_id uuid references core.legacy_imports(id)`,
  `create index projects_legacy_idx on core.projects(legacy_import_id) where legacy_import_id is not null`,

  `grant select on core.legacy_imports to isoline_app`,
  `grant select, insert, update, delete on core.legacy_imports to isoline_system`,
  `grant delete on core.projects, core.evidence_objects to isoline_system`,
  `alter table core.legacy_imports enable row level security`,
  `alter table core.legacy_imports force row level security`,
  `create policy legacy_read on core.legacy_imports for select using (owner_tenant_id = authz.acting_tenant() and authz.has_role(owner_tenant_id, array['owner','admin']))`,
];

export async function up(db: Kysely<unknown>): Promise<void> {
  for (const s of UP) await sql.raw(s).execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql.raw("revoke delete on core.projects, core.evidence_objects from isoline_system").execute(db);
  await sql.raw("drop index if exists core.projects_legacy_idx").execute(db);
  await sql.raw("alter table core.evidence_objects drop column if exists legacy_import_id").execute(db);
  await sql.raw("alter table core.projects drop column if exists legacy_import_id, drop column if exists legacy_client_id").execute(db);
  await sql.raw("drop table if exists core.legacy_imports").execute(db);
}
