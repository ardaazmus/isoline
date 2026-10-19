import { route } from "@/server/http/api";
import { listCampaigns } from "@/server/data/service";

export const GET = route({}, async ({ actor, params }) => ({ campaigns: await listCampaigns(actor, params.projectId) }));
