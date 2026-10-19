/**
 * Query profile of the load-test endpoints on the e2e database: for each endpoint the number of SQL statements one
 * request runs, their database time and, with --explain, EXPLAIN ANALYZE of the slowest statement as the app role
 * under RLS. This is how N+1 patterns and missing indexes were looked for (docs/erp/G8/02_YUK_TESTI.md).
 *
 *   npm run e2e:server                        (the request-pipeline case signs in over HTTP)
 *   npm run load:profile -- --explain
 */
import pg from "pg";
import { readFileSync } from "node:fs";
import { E2E_ORIGIN, FIXTURE_FILE, e2eEnv } from "../e2e/env";

Object.assign(process.env, e2eEnv());

type Q = { text: string; values: unknown[]; ms: number };
let log: Q[] | null = null;
// count and time every statement any pool client sends (Kysely's PostgresDialect uses pg.Pool clients)
const original = pg.Client.prototype.query as (...a: unknown[]) => unknown;
pg.Client.prototype.query = function (this: pg.Client, ...a: unknown[]) {
  const t0 = performance.now();
  const r = original.apply(this, a) as Promise<unknown> | undefined;
  const cfg = a[0] as string | { text: string; values?: unknown[] };
  const text = typeof cfg === "string" ? cfg : cfg?.text;
  const values = (typeof cfg === "string" ? (a[1] as unknown[]) : cfg?.values) ?? [];
  if (log && r && typeof (r as Promise<unknown>).then === "function") (r as Promise<unknown>).then(() => log?.push({ text, values, ms: performance.now() - t0 }), () => undefined);
  return r;
} as typeof pg.Client.prototype.query;

async function main() {
  const f = JSON.parse(readFileSync(FIXTURE_FILE, "utf8")) as { password: string; people: Record<string, string>; ids: Record<string, string> };
  const { withSystem, closeDb } = await import("../../src/server/db/client");
  const users = await withSystem("profile: demo user ids", (tx) => tx.selectFrom("user").select(["id", "email"]).where("email", "in", Object.values(f.people)).execute());
  const id = (p: string) => users.find((u) => u.email === f.people[p])!.id;
  const actor = (p: string, tenant: string) => ({ userId: id(p), actingTenantId: f.ids[tenant] });

  const cookie = async (p: string) => {
    const r = await fetch(`${E2E_ORIGIN}/api/auth/sign-in/email`, { method: "POST", headers: { "content-type": "application/json", origin: E2E_ORIGIN }, body: JSON.stringify({ email: f.people[p], password: f.password }) });
    if (!r.ok) throw new Error(`sign-in ${p}: ${r.status} (is the e2e server running? npm run e2e:server)`);
    return r.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  };

  const { sessionFrom, tenantActor } = await import("../../src/server/http/api");
  const { portfolio } = await import("../../src/server/projects/service");
  const { portfolioKpis } = await import("../../src/server/portfolio/kpis");
  const { myTasks } = await import("../../src/server/data/service");
  const { reviewQueue } = await import("../../src/server/close/service");
  const { listRuns } = await import("../../src/server/calc/service");
  const { getReport } = await import("../../src/server/reports/service");
  const { cycleProgress, latestCycles } = await import("../../src/server/cycle/progress");
  const { myInbox } = await import("../../src/server/inbox/service");

  const can = actor("can", "advisoryTenant");
  const ayse = actor("ayse", "companyTenant");
  const selin = actor("selin", "companyTenant");
  const mehmet = actor("mehmet", "companyTenant");
  const zeynep = actor("zeynep", "companyTenant");
  const canCookie = await cookie("can");

  const cases: [string, () => Promise<unknown>][] = [
    ["request pipeline: session + workspace check", async () => tenantActor((await sessionFrom(new Headers({ cookie: canCookie })))!, f.ids.advisoryTenant, "profile")],
    ["portfolio (consultant, 21 projects)", () => portfolio(can)],
    ["portfolio KPIs (consultant, 21 projects)", () => portfolioKpis(can)],
    ["portfolio (company)", () => portfolio(ayse)],
    ["portfolio KPIs (company)", () => portfolioKpis(ayse)],
    ["task inbox (contributor)", () => myTasks(zeynep)],
    ["task inbox (reviewer)", () => myTasks(mehmet)],
    ["review queue (reviewer)", () => reviewQueue(mehmet)],
    ["review queue (consultant)", () => reviewQueue(can)],
    ["calculation runs", () => listRuns(selin, f.ids.companyProject)],
    ["report studio", () => getReport(selin, f.ids.reportId)],
    // UX redesign: the step bar of every project page, Today and My work
    ["cycle steps (step bar, one cycle)", () => cycleProgress(ayse, f.ids.cycleId)],
    ["Today: latest cycles (consultant, 21 projects)", () => latestCycles(can)],
    ["Today: latest cycles (company)", () => latestCycles(ayse)],
    ["My work: single inbox (owner)", () => myInbox(ayse)],
    ["My work: single inbox (consultant)", () => myInbox(can)],
  ];

  const rows: { name: string; statements: number; dbMs: number; slowest: Q }[] = [];
  for (const [name, fn] of cases) {
    await fn(); // warm (module, plan and buffer caches)
    log = [];
    await fn();
    const q = log;
    log = null;
    const work = q.filter((x) => !/^(begin|commit|rollback)/i.test(x.text.trim()));
    const slowest = work.slice().sort((a, b) => b.ms - a.ms)[0];
    rows.push({ name, statements: work.length, dbMs: work.reduce((s, x) => s + x.ms, 0), slowest });
  }
  console.log("| endpoint | SQL statements | database ms | slowest statement ms |\n|---|---:|---:|---:|");
  for (const r of rows) console.log(`| ${r.name} | ${r.statements} | ${r.dbMs.toFixed(1)} | ${r.slowest?.ms.toFixed(1) ?? "-"} |`);

  if (process.argv.includes("--explain")) {
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
    for (const r of rows.filter((x) => x.slowest && !x.name.startsWith("request pipeline")).sort((a, b) => b.slowest.ms - a.slowest.ms).slice(0, 4)) {
      const c = await pool.connect();
      const who = r.name.includes("consultant") ? can : r.name.includes("contributor") ? zeynep : r.name.includes("reviewer") ? mehmet : selin;
      await c.query("begin");
      await c.query("select set_config('app.user_id', $1, true), set_config('app.acting_tenant_id', $2, true)", [who.userId, who.actingTenantId]);
      const plan = await c.query(`explain (analyze, buffers, costs off) ${r.slowest.text}`, r.slowest.values);
      await c.query("rollback");
      c.release();
      console.log(`\n### ${r.name} — ${r.slowest.ms.toFixed(1)} ms\n${r.slowest.text.slice(0, 400)}\n${plan.rows.map((x) => x["QUERY PLAN"]).join("\n")}`);
    }
    await pool.end();
  }
  await closeDb();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
