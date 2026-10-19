import { route } from "@/server/http/api";
import { portfolioKpis } from "@/server/portfolio/kpis";

/** G7-08: operational KPIs per project (no ESG grade). */
export const GET = route({}, async ({ actor }) => ({ projects: await portfolioKpis(actor) }));
