import { route } from "@/server/http/api";
import { Invite } from "@/server/http/schemas";
import { inviteMember } from "@/server/tenancy/service";

/** The token goes only by e-mail (outbox); the response carries the invitation id. */
export const POST = route({ body: Invite }, async ({ actor, input }) => {
  const r = await inviteMember(actor, input);
  return { invitationId: r.invitationId };
});
