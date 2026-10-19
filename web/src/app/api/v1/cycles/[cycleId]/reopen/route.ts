import { route } from "@/server/http/api";
import { ReopenReason } from "@/server/http/schemas";
import { reopenCycle } from "@/server/close/service";

/** Reopens a frozen cycle with a reason (≥ 20 characters); the snapshot stays unchanged. */
export const POST = route({ body: ReopenReason, status: 200 }, async ({ actor, input, params }) => {
  await reopenCycle(actor, params.cycleId, input.reason);
  return { ok: true };
});
