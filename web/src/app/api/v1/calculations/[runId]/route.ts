import { route } from "@/server/http/api";
import { getRun } from "@/server/calc/service";

/** One run: inputs, factors, result, facts and issues. */
export const GET = route({}, async ({ actor, params }) => getRun(actor, params.runId));
