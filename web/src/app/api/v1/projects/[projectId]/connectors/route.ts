import { route } from "@/server/http/api";
import { listConnectors } from "@/server/connectors/service";

/** Connectors of the project with their latest runs (status, rows, checksum, message). */
export const GET = route({}, async ({ actor, params }) => ({ connectors: await listConnectors(actor, params.projectId) }));
