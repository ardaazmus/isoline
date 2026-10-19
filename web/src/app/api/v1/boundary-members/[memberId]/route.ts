import { route } from "@/server/http/api";
import { BoundaryMember } from "@/server/http/schemas";
import { setBoundaryMember } from "@/server/projects/service";

export const PATCH = route({ body: BoundaryMember }, async ({ actor, input, params }) => {
  await setBoundaryMember(actor, params.memberId, input);
  return { ok: true };
});
