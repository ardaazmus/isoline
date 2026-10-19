import { route } from "@/server/http/api";
import { addPackRequests } from "@/server/industry/service";

/** Adds the enabled packs' data items to the campaign (pack, version and basis kept as the request's trace). */
export const POST = route({ status: 200 }, async ({ actor, params }) => addPackRequests(actor, params.campaignId));
