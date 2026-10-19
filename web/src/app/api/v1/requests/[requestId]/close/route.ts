import { route } from "@/server/http/api";
import { CloseRequest } from "@/server/http/schemas";
import { closeRequest } from "@/server/data/service";

export const POST = route({ body: CloseRequest, status: 200 }, async ({ actor, input, params }) => {
  await closeRequest(actor, params.requestId, input.to, input.reason);
  return { ok: true };
});
