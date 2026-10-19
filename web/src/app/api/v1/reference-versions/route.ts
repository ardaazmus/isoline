import { route } from "@/server/http/api";
import { referenceLog } from "@/server/reference/updater";
import { requireMemberAction } from "@/server/tenancy/service";
import { withActor } from "@/server/db/client";

/** G8-03: when built-in reference data (factors, catalogue, templates, regulations, packs) changed. */
export const GET = route({}, async ({ actor }) => {
  await withActor(actor, (tx) => requireMemberAction(tx, actor, "audit.read"));
  return { versions: await referenceLog() };
});
