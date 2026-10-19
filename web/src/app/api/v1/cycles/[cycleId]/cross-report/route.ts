import { route } from "@/server/http/api";
import { crossReportCheck } from "@/server/reports/service";

/** G6-09: metrics used by more than one report of the cycle and whether they point to the same fact. */
export const GET = route({}, async ({ actor, params }) => ({ metrics: await crossReportCheck(actor, params.cycleId) }));
