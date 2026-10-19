import { route } from "@/server/http/api";
import { ExtendCampaign } from "@/server/http/schemas";
import { createCampaign } from "@/server/data/service";
import { withActor } from "@/server/db/client";
import { notFound } from "@/server/policy/policy";

/** Adds templates to a campaign: only missing requests are created, traces of existing ones widen. */
export const POST = route({ body: ExtendCampaign, status: 200 }, async ({ actor, input, params }) => {
  const c = await withActor(actor, (tx) => tx.selectFrom("core.data_campaigns").select(["cycle_id"]).where("id", "=", params.campaignId).executeTakeFirst());
  if (!c) throw notFound("campaign_not_found");
  return createCampaign(actor, c.cycle_id, { title: "", templateIds: input.templateIds }, params.campaignId);
});
