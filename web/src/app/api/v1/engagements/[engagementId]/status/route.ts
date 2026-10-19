import { route } from "@/server/http/api";
import { MoveTo } from "@/server/http/schemas";
import { moveEngagement, type EngagementStatus } from "@/server/projects/service";

export const POST = route({ body: MoveTo, status: 200 }, async ({ actor, input, params }) => {
  await moveEngagement(actor, params.engagementId, input.to as EngagementStatus);
  return { ok: true };
});
