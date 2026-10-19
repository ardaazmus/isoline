import { route } from "@/server/http/api";
import { suggestedTemplates } from "@/server/data/service";

/** Report templates the confirmed applicability decisions point to. */
export const GET = route({}, async ({ actor, params }) => suggestedTemplates(actor, params.cycleId));
