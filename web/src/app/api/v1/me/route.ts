import { route } from "@/server/http/api";
import { myMemberships } from "@/server/tenancy/service";

/** The signed-in person, their workspaces and the acting tenant (if one is chosen). */
export const GET = route({ tenant: "optional" }, async ({ session, actor }) => ({
  user: { id: session.identity.userId, name: session.name, email: session.identity.email, twoFactorEnabled: session.twoFactorEnabled },
  memberships: await myMemberships(session.identity.userId),
  actingTenantId: actor.actingTenantId,
  role: actor.role,
}));
