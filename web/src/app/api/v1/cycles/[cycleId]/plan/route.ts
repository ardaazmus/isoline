import { route } from "@/server/http/api";
import { listPlan } from "@/server/projects/service";

export const GET = route({}, async ({ actor, params }) => ({ workPackages: await listPlan(actor, params.cycleId) }));
