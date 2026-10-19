import { route } from "@/server/http/api";
import { Comment } from "@/server/http/schemas";
import { addComment } from "@/server/data/service";

export const POST = route({ body: Comment }, async ({ actor, input, params }) => {
  await addComment(actor, params.requestId, input.body);
  return { ok: true };
});
