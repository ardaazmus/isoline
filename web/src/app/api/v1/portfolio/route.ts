import { route } from "@/server/http/api";
import { portfolio } from "@/server/projects/service";

/** G2-09: projects this workspace may see, with cycle, next due item, late and blocked counts. */
export const GET = route({}, async ({ actor }) => ({ projects: await portfolio(actor) }));
