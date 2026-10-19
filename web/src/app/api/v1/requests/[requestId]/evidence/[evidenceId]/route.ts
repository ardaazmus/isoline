import { route } from "@/server/http/api";
import { unlinkEvidence } from "@/server/data/service";

export const DELETE = route({}, async ({ actor, params }) => {
  await unlinkEvidence(actor, params.requestId, params.evidenceId);
  return { ok: true };
});
