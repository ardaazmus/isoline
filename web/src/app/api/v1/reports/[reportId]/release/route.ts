import { route } from "@/server/http/api";
import { Release } from "@/server/http/schemas";
import { releaseReport } from "@/server/reports/service";

/** REP-11: immutable release of the signed candidate on the frozen snapshot (an amendment needs a reason). */
export const POST = route({ body: Release }, async ({ actor, input, params }) => releaseReport(actor, params.reportId, input));
