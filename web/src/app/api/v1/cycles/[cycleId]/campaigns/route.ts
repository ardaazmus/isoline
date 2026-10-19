import { route } from "@/server/http/api";
import { CreateCampaign } from "@/server/http/schemas";
import { createCampaign } from "@/server/data/service";

/** G3-02: one request per data point the chosen templates need, per facility where the metric is facility-level. */
export const POST = route({ body: CreateCampaign }, async ({ actor, input, params }) => createCampaign(actor, params.cycleId, input));
