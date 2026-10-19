import { route } from "@/server/http/api";
import { runIndustry } from "@/server/industry/service";

/** G7-05/06: pack KPIs as metric facts over accepted data and current GHG facts. */
export const POST = route({}, async ({ actor, params }) => runIndustry(actor, params.cycleId));
