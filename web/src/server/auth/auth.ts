/**
 * The Better Auth instance (ADR-004) on the app database pool. Mails go out directly here because they are part of
 * the request the user just made (sign-up, reset); tenant mails go through the outbox.
 */
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import pg from "pg";
import { MAIL, sendMail } from "../mail/mailer";
import { authOptions } from "./options";

function build() {
  const baseUrl = process.env.BETTER_AUTH_URL ?? process.env.APP_BASE_URL ?? "http://localhost:3210";
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("BETTER_AUTH_SECRET is not set (scripts/dev-env.mjs)");
  const oidc = process.env.OIDC_ISSUER ? { issuer: process.env.OIDC_ISSUER, clientId: process.env.OIDC_CLIENT_ID ?? "", clientSecret: process.env.OIDC_CLIENT_SECRET ?? "" } : undefined;
  const options = authOptions(
    { baseUrl, secret, oidc },
    {
      verification: (to, url) => sendMail({ to, ...MAIL.verification(url) }),
      reset: (to, url) => sendMail({ to, ...MAIL.reset(url) }),
    },
  );
  return betterAuth({ ...options, database: new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5 }), plugins: [...(options.plugins ?? []), nextCookies()] });
}

type AuthInstance = ReturnType<typeof build>;
let instance: AuthInstance | null = null;

/** Lazily built so `next build` does not need a database. */
export function auth(): AuthInstance {
  instance ??= build();
  return instance;
}
