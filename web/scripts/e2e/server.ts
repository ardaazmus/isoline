/**
 * Production server of the browser and load suites (npm run e2e:server; Playwright starts it too): the standalone
 * server of the last `next build` — the same bundle as the container image (web/Dockerfile) — on port 3211 against
 * the "isoline_e2e" database. Run `npm run build` after changing code: a development server would measure
 * Turbopack, not the application.
 */
import { spawn } from "node:child_process";
import { cpSync, existsSync } from "node:fs";
import { join } from "node:path";
import { E2E_PORT, WEB, e2eEnv } from "./env";

const standalone = join(WEB, ".next", "standalone");
if (!existsSync(join(standalone, "server.js"))) {
  console.error("no production build: run `npm run build` first");
  process.exit(1);
}
// the standalone bundle leaves static assets to the deployment, as the Dockerfile does
cpSync(join(WEB, ".next", "static"), join(standalone, ".next", "static"), { recursive: true, force: true });
cpSync(join(WEB, "public"), join(standalone, "public"), { recursive: true, force: true });

// e2eEnv() loads web/.env.local into this process first: the standalone directory has no env file of its own
const overrides = e2eEnv();
const child = spawn(process.execPath, [join(standalone, "server.js")], {
  cwd: standalone,
  env: { ...process.env, ...overrides, NODE_ENV: "production", HOSTNAME: "127.0.0.1", PORT: String(E2E_PORT) },
  stdio: "inherit",
});
for (const sig of ["SIGINT", "SIGTERM"] as const) process.on(sig, () => child.kill(sig));
child.on("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
