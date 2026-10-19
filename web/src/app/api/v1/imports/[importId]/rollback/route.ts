import { route } from "@/server/http/api";
import { rollbackImport } from "@/server/legacy/import";

export const POST = route({ status: 200 }, async ({ actor, params }) => rollbackImport(actor, params.importId));
