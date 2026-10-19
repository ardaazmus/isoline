import { route } from "@/server/http/api";
import { listRequests } from "@/server/data/service";

/** DATA-03: requests the person may see (contributors only their own). */
export const GET = route({}, async ({ actor, params }) => ({ requests: await listRequests(actor, params.campaignId) }));
