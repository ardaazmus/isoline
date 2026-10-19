import { route } from "@/server/http/api";
import { CreateEngagement } from "@/server/http/schemas";
import { createEngagement, listEngagements } from "@/server/projects/service";

/** PORT-04/05: engagements this workspace owns or is named on as advisory, with their deliverables. */
export const GET = route({}, async ({ actor }) => ({ engagements: await listEngagements(actor) }));
export const POST = route({ body: CreateEngagement }, async ({ actor, input }) => ({ engagementId: await createEngagement(actor, input) }));
