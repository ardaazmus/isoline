import { route } from "@/server/http/api";
import { participantCandidates } from "@/server/projects/service";

export const GET = route({}, async ({ actor, params }) => ({ candidates: await participantCandidates(actor, params.projectId) }));
