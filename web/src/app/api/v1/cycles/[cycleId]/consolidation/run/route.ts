import { route } from "@/server/http/api";
import { runFinancialConsolidation } from "@/server/close/service";

/** G5-02: IFRS 10 revenue consolidation on the approved financial reporting boundary. */
export const POST = route({}, async ({ actor, params }) => runFinancialConsolidation(actor, params.cycleId));
