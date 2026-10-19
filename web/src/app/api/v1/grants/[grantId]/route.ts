import { route } from "@/server/http/api";
import { revokeGrant } from "@/server/tenancy/service";

export const DELETE = route({}, async ({ actor, params }) => {
  await revokeGrant(actor, params.grantId);
  return { ok: true };
});
