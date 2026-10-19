import { route } from "@/server/http/api";
import { RunApplicability } from "@/server/http/schemas";
import { listApplicability, runApplicability } from "@/server/projects/service";
import type { Profile } from "@/lib/calc/applicability";

/** G2-06: rule-engine suggestions with sources and the named decisions on them. */
export const GET = route({}, async ({ actor, params }) => ({ assessments: await listApplicability(actor, params.cycleId) }));
export const POST = route({ body: RunApplicability }, async ({ actor, input, params }) => runApplicability(actor, params.cycleId, input.profile as Profile));
