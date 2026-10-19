import { route } from "@/server/http/api";
import { closeChecklist } from "@/server/close/service";

/** CTRL-09: the close checklist with reasons, events and snapshots. */
export const GET = route({}, async ({ actor, params }) => closeChecklist(actor, params.cycleId));
