import { route } from "@/server/http/api";
import { confirmOrganizationMapping } from "@/server/orgs/confirm";

export const POST = route({ status: 200 }, async ({ actor, params }) => {
  await confirmOrganizationMapping(actor, params.organizationId);
  return { ok: true };
});
