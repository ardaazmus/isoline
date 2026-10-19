import { route } from "@/server/http/api";
import { closeQuestion } from "@/server/assurance/service";

export const POST = route({ status: 200 }, async ({ actor, params }) => {
  await closeQuestion(actor, params.questionId);
  return { ok: true };
});
