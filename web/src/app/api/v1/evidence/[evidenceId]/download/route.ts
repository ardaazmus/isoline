import { route } from "@/server/http/api";
import { downloadEvidence } from "@/server/evidence/service";

/** Logs the access and redirects to a five-minute presigned URL (?format=json returns the URL instead). */
export const GET = route({}, async ({ actor, params, req }) => {
  const d = await downloadEvidence(actor, params.evidenceId);
  if (new URL(req.url).searchParams.get("format") === "json") return d;
  return new Response(null, { status: 303, headers: { location: d.url, "cache-control": "no-store" } });
});
