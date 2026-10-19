/**
 * G8 (plan 12 §5–6): controlled source connectors and the reference-data version log.
 *   - connectors: a tenant's pull connector into one campaign (HTTP(S) CSV/JSON from a configured host only;
 *     the secret is sealed with AES-256-GCM), run on behalf of the person who set it up (their rights apply).
 *   - connector_runs: every pull with resource, cursor, checksum, rows, errors and status; the same payload
 *     twice is recorded as "unchanged" and changes nothing; a failure goes to the outbox retry/dead-letter path.
 *   - reference_versions: each change of built-in reference data (factor library, metric catalogue, report
 *     templates, regulation register) with its digest and a summary — an auditable "regulation pack updater".
 */
import { sql, type Kysely } from "kysely";

const T = (name: string) => [`alter table core.${name} enable row level security`, `alter table core.${name} force row level security`];

const UP: string[] = [
  `create table core.connectors (
    id uuid primary key default gen_random_uuid(),
    owner_tenant_id uuid not null references core.tenants(id),
    project_id uuid not null,
    campaign_id uuid not null,
    name text not null check (length(btrim(name)) between 1 and 120),
    kind text not null check (kind in ('http_csv','http_json')),
    url text not null check (url ~ '^https?://'),
    allowed_host text not null,
    secret_sealed text,
    run_as uuid not null references "user"(id),
    schedule text not null default 'manual' check (schedule in ('manual','daily')),
    status text not null default 'active' check (status in ('active','paused')),
    last_checksum char(64),
    created_by uuid not null references "user"(id),
    created_at timestamptz not null default now(),
    foreign key (owner_tenant_id, project_id) references core.projects(owner_tenant_id, id),
    foreign key (project_id, campaign_id) references core.data_campaigns(project_id, id)
  )`,
  `create table core.connector_runs (
    id uuid primary key default gen_random_uuid(),
    owner_tenant_id uuid not null references core.tenants(id),
    project_id uuid not null,
    connector_id uuid not null references core.connectors(id) on delete cascade,
    resource text not null,
    cursor text,
    checksum char(64),
    bytes integer,
    rows integer,
    valid integer,
    errors jsonb not null default '[]'::jsonb,
    import_id uuid,
    status text not null check (status in ('succeeded','unchanged','failed')),
    message text,
    pulled_at timestamptz not null default now(),
    triggered_by uuid references "user"(id)
  )`,
  `create index connector_runs_connector_idx on core.connector_runs(connector_id, pulled_at desc)`,
  `create table core.reference_versions (
    id bigserial primary key,
    kind text not null check (kind in ('factor_library','metric_catalogue','report_templates','regulation_register','industry_packs')),
    version text not null,
    digest char(64) not null,
    summary jsonb not null,
    applied_at timestamptz not null default now(),
    unique (kind, digest)
  )`,

  `grant select, insert on core.connectors, core.connector_runs to isoline_app`,
  `grant update (status, schedule, last_checksum, url, allowed_host, secret_sealed, name) on core.connectors to isoline_app`,
  `grant select on core.reference_versions to isoline_app`,
  `grant select, insert, update, delete on core.connectors, core.connector_runs, core.reference_versions to isoline_system`,
  `grant usage on sequence core.reference_versions_id_seq to isoline_system`,
  ...["connectors", "connector_runs"].flatMap((t) => [
    ...T(t),
    `create policy ${t}_read on core.${t} for select using (authz.can_read(owner_tenant_id, project_id))`,
    `create policy ${t}_insert on core.${t} for insert with check (authz.can_write(owner_tenant_id, project_id))`,
    ...(t === "connectors" ? [`create policy ${t}_update on core.${t} for update using (authz.can_write(owner_tenant_id, project_id)) with check (authz.can_write(owner_tenant_id, project_id))`] : []),
  ]),
  // reference data is public to every signed-in workspace; only the system role writes it
  ...T("reference_versions"),
  `create policy reference_versions_read on core.reference_versions for select using (true)`,
];

const DOWN: string[] = ["drop table if exists core.reference_versions", "drop table if exists core.connector_runs", "drop table if exists core.connectors"];

export async function up(db: Kysely<unknown>): Promise<void> {
  for (const s of UP) await sql.raw(s).execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  for (const s of DOWN) await sql.raw(s).execute(db);
}
