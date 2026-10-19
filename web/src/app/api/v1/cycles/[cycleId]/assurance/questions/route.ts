import { route } from "@/server/http/api";
import { AskQuestion } from "@/server/http/schemas";
import { askQuestion } from "@/server/assurance/service";

/** The assurer asks about a fact, a file, a report or in general. */
export const POST = route({ body: AskQuestion }, async ({ actor, input, params }) => askQuestion(actor, params.cycleId, input));
