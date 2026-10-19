import { route } from "@/server/http/api";
import { submitWorksheet } from "@/server/worksheets/service";

/** Sends a draft worksheet version for approval. */
export const POST = route({ status: 200 }, async ({ actor, params }) => {
  await submitWorksheet(actor, params.worksheetId);
  return { ok: true };
});
