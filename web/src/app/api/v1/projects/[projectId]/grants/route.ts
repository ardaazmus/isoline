import { route } from "@/server/http/api";
import { Grant } from "@/server/http/schemas";
import { grantProjectAccess } from "@/server/tenancy/service";

/** ExternalProjectGrant (G1-07): one project, a role, a purpose and an expiry; consent is recorded with it. */
export const POST = route({ body: Grant }, async ({ actor, input, params }) => ({
  grantId: await grantProjectAccess(actor, { ...input, projectId: params.projectId }),
}));
