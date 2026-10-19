import { route } from "@/server/http/api";
import { EngagementStatus } from "@/server/http/schemas";
import { setEngagementStatus } from "@/server/assurance/service";

/** Engagement status; "opinion_received" needs the provider's opinion file as evidence. */
export const POST = route({ body: EngagementStatus, status: 200 }, async ({ actor, input, params }) => {
  await setEngagementStatus(actor, params.engagementId, input);
  return { ok: true };
});
