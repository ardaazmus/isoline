import { route } from "@/server/http/api";
import { SaveWorksheet, WorksheetQuery } from "@/server/http/schemas";
import { HttpError } from "@/server/policy/policy";
import { WORKSHEET_KINDS, type WorksheetKind } from "@/server/worksheets/schemas";
import { getWorksheet, saveWorksheet } from "@/server/worksheets/service";

const kindOf = (k: string): WorksheetKind => {
  if (!(WORKSHEET_KINDS as readonly string[]).includes(k)) throw new HttpError(404, "not_found");
  return k as WorksheetKind;
};

/** UX Faz 3: a cycle worksheet — its newest version in play and its approved version. */
export const GET = route({ query: WorksheetQuery }, async ({ actor, params, input }) => getWorksheet(actor, params.cycleId, kindOf(params.kind), (input as { reportId?: string } | undefined)?.reportId ?? null));

/** Saves a new version (draft); the payload is validated per kind. */
export const PUT = route({ body: SaveWorksheet, status: 201 }, async ({ actor, params, input }) => saveWorksheet(actor, params.cycleId, kindOf(params.kind), input.payload, { reportId: input.reportId ?? null, note: input.note ?? null }));
