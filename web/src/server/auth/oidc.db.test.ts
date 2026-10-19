/**
 * G8 (plan 12 §3, ADR-004): enterprise single sign-on through OpenID Connect. A mock identity provider publishes
 * a discovery document and a JWKS; the authorisation code flow with PKCE and a nonce-bound, RS256-signed ID token
 * signs a person in and links the account to the provider subject. A token signed with another key is refused.
 */
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { betterAuth } from "better-auth";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb, systemDb } from "../db/client";
import { authOptions } from "./options";

const BASE = "http://localhost:3210";
let idp: Server, issuer: string;
let signKey: CryptoKey, otherKey: CryptoKey;
let useOtherKey = false;
const codes = new Map<string, { nonce: string; email: string }>();
let pool: pg.Pool;
let auth: { handler: (r: Request) => Promise<Response> };

beforeAll(async () => {
  const pair = await generateKeyPair("RS256", { extractable: true });
  signKey = pair.privateKey;
  otherKey = (await generateKeyPair("RS256")).privateKey;
  const jwk = { ...(await exportJWK(pair.publicKey)), kid: "k1", alg: "RS256", use: "sig" };
  idp = createServer(async (req, res) => {
    const url = new URL(req.url!, issuer);
    const json = (o: unknown) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(o));
    };
    if (url.pathname === "/.well-known/openid-configuration")
      return json({ issuer, authorization_endpoint: `${issuer}/authorize`, token_endpoint: `${issuer}/token`, userinfo_endpoint: `${issuer}/userinfo`, jwks_uri: `${issuer}/jwks`, id_token_signing_alg_values_supported: ["RS256"], response_types_supported: ["code"], subject_types_supported: ["public"], scopes_supported: ["openid", "email", "profile"] });
    if (url.pathname === "/jwks") return json({ keys: [jwk] });
    if (url.pathname === "/token") {
      let body = "";
      for await (const chunk of req) body += chunk;
      const p = new URLSearchParams(body);
      const c = codes.get(p.get("code") ?? "");
      if (!c || !p.get("code_verifier")) {
        res.writeHead(400);
        return res.end(JSON.stringify({ error: "invalid_grant" }));
      }
      const now = Math.floor(Date.now() / 1000);
      const idToken = await new SignJWT({ email: c.email, email_verified: true, name: "Kurumsal Kullanıcı", nonce: c.nonce })
        .setProtectedHeader({ alg: "RS256", kid: "k1" })
        .setIssuer(issuer)
        .setAudience("isoline")
        .setSubject(`sub-${c.email}`)
        .setIssuedAt(now)
        .setExpirationTime(now + 300)
        .sign(useOtherKey ? otherKey : signKey);
      return json({ access_token: "at-1", token_type: "Bearer", expires_in: 300, id_token: idToken });
    }
    if (url.pathname === "/userinfo") return json({ sub: "sub-x", email: "x@example.test", email_verified: true });
    res.writeHead(404);
    res.end();
  });
  await new Promise<void>((r) => idp.listen(0, "127.0.0.1", r));
  issuer = `http://127.0.0.1:${(idp.address() as AddressInfo).port}`;
  pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
  const options = authOptions({ baseUrl: BASE, secret: "s".repeat(40), oidc: { issuer, clientId: "isoline", clientSecret: "idp-secret" } }, { verification: async () => {}, reset: async () => {} });
  auth = betterAuth({ ...options, database: pool });
});

afterAll(async () => {
  idp.close();
  await pool.end();
  await closeDb();
});

/** Starts the flow, plays the identity provider's redirect, returns the callback response. */
async function signIn(email: string) {
  const start = await auth.handler(new Request(`${BASE}/api/auth/sign-in/social`, { method: "POST", headers: { "content-type": "application/json", origin: BASE }, body: JSON.stringify({ provider: "oidc", callbackURL: "/tr/app" }) }));
  expect(start.status).toBe(200);
  const { url } = (await start.json()) as { url: string };
  const authorize = new URL(url);
  expect(authorize.origin + authorize.pathname).toBe(`${issuer}/authorize`);
  expect(authorize.searchParams.get("code_challenge_method")).toBe("S256");
  const nonce = authorize.searchParams.get("nonce")!;
  expect(nonce).toBeTruthy();
  const code = `code-${email}`;
  codes.set(code, { nonce, email });
  const cookies = start.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  const cb = new URL(authorize.searchParams.get("redirect_uri")!);
  cb.searchParams.set("code", code);
  cb.searchParams.set("state", authorize.searchParams.get("state")!);
  return auth.handler(new Request(cb, { headers: { cookie: cookies } }));
}

describe("OpenID Connect sign-in (G8)", () => {
  it("authorisation code + PKCE + verified, nonce-bound ID token → a verified person with a session", async () => {
    const res = await signIn("sso.user@example.test");
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/tr/app");
    expect(res.headers.getSetCookie().some((c) => c.includes("session_token"))).toBe(true);
    const u = await systemDb().selectFrom("user").select(["id", "email", "emailVerified"]).where("email", "=", "sso.user@example.test").executeTakeFirstOrThrow();
    expect(u.emailVerified).toBe(true);
    const acc = await systemDb().selectFrom("account").select(["providerId", "accountId"]).where("userId", "=", u.id).executeTakeFirstOrThrow();
    expect(acc).toEqual({ providerId: "oidc", accountId: "sub-sso.user@example.test" });
  });

  it("an ID token signed with a key outside the provider's JWKS is refused", async () => {
    useOtherKey = true;
    const res = await signIn("forged@example.test");
    useOtherKey = false;
    expect(res.headers.getSetCookie().some((c) => c.includes("session_token"))).toBe(false);
    expect(await systemDb().selectFrom("user").select("id").where("email", "=", "forged@example.test").executeTakeFirst()).toBeUndefined();
  });
});
