import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { PlatformShell, type ShellContext } from "@/platform/shell";
import { getSession } from "@/server/http/dal";
import { TENANT_COOKIE, tenantActor } from "@/server/http/api";
import { myMemberships } from "@/server/tenancy/service";
import { unreadCount } from "@/server/data/service";
import { inboxCount } from "@/server/inbox/service";

/**
 * Platform frame. It only draws the context bar and menu; every page verifies the session and the workspace itself
 * (requireWorkspace), because a layout does not re-run on client navigation. The "My work" badge is a convenience
 * count: when it cannot be computed (MFA still to set up, membership just ended) the menu shows none.
 */
export default async function PlatformLayout({ children }: LayoutProps<"/[lang]/app">) {
  const session = await getSession();
  let ctx: ShellContext = { user: null, memberships: [], current: null };
  if (session) {
    const memberships = await myMemberships(session.identity.userId);
    const chosen = (await cookies()).get(TENANT_COOKIE)?.value;
    const current = memberships.find((m) => m.tenantId === chosen) ?? null;
    const inbox = current
      ? await tenantActor(session, current.tenantId, randomUUID())
          .then((actor) => inboxCount(actor))
          .catch(() => 0)
      : 0;
    ctx = { user: { name: session.name, email: session.identity.email }, memberships, current, unread: await unreadCount(session.identity.userId), inbox };
  }
  return <PlatformShell ctx={ctx}>{children}</PlatformShell>;
}
