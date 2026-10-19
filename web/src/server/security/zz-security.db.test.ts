/**
 * G8-08 security checks against the real database, after the other integration files have filled it:
 *   - every table in core has row-level security enabled and forced (the owner role too);
 *   - a signed-in member of an unrelated tenant sees zero rows of other tenants in every tenant-owned table;
 *   - the application role cannot rewrite history (no UPDATE/DELETE on the audit log, no DELETE on snapshots,
 *     releases, observation versions or metric facts).
 */
import { sql } from "kysely";
import { afterAll, describe, expect, it } from "vitest";
import { closeDb, systemDb, withActor } from "../db/client";
import { makeUser } from "../db/test-helpers";
import { createTenant } from "../tenancy/service";

afterAll(async () => {
  await closeDb();
});

/** Tables readable by every signed-in workspace by design (reference data, the actor's own rows). */
const SHARED = new Set(["metric_definitions", "framework_versions", "reference_versions", "factor_sets", "factor_values", "idempotency_keys", "notifications", "memberships", "tenants", "invitations", "external_grants", "consent_records"]);

describe("RLS everywhere and no cross-tenant leak (G8-08)", () => {
  it("row-level security is enabled and forced on every core table", async () => {
    const r = await sql<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }>`
      select c.relname, c.relrowsecurity, c.relforcerowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'core' and c.relkind = 'r' order by c.relname`.execute(systemDb());
    const weak = r.rows.filter((t) => !t.relrowsecurity || !t.relforcerowsecurity).map((t) => t.relname);
    expect(weak).toEqual([]);
    expect(r.rows.length).toBeGreaterThan(45);
  });

  it("an unrelated tenant's member reads zero foreign rows from every tenant-owned table", async () => {
    const u = await makeUser("Stranger");
    const tenant = await createTenant(u, { name: "İlgisiz Şirket", kind: "company", termsVersion: "t" });
    const tables = await sql<{ table_name: string }>`
      select table_name from information_schema.columns where table_schema = 'core' and column_name = 'owner_tenant_id' order by table_name`.execute(systemDb());
    const checked: string[] = [];
    const filled: string[] = [];
    for (const { table_name: t } of tables.rows) {
      if (SHARED.has(t)) continue;
      const total = await sql<{ n: number }>`select count(*)::int as n from ${sql.table(`core.${t}`)} where owner_tenant_id <> ${tenant}::uuid`.execute(systemDb());
      if (total.rows[0].n > 0) filled.push(t);
      // no privilege at all (e.g. the outbox) is even stricter than an empty result
      const seen = await withActor({ userId: u.userId, actingTenantId: tenant }, (tx) => sql<{ n: number }>`select count(*)::int as n from ${sql.table(`core.${t}`)} where owner_tenant_id <> ${tenant}::uuid`.execute(tx)).catch((e: { code?: string }) => {
        if (e.code === "42501") return { rows: [{ n: 0 }] };
        throw e;
      });
      expect(seen.rows[0].n, `core.${t}`).toBe(0);
      checked.push(t);
    }
    // the check means something only if the other files left data in most tables
    expect(checked.length).toBeGreaterThan(40);
    expect(filled.length).toBeGreaterThan(30);
  });

  it("the application role cannot rewrite history", async () => {
    const r = await sql<{ table_name: string; privilege_type: string }>`
      select table_name, privilege_type from information_schema.role_table_grants
      where grantee = 'isoline_app' and table_schema = 'core' and privilege_type in ('UPDATE','DELETE')`.execute(systemDb());
    const has = (t: string, p: string) => r.rows.some((x) => x.table_name === t && x.privilege_type === p);
    expect(has("audit_events", "UPDATE") || has("audit_events", "DELETE")).toBe(false);
    for (const t of ["cycle_snapshots", "snapshot_facts", "report_releases", "release_assets", "observation_versions", "metric_fact_versions", "calculation_runs", "run_inputs"]) expect(has(t, "DELETE"), t).toBe(false);
    // column-level only: snapshot facts and release assets are never updated
    const cols = await sql<{ table_name: string }>`
      select distinct table_name from information_schema.column_privileges where grantee = 'isoline_app' and table_schema = 'core' and privilege_type = 'UPDATE' and table_name in ('snapshot_facts','release_assets','run_inputs','audit_events')`.execute(systemDb());
    expect(cols.rows.map((x) => x.table_name)).toEqual([]);
  });
});
