import { notFound } from "next/navigation";
import { TEMPLATES } from "@/data/templates";
import { LOCALES } from "@/i18n/generated";
import { TemplateDetail } from "@/features/templates";

export function generateStaticParams() {
  return LOCALES.flatMap((l) => TEMPLATES.map((t) => ({ lang: l.code, id: t.id })));
}

export default async function Page({ params }: PageProps<"/[lang]/templates/[id]">) {
  const { id } = await params;
  if (!TEMPLATES.some((t) => t.id === id)) notFound();
  return <TemplateDetail id={id} />;
}
