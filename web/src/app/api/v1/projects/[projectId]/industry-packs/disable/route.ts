import { route } from "@/server/http/api";
import { DisablePack } from "@/server/http/schemas";
import { disablePack } from "@/server/industry/service";

export const POST = route({ body: DisablePack, status: 200 }, async ({ actor, input, params }) => {
  await disablePack(actor, params.projectId, input.packId);
  return { ok: true };
});
