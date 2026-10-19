import { route } from "@/server/http/api";
import { Draft } from "@/server/http/schemas";
import { saveDraft } from "@/server/data/service";

/** The assignee's draft value (checked against the metric's units and lines, converted to canonical units). */
export const PUT = route({ body: Draft, status: 200 }, async ({ actor, input, params }) => saveDraft(actor, params.requestId, input));
