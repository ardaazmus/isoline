import { route } from "@/server/http/api";
import { MarkRead } from "@/server/http/schemas";
import { markNotificationsRead } from "@/server/data/service";

export const POST = route({ tenant: "optional", body: MarkRead, status: 200 }, async ({ actor, input }) => {
  await markNotificationsRead(actor, input.ids);
  return { ok: true };
});
