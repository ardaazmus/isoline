import { route } from "@/server/http/api";
import { getReport } from "@/server/reports/service";

/** REP-02/03: outline, section versions, bound metrics, stale references, coverage, approvals, releases. */
export const GET = route({}, async ({ actor, params }) => getReport(actor, params.reportId));
