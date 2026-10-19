import { problem, route } from "@/server/http/api";
import { MAX_IMPORT_FILE, previewImport } from "@/server/data/imports";

/** G3-05: upload a CSV/XLSX; it is scanned, stored as evidence, parsed and validated row by row (nothing committed). */
export const POST = route({ raw: true }, async ({ actor, params, req }) => {
  if (Number(req.headers.get("content-length") ?? 0) > MAX_IMPORT_FILE + 64 * 1024) return problem(413, "file_too_large");
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return problem(422, "file_required");
  return previewImport(actor, params.campaignId, { filename: file.name, bytes: new Uint8Array(await file.arrayBuffer()) });
});
