import { route } from "@/server/http/api";
import { CreateConnector } from "@/server/http/schemas";
import { createConnector } from "@/server/connectors/service";

/** G8-01: a controlled pull connector into this campaign (set up by a member of the owning company). */
export const POST = route({ body: CreateConnector }, async ({ actor, input, params }) => createConnector(actor, params.campaignId, input));
