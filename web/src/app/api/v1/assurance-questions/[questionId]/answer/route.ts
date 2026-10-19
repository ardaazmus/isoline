import { route } from "@/server/http/api";
import { AnswerQuestion } from "@/server/http/schemas";
import { answerQuestion } from "@/server/assurance/service";

export const POST = route({ body: AnswerQuestion, status: 200 }, async ({ actor, input, params }) => {
  await answerQuestion(actor, params.questionId, input);
  return { ok: true };
});
