import { route } from "@/server/http/api";
import { AddDeliverable } from "@/server/http/schemas";
import { addDeliverable } from "@/server/projects/service";

export const POST = route({ body: AddDeliverable }, async ({ actor, input, params }) => ({ deliverableId: await addDeliverable(actor, params.engagementId, input) }));
