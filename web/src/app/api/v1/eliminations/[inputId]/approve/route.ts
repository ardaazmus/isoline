import { route } from "@/server/http/api";
import { decideConsolidationInput } from "@/server/close/service";

export const POST = route({ status: 200 }, async ({ actor, params }) => {
  await decideConsolidationInput(actor, "elimination", params.inputId, "approve");
  return { ok: true };
});
