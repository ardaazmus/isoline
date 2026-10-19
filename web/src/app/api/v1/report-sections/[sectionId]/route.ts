import { route } from "@/server/http/api";
import { AssignSection, SaveSection } from "@/server/http/schemas";
import { assignSection, saveSection } from "@/server/reports/service";

/** REP-04: a new version of the section text (tokens bound to metric facts); PATCH assigns owner and due date. */
export const PUT = route({ body: SaveSection, status: 200 }, async ({ actor, input, params }) => saveSection(actor, params.sectionId, input));
export const PATCH = route({ body: AssignSection }, async ({ actor, input, params }) => {
  await assignSection(actor, params.sectionId, input);
  return { ok: true };
});
