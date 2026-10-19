import { problem, route } from "@/server/http/api";
import { uploadProof } from "@/server/reports/service";

/** REP-09: a design partner uploads a proof PDF for a release (scanned before it is stored). */
export const POST = route({ raw: true }, async ({ actor, params, req }) => {
  if (Number(req.headers.get("content-length") ?? 0) > 50 * 1024 * 1024 + 64 * 1024) return problem(413, "file_too_large");
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return problem(422, "file_required");
  return uploadProof(actor, params.releaseId, { filename: file.name, bytes: new Uint8Array(await file.arrayBuffer()) });
});
