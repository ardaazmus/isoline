import { route } from "@/server/http/api";
import { handoffReleases } from "@/server/reports/service";

/** Releases shared with this workspace through a design grant. */
export const GET = route({}, async ({ actor }) => ({ releases: await handoffReleases(actor) }));
