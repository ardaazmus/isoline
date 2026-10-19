import { route } from "@/server/http/api";
import { consolidationInputs, ghgByBoundary, latestReconciliation } from "@/server/close/service";

/** CTRL-08: GHG results per boundary approach and the financial consolidation inputs and result. */
export const GET = route({}, async ({ actor, params }) => ({ ghg: await ghgByBoundary(actor, params.cycleId), financial: await consolidationInputs(actor, params.cycleId), runs: await latestReconciliation(actor, params.cycleId) }));
