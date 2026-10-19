import { route } from "@/server/http/api";
import { RunsQuery } from "@/server/http/schemas";
import { listRuns } from "@/server/calc/service";

/** Runs of a project (optionally one cycle) with digests and open issue counts. */
export const GET = route({ query: RunsQuery }, async ({ actor, input, params }) => ({ runs: await listRuns(actor, params.projectId, (input as { cycleId?: string } | undefined)?.cycleId) }));
