import { route } from "@/server/http/api";
import { ChooseFactor } from "@/server/http/schemas";
import { chooseFactor, listChoices } from "@/server/calc/factors";

/** G4-01: the project's explicit factor per target; a new choice revokes the previous one. */
export const GET = route({}, async ({ actor, params }) => ({ choices: await listChoices(actor, params.projectId) }));
export const POST = route({ body: ChooseFactor }, async ({ actor, input, params }) => {
  await chooseFactor(actor, params.projectId, input.target, input.factorValueId, input.reason);
  return { ok: true };
});
