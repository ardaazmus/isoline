import { route } from "@/server/http/api";
import { IssuesQuery } from "@/server/http/schemas";
import { listIssues } from "@/server/calc/service";

/** G4-07: open (or all) quality findings of the cycle. */
export const GET = route({ query: IssuesQuery }, async ({ actor, input, params }) => ({ issues: await listIssues(actor, params.cycleId, (input as { status?: "open" | "all" } | undefined)?.status ?? "open") }));
