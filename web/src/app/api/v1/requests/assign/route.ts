import { route } from "@/server/http/api";
import { AssignRequests } from "@/server/http/schemas";
import { assignRequests } from "@/server/data/service";

/** G3-03/09: bulk assignment of assignee, a different reviewer, due date and criticality. */
export const POST = route({ body: AssignRequests, status: 200 }, async ({ actor, input }) => assignRequests(actor, input.requestIds, input));
