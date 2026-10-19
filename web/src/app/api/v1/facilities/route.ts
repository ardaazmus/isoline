import { route } from "@/server/http/api";
import { CreateFacility } from "@/server/http/schemas";
import { createFacility } from "@/server/orgs/service";

export const POST = route({ body: CreateFacility }, async ({ actor, input }) => ({ facilityId: await createFacility(actor, input) }));
