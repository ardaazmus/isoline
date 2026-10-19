import { route } from "@/server/http/api";
import { CreateEntity } from "@/server/http/schemas";
import { createLegalEntity } from "@/server/orgs/service";

export const POST = route({ body: CreateEntity }, async ({ actor, input }) => ({ entityId: await createLegalEntity(actor, input) }));
