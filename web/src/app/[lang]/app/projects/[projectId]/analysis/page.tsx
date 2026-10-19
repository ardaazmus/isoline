import { redirect } from "next/navigation";

/** The analysis area opens on the decarbonisation pathway. */
export default async function AnalysisIndex({ params, searchParams }: PageProps<"/[lang]/app/projects/[projectId]/analysis">) {
  const { lang, projectId } = await params;
  const sp = await searchParams;
  redirect(`/${lang}/app/projects/${projectId}/analysis/pathway${typeof sp.cycle === "string" ? `?cycle=${encodeURIComponent(sp.cycle)}` : ""}`);
}
