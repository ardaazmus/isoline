import { route } from "@/server/http/api";
import { CreateReport } from "@/server/http/schemas";
import { createReport, listReports } from "@/server/reports/service";

/** REP-01: the project's reports; a new one takes a template outline for one cycle. */
export const GET = route({}, async ({ actor, params }) => ({ reports: await listReports(actor, params.projectId) }));
export const POST = route({ body: CreateReport }, async ({ actor, input }) => createReport(actor, input.cycleId, input));
