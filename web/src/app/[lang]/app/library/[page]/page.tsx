import { notFound } from "next/navigation";
import { QuickView } from "@/platform/g9/quick";
import { LIBRARY_PAGES, type LibraryPage } from "@/platform/g9/quick-tools";
import { tr } from "@/platform/server";
import { requireWorkspace } from "@/server/http/dal";

export async function generateMetadata({ params }: PageProps<"/[lang]/app/library/[page]">) {
  const { lang, page } = await params;
  return { title: tr(lang)(`nav.${page}`) };
}

/** Library reference pages from the toolkit: regulation calendar, framework crosswalk, colour and theme guide. */
export default async function LibraryPageView({ params }: PageProps<"/[lang]/app/library/[page]">) {
  const { lang, page } = await params;
  if (!(LIBRARY_PAGES as readonly string[]).includes(page)) notFound();
  await requireWorkspace(lang);
  return <QuickView page={page as LibraryPage} lang={lang} canSave={false} />;
}
