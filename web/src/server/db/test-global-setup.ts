/** Creates and migrates a fresh test database once per run (vitest.db.config.mts). */
import { bootstrapCluster } from "./bootstrap";
import { migrateToLatest } from "./migrator";

export default async function setup() {
  process.loadEnvFile(".env.local");
  const need = (k: string) => {
    const v = process.env[k];
    if (!v) throw new Error(`${k} missing`);
    return v;
  };
  const name = "isoline_test";
  await bootstrapCluster({
    adminUrl: need("DATABASE_ADMIN_URL"),
    database: name,
    passwords: { owner: need("DB_OWNER_PASSWORD"), app: need("DB_APP_PASSWORD"), system: need("DB_SYSTEM_PASSWORD") },
    recreate: true,
  });
  const owner = new URL(need("DATABASE_OWNER_URL"));
  owner.pathname = `/${name}`;
  await migrateToLatest(owner.toString());
  // the metric catalogue rows (append-only reference data) as at deploy time
  const sys = new URL(need("DATABASE_SYSTEM_URL"));
  sys.pathname = `/${name}`;
  process.env.DATABASE_SYSTEM_URL = sys.toString();
  const { syncCatalog } = await import("../data/catalog-sync");
  const { closeDb } = await import("./client");
  await syncCatalog();
  const { syncBuiltinFactors } = await import("../calc/factors");
  await syncBuiltinFactors();
  await closeDb();
}
