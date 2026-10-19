import { route } from "@/server/http/api";
import { LegacyImport } from "@/server/http/schemas";
import { applyImport, listImports } from "@/server/legacy/import";

/** G1-11: imports of browser workspaces into this workspace. */
export const GET = route({}, async ({ actor }) => ({ imports: await listImports(actor) }));

/** Applies an import after the preview; the file is parsed again here, the preview is not trusted. */
export const POST = route({ body: LegacyImport }, async ({ actor, input }) => applyImport(actor, input.content, input.fileName, input.mode, { includeSample: input.includeSample }));
