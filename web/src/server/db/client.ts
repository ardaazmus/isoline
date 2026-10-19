/**
 * Database access (ADR-002, ADR-003). Two pools:
 *   app    — isoline_app, RLS enforced. Use withActor(): one transaction, SET LOCAL app.user_id / app.acting_tenant_id.
 *   system — isoline_system, BYPASSRLS. Use withSystem() only for the narrow server paths that legitimately cross
 *            tenants (sign-up bootstrap, invitation acceptance, provisional claim, worker). Every call names a reason
 *            that is written to the audit payload.
 * SET LOCAL ends with the transaction, so a pooled connection never carries the previous request's context.
 */
import { Kysely, PostgresDialect, sql, type Transaction } from "kysely";
import pg from "pg";
import type { DB } from "./schema";

export type Db = Kysely<DB>;
export type Tx = Transaction<DB>;

/** The verified actor of a request: who (from the session) and on behalf of which tenant (checked membership). */
export type Actor = { userId: string; actingTenantId: string | null; requestId?: string };

// numeric stays a string (exact); bigint ids and counters fit in a double; calendar dates stay "YYYY-MM-DD" (no
// time-zone shift); timestamps come back as Date
pg.types.setTypeParser(pg.types.builtins.INT8, (v) => Number(v));
pg.types.setTypeParser(pg.types.builtins.DATE, (v) => v);

const pools = new Map<string, Db>();

function dbFor(url: string | undefined, name: string): Db {
  if (!url) throw new Error(`${name} database URL is not configured`);
  let db = pools.get(url);
  if (!db) {
    db = new Kysely<DB>({ dialect: new PostgresDialect({ pool: new pg.Pool({ connectionString: url, max: Number(process.env.DB_POOL_MAX ?? 10) }) }) });
    pools.set(url, db);
  }
  return db;
}

export const appDb = () => dbFor(process.env.DATABASE_URL, "app");
export const systemDb = () => dbFor(process.env.DATABASE_SYSTEM_URL, "system");

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Runs fn in one RLS-scoped transaction as the actor. The actor must come from a verified session. */
export async function withActor<T>(actor: Actor, fn: (tx: Tx) => Promise<T>): Promise<T> {
  if (!UUID.test(actor.userId)) throw new Error("withActor: invalid user id");
  if (actor.actingTenantId !== null && !UUID.test(actor.actingTenantId)) throw new Error("withActor: invalid tenant id");
  return appDb()
    .transaction()
    .execute(async (tx) => {
      await sql`select set_config('app.user_id', ${actor.userId}, true), set_config('app.acting_tenant_id', ${actor.actingTenantId ?? ""}, true)`.execute(tx);
      return fn(tx);
    });
}

/** Server-only privileged transaction. Keep the call sites few, reviewed and audited. */
export async function withSystem<T>(reason: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  if (!reason) throw new Error("withSystem needs a reason");
  return systemDb().transaction().execute(fn);
}

/** Closes the pools (tests, worker shutdown). */
export async function closeDb(): Promise<void> {
  await Promise.all([...pools.values()].map((d) => d.destroy()));
  pools.clear();
}
