import { route } from "@/server/http/api";
import { AddFactorSet } from "@/server/http/schemas";
import { addCustomSet, listFactorSets } from "@/server/calc/factors";

/** G4-01: built-in sets (publisher, licence, edition, digest) and the tenant's own; licensed data needs a rights confirmation. */
export const GET = route({}, async ({ actor }) => ({ sets: await listFactorSets(actor) }));
export const POST = route({ body: AddFactorSet }, async ({ actor, input }) => addCustomSet(actor, input));
