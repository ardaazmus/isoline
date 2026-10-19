import { route } from "@/server/http/api";
import { reproduceRun } from "@/server/calc/service";

/** G4 gate: recomputes the run from its recorded observation versions, factor values and files. */
export const POST = route({ status: 200 }, async ({ actor, params }) => reproduceRun(actor, params.runId));
