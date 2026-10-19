// Database integration tests (*.db.test.ts) against a real PostgreSQL: a fresh "isoline_test" database is created and
// migrated before the run (src/server/db/test-global-setup.ts). Tests use the low-privilege app role, so RLS applies.
import { defineConfig } from "vitest/config";
import { BaseSequencer, type TestSpecification } from "vitest/node";

/** Files in path order (not by last duration): the cross-tenant check in security/zz-* runs after the data files. */
class PathOrder extends BaseSequencer {
  async sort(files: TestSpecification[]) {
    return [...files].sort((a, b) => a.moduleId.localeCompare(b.moduleId));
  }
}

process.loadEnvFile(".env.local");
const testDb = "isoline_test";
const swap = (url: string | undefined) => {
  if (!url) throw new Error("run node ../scripts/dev-env.mjs and npm run db:bootstrap first");
  const u = new URL(url);
  u.pathname = `/${testDb}`;
  return u.toString();
};

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    include: ["src/**/*.db.test.ts"],
    environment: "node",
    globalSetup: ["src/server/db/test-global-setup.ts"],
    // one process, files in sequence: tests share the database
    pool: "forks",
    fileParallelism: false,
    sequence: { sequencer: PathOrder },
    testTimeout: 30_000,
    hookTimeout: 60_000,
    env: {
      TEST_DATABASE_NAME: testDb,
      AUTH_RATE_LIMIT: "off",
      DATABASE_URL: swap(process.env.DATABASE_URL),
      DATABASE_OWNER_URL: swap(process.env.DATABASE_OWNER_URL),
      DATABASE_SYSTEM_URL: swap(process.env.DATABASE_SYSTEM_URL),
      DATABASE_ADMIN_URL: process.env.DATABASE_ADMIN_URL!,
    },
  },
});
