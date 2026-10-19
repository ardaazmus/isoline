import { route } from "@/server/http/api";
import { factorValues } from "@/server/calc/factors";

/** The values of one factor set (rows are immutable: a changed value is a new set row). */
export const GET = route({}, async ({ actor, params }) => ({ values: await factorValues(actor, params.setId) }));
