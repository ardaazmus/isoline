import { route } from "@/server/http/api";
import { latestReconciliation, runReconciliation } from "@/server/close/service";

/** CTRL-05: the latest U1–U10 cross-checks; POST runs them again over the current facts. */
export const GET = route({}, async ({ actor, params }) => latestReconciliation(actor, params.cycleId));
export const POST = route({}, async ({ actor, params }) => runReconciliation(actor, params.cycleId));
