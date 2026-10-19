import { route } from "@/server/http/api";
import { submitSection } from "@/server/reports/service";

export const POST = route({ status: 200 }, async ({ actor, params }) => {
  await submitSection(actor, params.sectionId);
  return { ok: true };
});
