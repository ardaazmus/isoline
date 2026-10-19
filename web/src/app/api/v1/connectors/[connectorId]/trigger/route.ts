import { route } from "@/server/http/api";
import { triggerConnector } from "@/server/connectors/service";

/** Queues a pull; the worker runs it with retries and a dead-letter end state. */
export const POST = route({ status: 202 }, async ({ actor, params }) => triggerConnector(actor, params.connectorId));
