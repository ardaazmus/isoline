import { route } from "@/server/http/api";
import { listMembers } from "@/server/tenancy/service";

export const GET = route({}, async ({ actor }) => ({ members: await listMembers(actor) }));
