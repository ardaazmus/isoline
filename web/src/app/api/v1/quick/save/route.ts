import { route } from "@/server/http/api";
import { QuickSaveBody } from "@/server/http/schemas";
import { saveQuickDrafts } from "@/server/quick/service";

/** Saves a quick calculation's inputs as drafts of the chosen data requests (assignee only). */
export const POST = route({ body: QuickSaveBody, status: 200 }, async ({ actor, input }) => ({ results: await saveQuickDrafts(actor, input.items) }));
