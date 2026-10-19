import { route } from "@/server/http/api";
import { listFacts } from "@/server/calc/service";

/** G4-08: current metric facts of the cycle (superseded revisions hidden). */
export const GET = route({}, async ({ actor, params }) => ({ facts: await listFacts(actor, params.cycleId) }));
