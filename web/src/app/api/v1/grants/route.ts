import { route } from "@/server/http/api";
import { listGrants } from "@/server/tenancy/service";

/** Grants this workspace gave and received (ORG-11 relationships). */
export const GET = route({}, async ({ actor }) => ({ grants: await listGrants(actor) }));
