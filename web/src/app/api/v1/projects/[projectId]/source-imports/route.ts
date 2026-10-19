import { route } from "@/server/http/api";
import { listImports } from "@/server/data/imports";

export const GET = route({}, async ({ actor, params }) => ({ imports: await listImports(actor, params.projectId) }));
