/**
 * Data access layer for server-rendered platform pages (Next.js authentication guide: verify the session close to
 * the data). Every page calls one of these; the services behind them check permissions again under RLS.
 */
import { randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { HttpError } from "../policy/policy";
import type { Membership } from "../tenancy/service";
import { personContext } from "../tenancy/person";
import { actorOf, sessionFrom, TENANT_COOKIE, type Session, type TenantActor } from "./api";

export const getSession = cache(async (): Promise<Session | null> => sessionFrom(await headers()));

/** The person's workspaces and unread notifications, read once per request (the platform layout and requireWorkspace). */
export const getPerson = cache((userId: string) => personContext(userId));

export const getMemberships = cache(async (userId: string): Promise<Membership[]> => (await getPerson(userId)).memberships);

/** Signed-in, verified person or a redirect to the sign-in screen (with a safe return path). */
export async function requireSession(lang: string, next?: string): Promise<Session> {
  const s = await getSession();
  if (!s) redirect(`/${lang}/auth/login${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  if (!s.identity.emailVerified) redirect(`/${lang}/auth/verify-email`);
  return s;
}

export type Workspace = { session: Session; memberships: Membership[]; actor: TenantActor; tenant: Membership };

/**
 * The acting workspace from the cookie, checked against live membership and the MFA rule. Without a valid choice the
 * person goes to the workspace chooser (or onboarding when they have none). The membership list of this request is
 * the live check (same rows and rule as tenantActor), so a page does not ask the database a second time.
 */
export const requireWorkspace = cache(async (lang: string): Promise<Workspace> => {
  const session = await requireSession(lang);
  const memberships = await getMemberships(session.identity.userId);
  if (!memberships.length) redirect(`/${lang}/app/onboarding`);
  const chosen = (await cookies()).get(TENANT_COOKIE)?.value ?? null;
  const tenant = memberships.find((m) => m.tenantId === chosen);
  if (!tenant) redirect(`/${lang}/app/choose`);
  try {
    const actor = actorOf(session, tenant, randomUUID());
    return { session, memberships, actor, tenant };
  } catch (e) {
    if (e instanceof HttpError && e.code === "mfa_required") redirect(`/${lang}/app/account/security?reason=mfa_required`);
    throw e;
  }
});

/** Safe in-app return path: only "/xx/..." paths on this site. */
export function safeNext(next: string | undefined | null, lang: string): string {
  if (next && /^\/[a-z]{2}(\/[\w\-./%?=&]*)?$/.test(next) && !next.startsWith("//")) return next;
  return `/${lang}/app`;
}
