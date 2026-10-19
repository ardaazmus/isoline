import { route } from "@/server/http/api";
import { EntityFinancial } from "@/server/http/schemas";
import { submitEntityFinancial } from "@/server/close/service";

/** Revenue of one legal entity for the consolidation; approved by someone else. */
export const POST = route({ body: EntityFinancial }, async ({ actor, input, params }) => submitEntityFinancial(actor, params.cycleId, input));
