/**
 * Reversible migrations (ADR-003): every migration has up and down; they run as isoline_owner. The list is
 * static (no file globbing) so the same code runs under Next.js, tsx and vitest.
 */
import { Kysely, PostgresDialect } from "kysely";
import { Migrator, type Migration, type MigrationProvider, type MigrationResult } from "kysely/migration";
import pg from "pg";
import * as m0001 from "./migrations/0001_auth";
import * as m0002 from "./migrations/0002_core";
import * as m0003 from "./migrations/0003_legacy_import";
import * as m0004 from "./migrations/0004_org_projects";

export const MIGRATIONS: Record<string, Migration> = {
  "0001_auth": m0001,
  "0002_core": m0002,
  "0003_legacy_import": m0003,
  "0004_org_projects": m0004,
};

class StaticProvider implements MigrationProvider {
  async getMigrations() {
    return MIGRATIONS;
  }
}

function ownerDb(ownerUrl: string) {
  return new Kysely<unknown>({ dialect: new PostgresDialect({ pool: new pg.Pool({ connectionString: ownerUrl, max: 1 }) }) });
}

async function run(ownerUrl: string, fn: (m: Migrator) => Promise<{ error?: unknown; results?: MigrationResult[] }>) {
  const db = ownerDb(ownerUrl);
  try {
    const { error, results } = await fn(new Migrator({ db, provider: new StaticProvider() }));
    if (error) throw error;
    return results ?? [];
  } finally {
    await db.destroy();
  }
}

export const migrateToLatest = (ownerUrl: string) => run(ownerUrl, (m) => m.migrateToLatest());
export const migrateDown = (ownerUrl: string) => run(ownerUrl, (m) => m.migrateDown());
export const migrateTo = (ownerUrl: string, name: string) => run(ownerUrl, (m) => m.migrateTo(name));

export async function migrationStatus(ownerUrl: string) {
  const db = ownerDb(ownerUrl);
  try {
    return await new Migrator({ db, provider: new StaticProvider() }).getMigrations();
  } finally {
    await db.destroy();
  }
}
