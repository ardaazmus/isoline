import { route } from "@/server/http/api";
import { QuickTargetsQuery } from "@/server/http/schemas";
import { quickTargets } from "@/server/quick/service";

/** The person's open data requests a quick calculation can fill (comma-separated metric codes). */
export const GET = route({ query: QuickTargetsQuery }, async ({ actor, input }) => {
  const metrics = ((input as { metrics?: string } | undefined)?.metrics ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 20);
  return { targets: await quickTargets(actor, metrics) };
});
