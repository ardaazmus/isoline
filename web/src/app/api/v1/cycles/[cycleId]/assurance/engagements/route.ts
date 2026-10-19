import { route } from "@/server/http/api";
import { CreateAssuranceEngagement } from "@/server/http/schemas";
import { createEngagement } from "@/server/assurance/service";

export const POST = route({ body: CreateAssuranceEngagement }, async ({ actor, input, params }) => createEngagement(actor, params.cycleId, input));
