/**
 * G8-08 hardening: the two reference tables without row-level security get it as well (defence in depth — every
 * core table now has RLS enabled and forced). They hold no tenant data: every signed-in workspace may read them,
 * only the system role (deploy-time sync) writes them.
 */
import { sql, type Kysely } from "kysely";

const TABLES = ["metric_definitions", "framework_versions"];

export async function up(db: Kysely<unknown>): Promise<void> {
  for (const t of TABLES) {
    await sql.raw(`alter table core.${t} enable row level security`).execute(db);
    await sql.raw(`alter table core.${t} force row level security`).execute(db);
    await sql.raw(`create policy ${t}_read on core.${t} for select using (true)`).execute(db);
    await sql.raw(`create policy ${t}_system on core.${t} for all to isoline_system using (true) with check (true)`).execute(db);
  }
}

export async function down(db: Kysely<unknown>): Promise<void> {
  for (const t of TABLES) {
    await sql.raw(`drop policy if exists ${t}_system on core.${t}`).execute(db);
    await sql.raw(`drop policy if exists ${t}_read on core.${t}`).execute(db);
    await sql.raw(`alter table core.${t} no force row level security`).execute(db);
    await sql.raw(`alter table core.${t} disable row level security`).execute(db);
  }
}
