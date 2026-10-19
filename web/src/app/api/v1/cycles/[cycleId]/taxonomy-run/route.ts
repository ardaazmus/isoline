import { route } from "@/server/http/api";
import { runTaxonomy } from "@/server/worksheets/service";

/** UX Faz 3: the approved taxonomy worksheet becomes metric facts (taxonomy KPIs) that wait for approval. */
export const POST = route({}, async ({ actor, params }) => runTaxonomy(actor, params.cycleId));
