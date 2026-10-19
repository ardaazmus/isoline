import { route } from "@/server/http/api";
import { Elimination } from "@/server/http/schemas";
import { submitElimination } from "@/server/close/service";

/** An intercompany sale to eliminate (IFRS 10 B86); approved by someone else. */
export const POST = route({ body: Elimination }, async ({ actor, input, params }) => submitElimination(actor, params.cycleId, input));
