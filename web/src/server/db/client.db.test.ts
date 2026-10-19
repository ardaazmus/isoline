/**
 * withActor (ADR-003): the transaction and its RLS context open in one round trip; the context never outlives the
 * transaction, a failing callback or statement rolls back and leaves the pooled connection usable, and only checked
 * UUIDs reach the SQL text.
 */
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { sql } from "kysely";
import { appDb, closeDb, withActor, type Actor, type Db } from "./client";

afterAll(closeDb);

type Ctx = { pid: number; u: string | null; t: string | null; marker: string | null };
const context = (db: Db) =>
  sql<Ctx>`select pg_backend_pid() as pid, current_setting('app.user_id', true) as u, current_setting('app.acting_tenant_id', true) as t, current_setting('isoline.test_marker', true) as marker`
    .execute(db)
    .then((r) => r.rows[0]);
const blank = (v: string | null) => v === null || v === "";
const actor = (): Actor => ({ userId: randomUUID(), actingTenantId: randomUUID() });

describe("withActor", () => {
  it("sets the context inside one transaction and drops it when the transaction ends", async () => {
    const a = actor();
    const inside = await withActor(a, async (tx) => {
      const c = await context(tx);
      // now() is the transaction's start time: equal across statements only inside one transaction
      const [x, y] = [await sql<{ n: Date }>`select now() as n`.execute(tx), await sql<{ n: Date }>`select pg_sleep(0.02), now() as n`.execute(tx)];
      return { ...c, same: x.rows[0].n.getTime() === y.rows[0].n.getTime() };
    });
    expect(inside).toMatchObject({ u: a.userId, t: a.actingTenantId, same: true });
    // the pool hands back the connection just released: the same backend, with no context left on it
    const after = await context(appDb());
    expect(after.pid).toBe(inside.pid);
    expect(blank(after.u) && blank(after.t)).toBe(true);
  });

  it("writes an empty tenant for a person acting without one", async () => {
    const userId = randomUUID();
    expect(await withActor({ userId, actingTenantId: null }, (tx) => context(tx))).toMatchObject({ u: userId, t: "" });
  });

  it("rolls back when the callback throws, and the connection serves the next actor", async () => {
    const a = actor();
    let pid = 0;
    await expect(
      withActor(a, async (tx) => {
        pid = (await context(tx)).pid;
        // a session-level setting made inside a transaction disappears when that transaction rolls back
        await sql`select set_config('isoline.test_marker', 'kept', false)`.execute(tx);
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    const b = actor();
    const next = await withActor(b, (tx) => context(tx));
    expect(next.pid).toBe(pid);
    expect(blank(next.marker)).toBe(true);
    expect(next).toMatchObject({ u: b.userId, t: b.actingTenantId });
  });

  it("rolls back an aborted transaction after a failing statement", async () => {
    await expect(withActor(actor(), (tx) => sql`select 1 / 0`.execute(tx))).rejects.toThrow(/division by zero/);
    // were the aborted transaction left open, every statement here would fail with "current transaction is aborted"
    const b = actor();
    expect(await withActor(b, (tx) => context(tx))).toMatchObject({ u: b.userId, t: b.actingTenantId });
  });

  it("refuses ids that are not UUIDs before any SQL is sent", async () => {
    await expect(withActor({ userId: "x', true); drop table core.projects; --", actingTenantId: null }, async () => 1)).rejects.toThrow("invalid user id");
    await expect(withActor({ userId: randomUUID(), actingTenantId: "' or true --" }, async () => 1)).rejects.toThrow("invalid tenant id");
  });
});
