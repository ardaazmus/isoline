import { route } from "@/server/http/api";
import { LinkEvidence } from "@/server/http/schemas";
import { linkEvidence } from "@/server/data/service";

/** G3-06: link a project evidence file to the request. */
export const POST = route({ body: LinkEvidence }, async ({ actor, input, params }) => {
  await linkEvidence(actor, params.requestId, input.evidenceId);
  return { ok: true };
});
