import { route } from "@/server/http/api";
import { approveFact } from "@/server/calc/service";

export const POST = route({ status: 200 }, async ({ actor, params }) => {
  await approveFact(actor, params.factId);
  return { ok: true };
});
