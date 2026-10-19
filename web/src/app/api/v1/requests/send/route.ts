import { route } from "@/server/http/api";
import { RequestIds } from "@/server/http/schemas";
import { sendRequests } from "@/server/data/service";

export const POST = route({ body: RequestIds, status: 200 }, async ({ actor, input }) => sendRequests(actor, input.requestIds));
