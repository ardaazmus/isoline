import { route } from "@/server/http/api";
import { LegacyImport } from "@/server/http/schemas";
import { previewImport } from "@/server/legacy/import";

/** Reads the file and reports what an import would create; writes nothing. */
export const POST = route({ body: LegacyImport, status: 200 }, async ({ actor, input }) => previewImport(actor, input.content, input.mode));
