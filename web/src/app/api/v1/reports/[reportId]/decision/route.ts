import { route } from "@/server/http/api";
import { StageDecision } from "@/server/http/schemas";
import { decideStage } from "@/server/reports/service";

/** REP-06: technical review, customer review or management sign-off on the current candidate. */
export const POST = route({ body: StageDecision, status: 200 }, async ({ actor, input, params }) => decideStage(actor, params.reportId, input));
