/**
 * Database CLI (run with tsx; reads web/.env.local):
 *   npm run db:bootstrap        roles + database "isoline"
 *   npm run db:migrate          migrate to latest (as isoline_owner)
 *   npm run db:rollback         undo the last migration
 *   npm run db:status           list applied and pending migrations
 *   npm run db:seed [-- --reset] demo tenants for the two reference journeys (sample data, labelled)
 */
import { bootstrapCluster } from "../../src/server/db/bootstrap";
import { migrateDown, migrateToLatest, migrationStatus } from "../../src/server/db/migrator";

process.loadEnvFile(".env.local");

const need = (k: string) => {
  const v = process.env[k];
  if (!v) throw new Error(`${k} is not set (run node ../scripts/dev-env.mjs)`);
  return v;
};

async function main() {
  const cmd = process.argv[2];
  if (cmd === "bootstrap") {
    await bootstrapCluster({
      adminUrl: need("DATABASE_ADMIN_URL"),
      database: new URL(need("DATABASE_URL")).pathname.slice(1),
      passwords: { owner: need("DB_OWNER_PASSWORD"), app: need("DB_APP_PASSWORD"), system: need("DB_SYSTEM_PASSWORD") },
    });
    console.log("bootstrap ok");
  } else if (cmd === "migrate") {
    const r = await migrateToLatest(need("DATABASE_OWNER_URL"));
    console.log(r.length ? r.map((x) => `${x.direction} ${x.migrationName}: ${x.status}`).join("\n") : "already at latest");
    const { syncCatalog } = await import("../../src/server/data/catalog-sync");
    const { closeDb } = await import("../../src/server/db/client");
    console.log(`metric catalogue: ${(await syncCatalog()).inserted} new definition(s)`);
    await closeDb();
  } else if (cmd === "rollback") {
    const r = await migrateDown(need("DATABASE_OWNER_URL"));
    console.log(r.map((x) => `${x.direction} ${x.migrationName}: ${x.status}`).join("\n") || "nothing to roll back");
  } else if (cmd === "status") {
    for (const m of await migrationStatus(need("DATABASE_OWNER_URL"))) console.log(`${m.executedAt ? "applied" : "pending"}  ${m.name}`);
  } else if (cmd === "seed") {
    const { seedDemo } = await import("../../src/server/seed/demo");
    const { closeDb } = await import("../../src/server/db/client");
    await seedDemo({ reset: process.argv.includes("--reset") });
    await closeDb();
    console.log("seed ok");
  } else {
    console.log("usage: tsx scripts/db/cli.ts bootstrap|migrate|rollback|status|seed");
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
