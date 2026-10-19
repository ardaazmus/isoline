import { route } from "@/server/http/api";
import { DecideApplicability } from "@/server/http/schemas";
import { decideApplicability } from "@/server/projects/service";

export const POST = route({ body: DecideApplicability, status: 200 }, async ({ actor, input, params }) => {
  await decideApplicability(actor, params.assessmentId, input);
  return { ok: true };
});
