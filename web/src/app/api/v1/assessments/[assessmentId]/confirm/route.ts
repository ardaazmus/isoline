import { route } from "@/server/http/api";
import { confirmApplicability } from "@/server/projects/service";

/** The owner tenant confirms a decision prepared under a grant (RACI: A stays with the customer). */
export const POST = route({ status: 200 }, async ({ actor, params }) => {
  await confirmApplicability(actor, params.assessmentId);
  return { ok: true };
});
