import { route } from "@/server/http/api";
import { CreateTenant } from "@/server/http/schemas";
import { createTenant, myMemberships } from "@/server/tenancy/service";

/** Workspaces of the signed-in person. */
export const GET = route({ tenant: "optional" }, async ({ session }) => ({ memberships: await myMemberships(session.identity.userId) }));

/** Onboarding (ORG-01..04): open a company or advisory workspace; the person becomes its owner. */
export const POST = route({ tenant: "optional", body: CreateTenant }, async ({ session, input }) => ({
  tenantId: await createTenant(session.identity, { name: input.name, kind: input.kind, termsVersion: input.termsVersion }),
}));
