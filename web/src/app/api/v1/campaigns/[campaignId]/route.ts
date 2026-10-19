import { route } from "@/server/http/api";
import { UpdateCampaign } from "@/server/http/schemas";
import { updateCampaign, type ReminderPolicy } from "@/server/data/service";

/** G3-08: the campaign's reminder rule and whether it is still open. */
export const PATCH = route({ body: UpdateCampaign }, async ({ actor, input, params }) => {
  await updateCampaign(actor, params.campaignId, { reminderPolicy: input.reminderPolicy as ReminderPolicy | undefined, status: input.status });
  return { ok: true };
});
