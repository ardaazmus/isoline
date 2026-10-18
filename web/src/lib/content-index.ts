/**
 * Automatic content index for report templates (Gemini dynamic-variables slice, browser-local).
 * Each template section already names its disclosure references and the tools that feed it
 * computed figures; the index flattens that into one numbered table so a reader can trace
 * every section to its basis and its live numbers. Rendered on the template page and
 * appended to the Word export. Pure.
 */
import type { ClientData } from "@/data/sample";
import type { Formatters } from "@/i18n/core";
import type { Template } from "@/data/templates";
import { toolSummary } from "./summary";

type T = (key: string, vars?: Record<string, string | number>) => string;

export type IndexRow = { section: string; refs: string; figures: string };

export function buildContentIndex(tp: Template, client: ClientData, t: T, fmt: Formatters): IndexRow[] {
  return tp.sections.map((s, i) => {
    const figs = (s.tools ?? []).flatMap((tool) => toolSummary(client, tool, t, fmt));
    return {
      section: `${i + 1}. ${t(`tpl.${tp.id}.sections.${s.id}.title`)}`,
      refs: s.refs.join(" · ") || "—",
      figures: figs.map((f) => `${f.label}: ${f.value}`).join(" | ") || "—",
    };
  });
}
