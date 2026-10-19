/**
 * G1-02: the identity schema matches the Better Auth version in use, TOTP enrolment works end to end, a second
 * factor is demanded at the next sign-in, and a workspace that requires MFA accepts the enrolled person.
 */
import { createHmac } from "node:crypto";
import { getMigrations } from "better-auth/db/migration";
import pg from "pg";
import { afterAll, describe, expect, it } from "vitest";
import * as projectsRoute from "@/app/api/v1/projects/route";
import * as tenantRoute from "@/app/api/v1/tenant/route";
import * as tenantsRoute from "@/app/api/v1/tenants/route";
import { closeDb } from "../db/client";
import { Browser, PASSWORD, signedUp } from "../http/test-client";
import { authOptions } from "./options";

/** RFC 6238 TOTP (SHA-1, 6 digits, 30 s) from an otpauth:// URI. */
function totp(uri: string, offset = 0): string {
  const secret = new URL(uri).searchParams.get("secret")!;
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const c of secret.replace(/=+$/, "").toUpperCase()) bits += alphabet.indexOf(c).toString(2).padStart(5, "0");
  const key = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000) + offset));
  const h = createHmac("sha1", key).update(counter).digest();
  const o = h[h.length - 1] & 0xf;
  return ((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).toString().padStart(6, "0");
}

afterAll(async () => {
  await closeDb();
});

describe("identity schema (ADR-004)", () => {
  it("Better Auth finds nothing to create or add in our migrated schema", async () => {
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_OWNER_URL, max: 1 });
    try {
      const m = await getMigrations({ ...authOptions({ baseUrl: "http://localhost:3210", secret: "x".repeat(32) }, { verification: async () => {}, reset: async () => {} }), database: pool });
      expect(m.toBeCreated.map((t) => t.table)).toEqual([]);
      expect(m.toBeAdded.map((t) => `${t.table}:${Object.keys(t.fields)}`)).toEqual([]);
    } finally {
      await pool.end();
    }
  });
});

describe("TOTP MFA (G1-02)", () => {
  it("enrol → verify → next sign-in needs the second factor → MFA-required workspace accepts", async () => {
    const { b, email } = await signedUp("totp");
    const r = await b.call(tenantsRoute.POST, "POST", "/api/v1/tenants", { body: { name: "MFA Zorunlu A.Ş.", kind: "company", acceptTerms: true, termsVersion: "terms-2026-10" } });
    b.tenant = String(r.json.tenantId);

    const enable = await b.auth("POST", "/two-factor/enable", { password: PASSWORD });
    expect(enable.status).toBe(200);
    const { totpURI, backupCodes } = (await enable.json()) as { totpURI: string; backupCodes: string[] };
    expect(totpURI.startsWith("otpauth://totp/")).toBe(true);
    expect(backupCodes.length).toBeGreaterThanOrEqual(8);
    expect((await b.auth("POST", "/two-factor/verify-totp", { code: "000000" })).status).toBe(401);
    const verified = await b.auth("POST", "/two-factor/verify-totp", { code: totp(totpURI) });
    expect(verified.status).toBe(200);

    expect((await b.call(tenantRoute.PATCH, "PATCH", "/api/v1/tenant", { body: { requireMfa: true } })).status).toBe(200);
    expect((await b.call(projectsRoute.GET, "GET", "/api/v1/projects")).status).toBe(200);

    // a fresh browser: the password alone is not a session any more
    const fresh = new Browser();
    fresh.tenant = b.tenant;
    const first = await fresh.auth("POST", "/sign-in/email", { email, password: PASSWORD });
    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({ twoFactorRedirect: true });
    expect((await fresh.call(projectsRoute.GET, "GET", "/api/v1/projects")).status).toBe(401);
    const second = await fresh.auth("POST", "/two-factor/verify-totp", { code: totp(totpURI, 1) });
    expect(second.status).toBe(200);
    expect((await fresh.call(projectsRoute.GET, "GET", "/api/v1/projects")).status).toBe(200);
  });
});
