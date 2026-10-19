import { notFound } from "next/navigation";
import { QuickView } from "@/platform/g9/quick";
import { QUICK_TOOLS, type QuickTool } from "@/platform/g9/quick-tools";
import { tr } from "@/platform/server";
import { requireWorkspace } from "@/server/http/dal";
import { memberCan } from "@/server/policy/policy";

export async function generateMetadata({ params }: PageProps<"/[lang]/app/quick/[tool]">) {
  const { lang, tool } = await params;
  return { title: `${tr(lang)(`nav.${tool}`)} · ${tr(lang)("pf.quick.title")}` };
}

/** One quick calculator in the platform frame (browser-only; "Save to cycle" for GHG and environment inputs). */
export default async function QuickToolPage({ params }: PageProps<"/[lang]/app/quick/[tool]">) {
  const { lang, tool } = await params;
  if (!(QUICK_TOOLS as readonly string[]).includes(tool)) notFound();
  const ws = await requireWorkspace(lang);
  const canSave = ws.actor.role !== null && memberCan(ws.actor.role, "data.submit");
  return <QuickView page={tool as QuickTool} lang={lang} canSave={canSave} />;
}
