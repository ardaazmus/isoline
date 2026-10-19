import { route } from "@/server/http/api";
import { approveWorksheet } from "@/server/worksheets/service";

/** Approves a submitted worksheet version (never the author's own). */
export const POST = route({ status: 200 }, async ({ actor, params }) => {
  await approveWorksheet(actor, params.worksheetId);
  return { ok: true };
});
