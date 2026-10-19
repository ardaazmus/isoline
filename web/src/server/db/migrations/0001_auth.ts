/**
 * Identity tables for Better Auth 1.7.7 with the twoFactor plugin and uuid ids (ADR-004). The SQL is what
 * Better Auth's own migration compiler produced for src/server/auth/options.ts (better-auth/db/migration,
 * compileMigrations) — kept verbatim so the schema matches the library. auth.schema.test.ts checks that
 * Better Auth finds nothing to create or add after this migration.
 */
import { sql, type Kysely } from "kysely";

const TABLES = ['"twoFactor"', '"verification"', '"account"', '"session"', '"user"'];

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`create table "user" ("id" uuid default pg_catalog.gen_random_uuid() not null primary key, "name" text not null, "email" text not null unique, "emailVerified" boolean not null, "image" text, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz default CURRENT_TIMESTAMP not null, "twoFactorEnabled" boolean)`.execute(db);
  await sql`create table "session" ("id" uuid default pg_catalog.gen_random_uuid() not null primary key, "expiresAt" timestamptz not null, "token" text not null unique, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz not null, "ipAddress" text, "userAgent" text, "userId" uuid not null references "user" ("id") on delete cascade)`.execute(db);
  await sql`create table "account" ("id" uuid default pg_catalog.gen_random_uuid() not null primary key, "accountId" text not null, "providerId" text not null, "userId" uuid not null references "user" ("id") on delete cascade, "accessToken" text, "refreshToken" text, "idToken" text, "accessTokenExpiresAt" timestamptz, "refreshTokenExpiresAt" timestamptz, "scope" text, "password" text, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz not null)`.execute(db);
  await sql`create table "verification" ("id" uuid default pg_catalog.gen_random_uuid() not null primary key, "identifier" text not null, "value" text not null, "expiresAt" timestamptz not null, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz default CURRENT_TIMESTAMP not null)`.execute(db);
  await sql`create table "twoFactor" ("id" uuid default pg_catalog.gen_random_uuid() not null primary key, "secret" text not null, "backupCodes" text not null, "userId" uuid not null references "user" ("id") on delete cascade, "verified" boolean, "failedVerificationCount" integer, "lockedUntil" timestamptz)`.execute(db);
  await sql`create index "session_userId_idx" on "session" ("userId")`.execute(db);
  await sql`create index "account_userId_idx" on "account" ("userId")`.execute(db);
  await sql`create index "verification_identifier_idx" on "verification" ("identifier")`.execute(db);
  await sql`create index "twoFactor_secret_idx" on "twoFactor" ("secret")`.execute(db);
  await sql`create index "twoFactor_userId_idx" on "twoFactor" ("userId")`.execute(db);
  // the identity layer is not tenant data: no RLS; both runtime roles need it
  await sql.raw(`grant select, insert, update, delete on ${TABLES.join(", ")} to isoline_app, isoline_system`).execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  for (const t of TABLES) await sql.raw(`drop table if exists ${t}`).execute(db);
}
