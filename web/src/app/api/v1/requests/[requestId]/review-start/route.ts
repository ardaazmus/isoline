import { route } from "@/server/http/api";
import { startReview } from "@/server/data/service";

export const POST = route({ status: 200 }, async ({ actor, params }) => {
  await startReview(actor, params.requestId);
  return { ok: true };
});
