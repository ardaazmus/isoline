import { ifMatch, route } from "@/server/http/api";
import { MoveTo } from "@/server/http/schemas";
import { moveCycle } from "@/server/projects/service";

export const POST = route({ body: MoveTo, status: 200 }, async ({ actor, input, params, req }) => ({ rowVersion: await moveCycle(actor, params.cycleId, input.to, ifMatch(req)) }));
