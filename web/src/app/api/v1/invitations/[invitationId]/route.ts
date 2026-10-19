import { route } from "@/server/http/api";
import { revokeInvitation } from "@/server/tenancy/service";

export const DELETE = route({}, async ({ actor, params }) => {
  await revokeInvitation(actor, params.invitationId);
  return { ok: true };
});
