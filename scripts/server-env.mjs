#!/usr/bin/env node
/**
 * Writes deploy/app.env for the containerised app and worker (docker compose --profile app) from web/.env.local:
 * the same secrets, with the service names of the compose network instead of the host ports. Never committed.
 *
 *   node scripts/server-env.mjs [--base-url https://isoline.example.com]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const local = readFileSync(join(root, "web/.env.local"), "utf8");
const env = Object.fromEntries(
  local
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const i = process.argv.indexOf("--base-url");
const baseUrl = i > 0 ? process.argv[i + 1] : "http://localhost:3000";
const swapDb = (u) => u.replace(/@127\.0\.0\.1:\d+\//, "@db:5432/");

const out = {
  ...env,
  NODE_ENV: "production",
  DATABASE_ADMIN_URL: swapDb(env.DATABASE_ADMIN_URL),
  DATABASE_OWNER_URL: swapDb(env.DATABASE_OWNER_URL),
  DATABASE_URL: swapDb(env.DATABASE_URL),
  DATABASE_SYSTEM_URL: swapDb(env.DATABASE_SYSTEM_URL),
  S3_ENDPOINT: "http://storage:8333",
  EMAIL_SMTP_HOST: "mail",
  EMAIL_SMTP_PORT: "1025",
  CLAMAV_HOST: "scan",
  CLAMAV_PORT: "3310",
  SCANNER: "clamd",
  BETTER_AUTH_URL: baseUrl,
  APP_BASE_URL: baseUrl,
  AUTH_RATE_LIMIT: "on",
};
writeFileSync(join(root, "deploy/app.env"), Object.entries(out).map(([k, v]) => `${k}=${v}`).join("\n") + "\n");
console.log(`wrote deploy/app.env (${Object.keys(out).length} keys, base URL ${baseUrl})`);
