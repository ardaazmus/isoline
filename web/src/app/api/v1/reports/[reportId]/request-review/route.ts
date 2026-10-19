import { route } from "@/server/http/api";
import { requestReview } from "@/server/reports/service";

export const POST = route({ status: 200 }, async ({ actor, params }) => {
  await requestReview(actor, params.reportId);
  return { ok: true };
});
