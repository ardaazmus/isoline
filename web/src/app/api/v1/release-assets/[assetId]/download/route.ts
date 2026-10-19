import { route } from "@/server/http/api";
import { assetDownload } from "@/server/reports/service";

/** Logs the download and redirects to a five-minute presigned URL (?format=json returns the URL). */
export const GET = route({}, async ({ actor, params, req }) => {
  const d = await assetDownload(actor, params.assetId);
  if (new URL(req.url).searchParams.get("format") === "json") return d;
  return new Response(null, { status: 303, headers: { location: d.url, "cache-control": "no-store" } });
});
