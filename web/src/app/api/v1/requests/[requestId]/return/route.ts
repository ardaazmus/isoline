import { route } from "@/server/http/api";
import { Reason } from "@/server/http/schemas";
import { returnTask } from "@/server/data/service";

export const POST = route({ body: Reason, status: 200 }, async ({ actor, input, params }) => {
  await returnTask(actor, params.requestId, input.reason);
  return { ok: true };
});
