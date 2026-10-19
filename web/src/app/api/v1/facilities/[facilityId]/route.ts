import { ifMatch, route } from "@/server/http/api";
import { UpdateFacility } from "@/server/http/schemas";
import { updateFacility } from "@/server/orgs/service";

export const PATCH = route({ body: UpdateFacility }, async ({ actor, input, params, req }) => ({ rowVersion: await updateFacility(actor, params.facilityId, input, ifMatch(req)) }));
