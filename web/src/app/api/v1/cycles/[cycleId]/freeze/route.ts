import { route } from "@/server/http/api";
import { freezeCycle } from "@/server/close/service";

/** G5-06: freezes the cycle into an immutable snapshot (the checklist is checked again here). */
export const POST = route({}, async ({ actor, params }) => freezeCycle(actor, params.cycleId));
