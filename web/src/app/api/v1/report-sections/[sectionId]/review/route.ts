import { route } from "@/server/http/api";
import { ReviewSection } from "@/server/http/schemas";
import { reviewSection } from "@/server/reports/service";

/** Approves or returns a submitted section version (never by its author). */
export const POST = route({ body: ReviewSection, status: 200 }, async ({ actor, input, params }) => {
  await reviewSection(actor, params.sectionId, input);
  return { ok: true };
});
