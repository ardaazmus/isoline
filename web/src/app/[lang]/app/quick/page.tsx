import Link from "next/link";
import { PageTitle } from "@/platform/ui";
import { titled, tr } from "@/platform/server";
import { QUICK_TOOLS } from "@/platform/g9/quick-tools";
import { requireWorkspace } from "@/server/http/dal";

export const generateMetadata = titled("pf.quick.title");

/** Library → quick calculation: the toolkit's calculators as a browser-only sandbox, one entry point. */
export default async function QuickIndex({ params }: PageProps<"/[lang]/app/quick">) {
  const { lang } = await params;
  const t = tr(lang);
  await requireWorkspace(lang);
  return (
    <>
      <PageTitle title={t("pf.quick.title")} lead={t("pf.quick.lead")} />
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {QUICK_TOOLS.map((id) => (
          <li key={id}>
            <Link href={`/${lang}/app/quick/${id}`} className="glass flex h-full flex-col gap-1.5 p-4 no-underline transition-shadow hover:shadow-[0_12px_30px_-18px_rgba(31,52,160,0.6)]">
              <span className="text-[15px] font-semibold text-[var(--ink)]">{t(`nav.${id}`)}</span>
              <span className="text-[13px] leading-snug text-[var(--ink-2)]">{t(`pf.quick.desc.${id}`)}</span>
              {(id === "ghg" || id === "environment") && <span className="mt-auto pt-1 text-[12px] font-medium text-[var(--b-700)]">{t("pf.quick.savable")}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
