/**
 * Environment of the browser (Playwright + axe) and load (autocannon) suites. They run against their own database
 * ("isoline_e2e", recreated by scripts/e2e/prepare.ts) and their own production server on port 3211, so the
 * development database and the dev server on 3210 are never touched. Locally the secrets come from web/.env.local;
 * in CI from the job environment.
 */
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

export const WEB = join(__dirname, "..", "..");
export const E2E_PORT = Number(process.env.E2E_PORT ?? 3211);
export const E2E_DATABASE = process.env.E2E_DATABASE ?? "isoline_e2e";
// loopback address, not "localhost": Node resolves that to ::1 first and the server listens on IPv4 only
export const E2E_ORIGIN = `http://127.0.0.1:${E2E_PORT}`;
/** Fixture ids and the generated demo password (git-ignored, never printed). */
export const FIXTURE_FILE = join(WEB, "e2e", ".state", "fixture.json");

export function loadLocalEnv(): void {
  const file = join(WEB, ".env.local");
  if (existsSync(file)) process.loadEnvFile(file);
}

const swap = (key: string): string => {
  const v = process.env[key];
  if (!v) throw new Error(`${key} is not set (run node ../scripts/dev-env.mjs, or give it in the CI job)`);
  const u = new URL(v);
  u.pathname = `/${E2E_DATABASE}`;
  return u.toString();
};

/** Variables the e2e server and scripts override; everything else is inherited. */
export function e2eEnv(): Record<string, string> {
  loadLocalEnv();
  return {
    DATABASE_URL: swap("DATABASE_URL"),
    DATABASE_OWNER_URL: swap("DATABASE_OWNER_URL"),
    DATABASE_SYSTEM_URL: swap("DATABASE_SYSTEM_URL"),
    BETTER_AUTH_URL: E2E_ORIGIN,
    APP_BASE_URL: E2E_ORIGIN,
    // the suites sign in dozens of sessions from one address; the limiter itself is covered by the auth tests
    AUTH_RATE_LIMIT: "off",
    PORT: String(E2E_PORT),
    NEXT_TELEMETRY_DISABLED: "1",
  };
}

export function ensureStateDir(): void {
  mkdirSync(dirname(FIXTURE_FILE), { recursive: true });
}
