import { headers } from "next/headers";
import { AccountSecurity } from "@/platform/forms";
import { auth } from "@/server/auth/auth";
import { PageTitle } from "@/platform/ui";
import { titled, tr } from "@/platform/server";
import { requireSession } from "@/server/http/dal";

export const generateMetadata = titled("pf.account.title");

/** AUTH-12: the person's own security — TOTP enrolment with backup codes, password change, sessions. */
export default async function AccountSecurityPage({ params, searchParams }: PageProps<"/[lang]/app/account/security">) {
  const { lang } = await params;
  const sp = await searchParams;
  const t = tr(lang);
  const session = await requireSession(lang, `/${lang}/app/account/security`);
  const sessions = await auth().api.listSessions({ headers: await headers() });
  return (
    <>
      <PageTitle title={t("pf.account.title")} lead={t("pf.account.lead", { email: session.identity.email })} />
      <div className="max-w-[860px]">
        <AccountSecurity
          twoFactorEnabled={session.twoFactorEnabled}
          reason={typeof sp.reason === "string" ? sp.reason : null}
          sessions={sessions.map((x) => ({ id: x.id, token: x.token, createdAt: x.createdAt, expiresAt: x.expiresAt, userAgent: x.userAgent ?? null, ipAddress: x.ipAddress ?? null }))}
          currentSessionId={session.sessionId}
        />
      </div>
    </>
  );
}
