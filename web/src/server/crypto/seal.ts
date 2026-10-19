/**
 * Small secrets that must travel through the database (an invitation token waiting in the outbox) are sealed with
 * AES-256-GCM. The database alone is then not enough to accept someone else's invitation. The key comes from
 * APP_ENCRYPTION_KEY (32 bytes, base64url) and never leaves the server.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function key(): Buffer {
  const raw = process.env.APP_ENCRYPTION_KEY;
  if (!raw) throw new Error("APP_ENCRYPTION_KEY is not set (scripts/dev-env.mjs)");
  const k = Buffer.from(raw, "base64url");
  if (k.length !== 32) throw new Error("APP_ENCRYPTION_KEY must be 32 bytes (base64url)");
  return k;
}

export function seal(plain: string, aad = ""): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  c.setAAD(Buffer.from(aad));
  const body = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), body.toString("base64url"), c.getAuthTag().toString("base64url")].join(".");
}

export function unseal(sealed: string, aad = ""): string {
  const [v, iv, body, tag] = sealed.split(".");
  if (v !== "v1" || !iv || body === undefined || !tag) throw new Error("unseal: unknown format");
  const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  d.setAAD(Buffer.from(aad));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(body, "base64url")), d.final()]).toString("utf8");
}
