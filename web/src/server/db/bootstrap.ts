/**
 * Cluster bootstrap (ADR-002, ADR-003): roles and an application database. Runs with the superuser URL
 * (DATABASE_ADMIN_URL) and is idempotent, so it serves development, the test suite and a fresh server alike.
 *
 *   isoline_owner   LOGIN               owns the schema objects; migrations run as this role
 *   isoline_app     LOGIN NOBYPASSRLS   the web runtime; every table it touches has FORCE ROW LEVEL SECURITY
 *   isoline_system  LOGIN BYPASSRLS     narrow server-only paths (sign-up bootstrap, invitation acceptance, worker)
 *   isoline_rls     NOLOGIN BYPASSRLS   owns the authz.* helper functions (SECURITY DEFINER) so policies can read
 *                                       memberships and grants without recursing into their own policies
 */
import pg from "pg";

export type BootstrapOptions = {
  adminUrl: string;
  database: string;
  passwords: { owner: string; app: string; system: string };
  /** Drop and recreate the database (tests). */
  recreate?: boolean;
};

const ident = (s: string) => {
  if (!/^[a-z_][a-z0-9_]*$/.test(s)) throw new Error(`unsafe identifier: ${s}`);
  return `"${s}"`;
};
const literal = (s: string) => `'${s.replace(/'/g, "''")}'`;

async function ensureRole(c: pg.Client, name: string, attrs: string, password?: string) {
  const exists = await c.query("select 1 from pg_roles where rolname = $1", [name]);
  const pw = password === undefined ? "" : ` PASSWORD ${literal(password)}`;
  await c.query(`${exists.rowCount ? "ALTER" : "CREATE"} ROLE ${ident(name)} WITH ${attrs}${pw}`);
}

export async function bootstrapCluster(o: BootstrapOptions): Promise<void> {
  const admin = new pg.Client({ connectionString: o.adminUrl });
  await admin.connect();
  try {
    await ensureRole(admin, "isoline_owner", "LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS", o.passwords.owner);
    await ensureRole(admin, "isoline_app", "LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS", o.passwords.app);
    await ensureRole(admin, "isoline_system", "LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE BYPASSRLS", o.passwords.system);
    await ensureRole(admin, "isoline_rls", "NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE BYPASSRLS");
    // the owner creates the helper functions and hands them to isoline_rls
    await admin.query("GRANT isoline_rls TO isoline_owner");

    const db = ident(o.database);
    const has = await admin.query("select 1 from pg_database where datname = $1", [o.database]);
    if (has.rowCount && o.recreate) {
      await admin.query("select pg_terminate_backend(pid) from pg_stat_activity where datname = $1 and pid <> pg_backend_pid()", [o.database]);
      await admin.query(`DROP DATABASE ${db}`);
    }
    if (!has.rowCount || o.recreate) await admin.query(`CREATE DATABASE ${db} OWNER isoline_owner`);
    await admin.query(`REVOKE ALL ON DATABASE ${db} FROM PUBLIC`);
    await admin.query(`GRANT CONNECT, TEMPORARY ON DATABASE ${db} TO isoline_app, isoline_system`);
  } finally {
    await admin.end();
  }

  // inside the database: extensions need superuser; the public schema belongs to the owner alone
  const url = new URL(o.adminUrl);
  url.pathname = `/${o.database}`;
  const inDb = new pg.Client({ connectionString: url.toString() });
  await inDb.connect();
  try {
    await inDb.query("CREATE EXTENSION IF NOT EXISTS pgcrypto");
    await inDb.query("CREATE EXTENSION IF NOT EXISTS citext");
    await inDb.query("ALTER SCHEMA public OWNER TO isoline_owner");
    await inDb.query("REVOKE CREATE ON SCHEMA public FROM PUBLIC");
  } finally {
    await inDb.end();
  }
}

export async function dropDatabase(adminUrl: string, database: string): Promise<void> {
  const admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
  try {
    await admin.query("select pg_terminate_backend(pid) from pg_stat_activity where datname = $1 and pid <> pg_backend_pid()", [database]);
    await admin.query(`DROP DATABASE IF EXISTS ${ident(database)}`);
  } finally {
    await admin.end();
  }
}
