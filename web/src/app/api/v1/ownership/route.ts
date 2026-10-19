import { route } from "@/server/http/api";
import { OwnershipEdge } from "@/server/http/schemas";
import { addOwnershipEdge } from "@/server/orgs/service";

/** G2-02: a dated ownership/control relation; overlaps, loops and more than 100 % are refused. */
export const POST = route({ body: OwnershipEdge }, async ({ actor, input }) => ({ edgeId: await addOwnershipEdge(actor, input) }));
