/** G1-01: every migration applies to a fresh database, rolls back cleanly and applies again (ADR-003). */
import { afterAll, describe, expect, it } from "vitest";
import { sql, Kysely, PostgresDialect } from "kysely";
import pg from "pg";
import { bootstrapCluster, dropDatabase } from "./bootstrap";
import { MIGRATIONS, migrateDown, migrateToLatest, migrationStatus } from "./migrator";

const NAME = "isoline_test_migrations";
const urlFor = (base: string) => {
  const u = new URL(base);
  u.pathname = `/${NAME}`;
  return u.toString();
};

afterAll(async () => {
  await dropDatabase(process.env.DATABASE_ADMIN_URL!, NAME);
});

async function tables(ownerUrl: string): Promise<string[]> {
  const db = new Kysely<unknown>({ dialect: new PostgresDialect({ pool: new pg.Pool({ connectionString: ownerUrl, max: 1 }) }) });
  try {
    const r = await sql<{ t: string }>`select table_schema || '.' || table_name as t from information_schema.tables where table_schema in ('public','core') and table_name not like 'kysely_%' order by 1`.execute(db);
    return r.rows.map((x) => x.t);
  } finally {
    await db.destroy();
  }
}

describe("migrations", () => {
  it("go up, all the way down and up again on a fresh database", async () => {
    process.loadEnvFile(".env.local");
    await bootstrapCluster({
      adminUrl: process.env.DATABASE_ADMIN_URL!,
      database: NAME,
      passwords: { owner: process.env.DB_OWNER_PASSWORD!, app: process.env.DB_APP_PASSWORD!, system: process.env.DB_SYSTEM_PASSWORD! },
      recreate: true,
    });
    const owner = urlFor(process.env.DATABASE_OWNER_URL!);
    const up1 = await migrateToLatest(owner);
    expect(up1.map((r) => r.status)).toEqual(Object.keys(MIGRATIONS).map(() => "Success"));
    const full = await tables(owner);
    expect(full).toContain("core.tenants");
    expect(full).toContain("public.user");

    for (let i = 0; i < Object.keys(MIGRATIONS).length; i++) await migrateDown(owner);
    expect(await tables(owner)).toEqual([]);
    expect((await migrationStatus(owner)).every((m) => !m.executedAt)).toBe(true);

    await migrateToLatest(owner);
    expect(await tables(owner)).toEqual(full);
  });
});
