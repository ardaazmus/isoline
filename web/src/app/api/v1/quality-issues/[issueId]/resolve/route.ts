import { route } from "@/server/http/api";
import { ResolveIssue } from "@/server/http/schemas";
import { resolveIssue } from "@/server/calc/service";

/** A warning resolved or accepted as an exception with a reason, by someone other than the performer. */
export const POST = route({ body: ResolveIssue, status: 200 }, async ({ actor, input, params }) => {
  await resolveIssue(actor, params.issueId, input);
  return { ok: true };
});
