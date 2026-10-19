import { route } from "@/server/http/api";
import { commitImport } from "@/server/data/imports";

export const POST = route({ status: 200 }, async ({ actor, params }) => commitImport(actor, params.importId));
