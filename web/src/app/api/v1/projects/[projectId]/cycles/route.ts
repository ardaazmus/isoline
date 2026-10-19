import { route } from "@/server/http/api";
import { Cycle } from "@/server/http/schemas";
import { addCycle, listCycles } from "@/server/projects/service";

export const GET = route({}, async ({ actor, params }) => ({ cycles: await listCycles(actor, params.projectId) }));
/** G2-05: a further reporting period; periods of one project never overlap. */
export const POST = route({ body: Cycle }, async ({ actor, input, params }) => addCycle(actor, params.projectId, input));
