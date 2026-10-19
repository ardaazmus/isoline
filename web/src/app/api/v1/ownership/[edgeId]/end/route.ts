import { route } from "@/server/http/api";
import { EndEdge } from "@/server/http/schemas";
import { endOwnershipEdge } from "@/server/orgs/service";

export const POST = route({ body: EndEdge, status: 200 }, async ({ actor, input, params }) => {
  await endOwnershipEdge(actor, params.edgeId, input.validTo);
  return { ok: true };
});
