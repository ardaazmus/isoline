import { route } from "@/server/http/api";
import { approveRun } from "@/server/calc/service";

/** Approves every ready fact of the run (never by the person who ran it). */
export const POST = route({ status: 200 }, async ({ actor, params }) => approveRun(actor, params.runId));
