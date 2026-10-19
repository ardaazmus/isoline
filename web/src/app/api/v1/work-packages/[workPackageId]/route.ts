import { ifMatch, route } from "@/server/http/api";
import { WorkPackagePatch } from "@/server/http/schemas";
import { updateWorkPackage } from "@/server/projects/service";

/** G2-08: status (state machine), people, dates; If-Match carries the row_version. */
export const PATCH = route({ body: WorkPackagePatch }, async ({ actor, input, params, req }) => ({ rowVersion: await updateWorkPackage(actor, params.workPackageId, input, ifMatch(req)) }));
