import { ifMatch, route } from "@/server/http/api";
import { UpdateEntity } from "@/server/http/schemas";
import { updateLegalEntity } from "@/server/orgs/service";

export const PATCH = route({ body: UpdateEntity }, async ({ actor, input, params, req }) => ({ rowVersion: await updateLegalEntity(actor, params.entityId, input, ifMatch(req)) }));
