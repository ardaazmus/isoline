import { route } from "@/server/http/api";
import { RunCalculation } from "@/server/http/schemas";
import { runCalculation } from "@/server/calc/service";

/** G4-02: runs a calculation over accepted observations; the same inputs return the same run. */
export const POST = route({ body: RunCalculation }, async ({ actor, input, params }) => runCalculation(actor, params.cycleId, input));
