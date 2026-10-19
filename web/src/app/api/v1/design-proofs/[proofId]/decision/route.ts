import { route } from "@/server/http/api";
import { ProofDecision } from "@/server/http/schemas";
import { decideProof } from "@/server/reports/service";

/** REP-10: the customer approves a proof or asks for changes with a reason. */
export const POST = route({ body: ProofDecision, status: 200 }, async ({ actor, input, params }) => {
  await decideProof(actor, params.proofId, input);
  return { ok: true };
});
