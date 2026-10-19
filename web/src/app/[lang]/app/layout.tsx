import { cookies } from "next/headers";
import { PlatformShell, type ShellContext } from "@/platform/shell";
import { getSession } from "@/server/http/dal";
import { TENANT_COOKIE } from "@/server/http/api";
import { myMemberships } from "@/server/tenancy/service";

/**
 * Platform frame. It only draws the context bar and menu; every page verifies the session and the workspace itself
 * (requireWorkspace), because a layout does not re-run on client navigation.
 */
export default async function PlatformLayout({ children }: LayoutProps<"/[lang]/app">) {
  const session = await getSession();
  let ctx: ShellContext = { user: null, memberships: [], current: null };
  if (session) {
    const memberships = await myMemberships(session.identity.userId);
    const chosen = (await cookies()).get(TENANT_COOKIE)?.value;
    ctx = { user: { name: session.name, email: session.identity.email }, memberships, current: memberships.find((m) => m.tenantId === chosen) ?? null };
  }
  return <PlatformShell ctx={ctx}>{children}</PlatformShell>;
}
