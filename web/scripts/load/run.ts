/**
 * G8-07 load test (npm run test:load): signed-in sessions of the demo people work through their daily screens at the
 * same time — portfolio and its KPIs, the task inbox and the review queue, the calculations page and its run list,
 * the report studio page and its API — against the production server of the e2e database (scripts/e2e/server.ts,
 * started here when it is not running). Every virtual user is one autocannon client with its own session cookie and
 * one request in flight (closed loop, no think time), so N users means N concurrent requests at every moment.
 *
 *   npm run e2e:prepare && npm run build && npm run test:load -- --users 50 --duration 60
 *
 * Prints p50/p95/p99 per endpoint, writes the raw numbers to scripts/load/results/ (git-ignored) and exits 1 when a
 * threshold below is missed. Thresholds and the measured results are recorded in docs/erp/G8/02_YUK_TESTI.md.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import autocannon from "autocannon";
import { E2E_ORIGIN, FIXTURE_FILE, WEB } from "../e2e/env";

type Persona = "ayse" | "mehmet" | "zeynep" | "can" | "selin";
type Step = { label: string; path: string; page?: boolean };
type Fixture = { password: string; people: Record<Persona, string>; ids: Record<string, string> };

/** p95 limits in milliseconds at the default 50 users: JSON APIs and server-rendered pages. */
export const THRESHOLDS = { apiP95: 500, pageP95: 1500, errorRate: 0 } as const;

const arg = (name: string, fallback: number) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? Number(process.argv[i + 1]) : fallback;
};
const USERS = arg("users", 50);
const DURATION = arg("duration", 60);
const WARMUP = arg("warmup", 10);

const f = JSON.parse(readFileSync(FIXTURE_FILE, "utf8")) as Fixture;
const { companyProject: project, reportId, companyTenant, advisoryTenant } = f.ids;

/** What each person does all day, in a loop; every persona gets the same share of the virtual users. */
const FLOWS: Record<Persona, Step[]> = {
  // consultant: the 21-client portfolio, its KPIs, the review queue and the inbox
  can: [
    { label: "GET /api/v1/portfolio", path: "/api/v1/portfolio" },
    { label: "GET /api/v1/portfolio/kpis", path: "/api/v1/portfolio/kpis" },
    { label: "GET /api/v1/review-queue", path: "/api/v1/review-queue" },
    { label: "GET /api/v1/tasks", path: "/api/v1/tasks" },
  ],
  // company owner: portfolio, calculations page, report studio
  ayse: [
    { label: "GET /api/v1/portfolio", path: "/api/v1/portfolio" },
    { label: "GET /api/v1/portfolio/kpis", path: "/api/v1/portfolio/kpis" },
    { label: "page calculations", path: `/tr/app/projects/${project}/calculations`, page: true },
    { label: "GET /api/v1/reports/:id", path: `/api/v1/reports/${reportId}` },
  ],
  // contributor: the inbox
  zeynep: [
    { label: "GET /api/v1/tasks", path: "/api/v1/tasks" },
    { label: "GET /api/v1/portfolio", path: "/api/v1/portfolio" },
  ],
  // data owner and reviewer: inbox, review queue, the run list
  mehmet: [
    { label: "GET /api/v1/tasks", path: "/api/v1/tasks" },
    { label: "GET /api/v1/review-queue", path: "/api/v1/review-queue" },
    { label: "GET /api/v1/projects/:id/calculations", path: `/api/v1/projects/${project}/calculations` },
  ],
  // project lead: calculations and the report studio, page and API
  selin: [
    { label: "page calculations", path: `/tr/app/projects/${project}/calculations`, page: true },
    { label: "GET /api/v1/projects/:id/calculations", path: `/api/v1/projects/${project}/calculations` },
    { label: "page report studio", path: `/tr/app/projects/${project}/reports/${reportId}`, page: true },
    { label: "GET /api/v1/reports/:id", path: `/api/v1/reports/${reportId}` },
  ],
};
const PERSONAS = Object.keys(FLOWS) as Persona[];
const TENANT: Record<Persona, string> = { ayse: companyTenant, mehmet: companyTenant, zeynep: companyTenant, selin: companyTenant, can: advisoryTenant };

async function healthy(): Promise<boolean> {
  return fetch(`${E2E_ORIGIN}/api/v1/health`)
    .then((r) => r.ok)
    .catch(() => false);
}

async function ensureServer(): Promise<ChildProcess | null> {
  if (await healthy()) return null;
  const child = spawn(process.execPath, [join(WEB, "node_modules", "tsx", "dist", "cli.mjs"), join(WEB, "scripts", "e2e", "server.ts")], { cwd: WEB, stdio: "ignore" });
  for (let i = 0; i < 120; i++) {
    if (await healthy()) return child;
    await new Promise((r) => setTimeout(r, 500));
  }
  child.kill();
  throw new Error("e2e server did not become healthy (npm run build first?)");
}

/** A fresh session (Better Auth sign-in) with the workspace cookie, as the browser holds it. */
async function signIn(p: Persona): Promise<string> {
  const r = await fetch(`${E2E_ORIGIN}/api/auth/sign-in/email`, { method: "POST", headers: { "content-type": "application/json", origin: E2E_ORIGIN }, body: JSON.stringify({ email: f.people[p], password: f.password }) });
  if (!r.ok) throw new Error(`sign-in ${p}: HTTP ${r.status}`);
  const cookies = r.headers.getSetCookie().map((c) => c.split(";")[0]);
  return [...cookies, `isoline_tenant=${TENANT[p]}`].join("; ");
}

type Sample = { ms: number; status: number };
type LabelledRequest = autocannon.Request & { label: string };

/** One virtual user: one connection, its own cookie, its persona's steps in a loop. */
function runUser(cookie: string, steps: Step[], seconds: number, out: Map<string, Sample[]>): Promise<void> {
  return new Promise((resolve, reject) => {
    const requests: LabelledRequest[] = steps.map((s) => ({ method: "GET", path: s.path, headers: { cookie, accept: s.page ? "text/html" : "application/json" }, label: s.label }));
    const inst = autocannon({ url: E2E_ORIGIN, connections: 1, pipelining: 1, duration: seconds, timeout: 30, requests }, (err) => (err ? reject(err) : resolve()));
    // emitted after the response and before the client moves on, so currentRequest is the one that was answered
    inst.on("response", (client, status, _bytes, ms) => {
      const label = (client as unknown as { requestIterator: { currentRequest: LabelledRequest } }).requestIterator.currentRequest.label;
      const list = out.get(label) ?? [];
      list.push({ ms, status });
      out.set(label, list);
    });
  });
}

const pct = (sorted: number[], p: number) => sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];

async function phase(cookies: { p: Persona; cookie: string }[], seconds: number) {
  const out = new Map<string, Sample[]>();
  const t0 = performance.now();
  await Promise.all(cookies.map((c) => runUser(c.cookie, FLOWS[c.p], seconds, out)));
  return { out, wall: (performance.now() - t0) / 1000 };
}

async function main() {
  const server = await ensureServer();
  try {
    const users: { p: Persona; cookie: string }[] = [];
    for (let i = 0; i < USERS; i++) {
      const p = PERSONAS[i % PERSONAS.length];
      users.push({ p, cookie: await signIn(p) });
    }
    console.log(`${USERS} sessions signed in (${PERSONAS.map((p) => `${p} ×${users.filter((u) => u.p === p).length}`).join(", ")}); warm-up ${WARMUP}s, measurement ${DURATION}s`);
    if (WARMUP > 0) await phase(users, WARMUP);
    const { out, wall } = await phase(users, DURATION);

    const rows = [...out.entries()]
      .map(([label, samples]) => {
        const ms = samples.map((s) => s.ms).sort((a, b) => a - b);
        const errors = samples.filter((s) => s.status < 200 || s.status >= 300).length;
        const page = label.startsWith("page ");
        const limit = page ? THRESHOLDS.pageP95 : THRESHOLDS.apiP95;
        const p95 = pct(ms, 95);
        return { label, n: ms.length, rps: ms.length / wall, errors, p50: pct(ms, 50), p95, p99: pct(ms, 99), max: ms[ms.length - 1], limit, ok: p95 <= limit && errors / ms.length <= THRESHOLDS.errorRate };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
    const all = [...out.values()].flat();
    const allMs = all.map((s) => s.ms).sort((a, b) => a - b);
    const total = { n: all.length, rps: all.length / wall, errors: all.filter((s) => s.status < 200 || s.status >= 300).length, p50: pct(allMs, 50), p95: pct(allMs, 95), p99: pct(allMs, 99) };

    console.log(`\n| endpoint | requests | req/s | errors | p50 ms | p95 ms | p99 ms | max ms | p95 limit |\n|---|---:|---:|---:|---:|---:|---:|---:|---:|`);
    for (const r of rows) console.log(`| ${r.label} | ${r.n} | ${r.rps.toFixed(1)} | ${r.errors} | ${r.p50} | ${r.p95} | ${r.p99} | ${r.max} | ${r.limit}${r.ok ? "" : " ✗"} |`);
    console.log(`| **all** | ${total.n} | ${total.rps.toFixed(1)} | ${total.errors} | ${total.p50} | ${total.p95} | ${total.p99} | ${allMs[allMs.length - 1]} | |`);

    const dir = join(WEB, "scripts", "load", "results");
    mkdirSync(dir, { recursive: true });
    const file = join(dir, `load-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    writeFileSync(file, JSON.stringify({ at: new Date().toISOString(), users: USERS, duration: DURATION, warmup: WARMUP, thresholds: THRESHOLDS, total, endpoints: rows }, null, 2) + "\n");
    console.log(`\nraw results: ${file}`);
    const failed = rows.filter((r) => !r.ok);
    if (failed.length) {
      console.error(`thresholds missed: ${failed.map((r) => r.label).join(", ")}`);
      process.exitCode = 1;
    }
  } finally {
    server?.kill();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
