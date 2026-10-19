import { cookies } from "next/headers";
import { PlatformShell, type ShellContext } from "@/platform/shell";
import { getMemberships, getSession } from "@/server/http/dal";
import { TENANT_COOKIE } from "@/server/http/api";
import { unreadCount } from "@/server/data/service";

/**
 * Platform frame. It only draws the context bar and menu; every page verifies the session and the workspace itself
 * (requireWorkspace), because a layout does not re-run on client navigation. The "My work" badge is fetched by the
 * menu after the page has rendered (/api/v1/inbox/count): a page never waits for the whole inbox.
 */
export default async function PlatformLayout({ children }: LayoutProps<"/[lang]/app">) {
  const session = await getSession();
  let ctx: ShellContext = { user: null, memberships: [], current: null };
  if (session) {
    const memberships = await getMemberships(session.identity.userId);
    const chosen = (await cookies()).get(TENANT_COOKIE)?.value;
    const current = memberships.find((m) => m.tenantId === chosen) ?? null;
    ctx = { user: { name: session.name, email: session.identity.email }, memberships, current, unread: await unreadCount(session.identity.userId) };
  }
  return <PlatformShell ctx={ctx}>{children}</PlatformShell>;
}
