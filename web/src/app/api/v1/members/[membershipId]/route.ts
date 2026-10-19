import { route } from "@/server/http/api";
import { revokeMembership } from "@/server/tenancy/service";

/** Ends a membership; the person's next API call in this workspace is refused. */
export const DELETE = route({}, async ({ actor, params }) => {
  await revokeMembership(actor, params.membershipId);
  return { ok: true };
});
