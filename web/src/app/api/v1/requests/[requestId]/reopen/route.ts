import { route } from "@/server/http/api";
import { Reason } from "@/server/http/schemas";
import { reopenRequest } from "@/server/close/service";

/** Sends an accepted request back for a correction (after the cycle was reopened). */
export const POST = route({ body: Reason, status: 200 }, async ({ actor, input, params }) => {
  await reopenRequest(actor, params.requestId, input.reason);
  return { ok: true };
});
