import { route } from "@/server/http/api";
import { getTask } from "@/server/data/service";

/** DATA-05: the request, its metric, versions, evidence, comments and what this person may do. */
export const GET = route({}, async ({ actor, params }) => {
  const t = await getTask(actor, params.requestId);
  return Response.json(t, { headers: { etag: `"${t.request.row_version}"`, "cache-control": "no-store" } });
});
