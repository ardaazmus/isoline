/**
 * Better Auth options (ADR-004): identity, sessions and TOTP MFA only. Tenancy, membership and grants live in
 * our own tables. Kept free of Next.js imports so migrations and tests can build the same configuration.
 */
import type { BetterAuthOptions } from "better-auth";
import { genericOAuth, twoFactor } from "better-auth/plugins";

export type AuthMailer = {
  verification: (to: string, url: string) => Promise<void>;
  reset: (to: string, url: string) => Promise<void>;
};

export function authOptions(env: { baseUrl: string; secret: string; oidc?: { issuer: string; clientId: string; clientSecret: string } }, mailer: AuthMailer): BetterAuthOptions {
  const plugins: NonNullable<BetterAuthOptions["plugins"]> = [twoFactor({ issuer: "Isoline" })];
  if (env.oidc?.issuer) {
    // Enterprise SSO (Keycloak, Entra ID, Google Workspace…) through the issuer's discovery document
    plugins.push(
      genericOAuth({
        config: [{ providerId: "oidc", discoveryUrl: `${env.oidc.issuer.replace(/\/$/, "")}/.well-known/openid-configuration`, clientId: env.oidc.clientId, clientSecret: env.oidc.clientSecret, scopes: ["openid", "email", "profile"], pkce: true }],
      }),
    );
  }
  return {
    appName: "Isoline",
    baseURL: env.baseUrl,
    secret: env.secret,
    trustedOrigins: [env.baseUrl],
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      revokeSessionsOnPasswordReset: true,
      resetPasswordTokenExpiresIn: 60 * 30,
      sendResetPassword: async ({ user, url }) => mailer.reset(user.email, url),
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      expiresIn: 60 * 60 * 24,
      sendVerificationEmail: async ({ user, url }) => mailer.verification(user.email, url),
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      // critical actions (approval, release, grant) ask for a sign-in within the last 10 minutes
      freshAge: 60 * 10,
    },
    advanced: { database: { generateId: "uuid" }, useSecureCookies: env.baseUrl.startsWith("https://") },
    // brute-force protection; integration tests turn it off with AUTH_RATE_LIMIT=off (they sign up dozens of people)
    rateLimit: { enabled: process.env.AUTH_RATE_LIMIT !== "off", window: 60, max: 100 },
    plugins,
  };
}
