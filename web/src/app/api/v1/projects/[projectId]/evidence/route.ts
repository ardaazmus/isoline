import { problem, route } from "@/server/http/api";
import { listEvidence, uploadEvidence, type Classification } from "@/server/evidence/service";
import { MAX_EVIDENCE_BYTES } from "@/server/evidence/filetype";

const CLASSES = ["public", "internal", "confidential", "personal"];

export const GET = route({}, async ({ actor, params }) => ({ evidence: await listEvidence(actor, params.projectId) }));

/** multipart/form-data: file, classification. The file is quarantined until the scanner releases it. */
export const POST = route({ raw: true }, async ({ actor, params, req }) => {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX_EVIDENCE_BYTES + 64 * 1024) return problem(413, "file_too_large");
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return problem(422, "file_required");
  const cls = String(form?.get("classification") ?? "internal");
  if (!CLASSES.includes(cls)) return problem(422, "invalid_classification");
  return uploadEvidence(actor, params.projectId, { filename: file.name, bytes: new Uint8Array(await file.arrayBuffer()), classification: cls as Classification });
});
