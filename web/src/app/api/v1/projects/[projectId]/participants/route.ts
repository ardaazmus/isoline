import { route } from "@/server/http/api";
import { AddParticipant } from "@/server/http/schemas";
import { addParticipant, listParticipants } from "@/server/projects/service";

/** PORT-12: team with RACI roles; outsiders only through an active grant of the matching kind. */
export const GET = route({}, async ({ actor, params }) => ({ participants: await listParticipants(actor, params.projectId) }));
export const POST = route({ body: AddParticipant }, async ({ actor, input, params }) => ({ participantId: await addParticipant(actor, params.projectId, input) }));
