import { route } from "@/server/http/api";
import { factLineage } from "@/server/calc/service";

/** DATA-20: fact → run → observation versions → evidence and factor versions. */
export const GET = route({}, async ({ actor, params }) => factLineage(actor, params.factId));
