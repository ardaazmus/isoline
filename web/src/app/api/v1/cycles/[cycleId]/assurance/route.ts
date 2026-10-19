import { route } from "@/server/http/api";
import { assuranceRoom } from "@/server/assurance/service";

/** CTRL-10/11: the assurance room of a cycle — engagement, facts (frozen snapshot first), questions. */
export const GET = route({}, async ({ actor, params }) => assuranceRoom(actor, params.cycleId));
