import { route } from "@/server/http/api";
import { getSnapshot } from "@/server/close/service";

/** One frozen snapshot with its facts and an integrity check of the content digest. */
export const GET = route({}, async ({ actor, params }) => getSnapshot(actor, params.snapshotId));
