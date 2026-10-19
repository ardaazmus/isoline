import { ifMatch, route } from "@/server/http/api";
import { acceptTask } from "@/server/data/service";

/** The reviewer accepts; the person who entered the value never can (separation of duties). */
export const POST = route({ status: 200 }, async ({ actor, params, req }) => {
  await acceptTask(actor, params.requestId, ifMatch(req));
  return { ok: true };
});
