import { route } from "@/server/http/api";
import { Reason } from "@/server/http/schemas";
import { rejectFact } from "@/server/calc/service";

export const POST = route({ body: Reason, status: 200 }, async ({ actor, input, params }) => {
  await rejectFact(actor, params.factId, input.reason);
  return { ok: true };
});
