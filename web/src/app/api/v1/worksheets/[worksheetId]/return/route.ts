import { route } from "@/server/http/api";
import { WorksheetReturn } from "@/server/http/schemas";
import { returnWorksheet } from "@/server/worksheets/service";

/** Returns a submitted worksheet version to its author with a reason. */
export const POST = route({ body: WorksheetReturn, status: 200 }, async ({ actor, params, input }) => {
  await returnWorksheet(actor, params.worksheetId, input.reason);
  return { ok: true };
});
