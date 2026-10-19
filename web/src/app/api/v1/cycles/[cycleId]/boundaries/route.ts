import { route } from "@/server/http/api";
import { ProposeBoundary } from "@/server/http/schemas";
import { listBoundaries, proposeBoundary } from "@/server/projects/service";

/** G2-03: boundary revisions with members; a proposal is computed from the tree on the last day of the cycle. */
export const GET = route({}, async ({ actor, params }) => ({ boundaries: await listBoundaries(actor, params.cycleId) }));
export const POST = route({ body: ProposeBoundary }, async ({ actor, input, params }) => proposeBoundary(actor, params.cycleId, input.kind));
