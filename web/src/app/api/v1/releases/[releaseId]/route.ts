import { route } from "@/server/http/api";
import { releaseAssets } from "@/server/reports/service";

/** REP-08: one release with its manifest, assets and design proofs. */
export const GET = route({}, async ({ actor, params }) => releaseAssets(actor, params.releaseId));
