import { route } from "@/server/http/api";
import { Note } from "@/server/http/schemas";
import { submitTask } from "@/server/data/service";

export const POST = route({ body: Note, status: 200 }, async ({ actor, input, params }) => {
  await submitTask(actor, params.requestId, input.note);
  return { ok: true };
});
