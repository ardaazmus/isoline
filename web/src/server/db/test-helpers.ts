/** Helpers for database tests: users are created directly (the identity layer is exercised in auth tests). */
import { randomUUID } from "node:crypto";
import { systemDb } from "./client";
import type { Identity } from "../tenancy/service";

let n = 0;
export async function makeUser(label: string, opts: { verified?: boolean } = {}): Promise<Identity> {
  n++;
  const email = `${label.toLowerCase()}.${n}.${randomUUID().slice(0, 8)}@example.test`;
  const u = await systemDb()
    .insertInto("user")
    .values({ name: label, email, emailVerified: opts.verified ?? true })
    .returning(["id", "email", "emailVerified"])
    .executeTakeFirstOrThrow();
  return { userId: u.id, email: u.email, emailVerified: u.emailVerified };
}

/** Moves a row's expiry into the past (tests for expired invitations and grants). */
export async function expire(table: "core.invitations" | "core.external_grants", id: string): Promise<void> {
  // created_at is moved back too so the "expires after created" check still holds
  await systemDb().updateTable(table).set({ created_at: new Date(Date.now() - 3 * 864e5), expires_at: new Date(Date.now() - 864e5) }).where("id", "=", id).execute();
}
