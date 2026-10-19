import { route } from "@/server/http/api";
import { removeParticipant } from "@/server/projects/service";

export const DELETE = route({}, async ({ actor, params }) => {
  await removeParticipant(actor, params.participantId);
  return { ok: true };
});
