import { ChooseWorkspace } from "@/platform/forms";
import { PageTitle } from "@/platform/ui";
import { titled, tr } from "@/platform/server";
import { requireSession } from "@/server/http/dal";
import { myMemberships } from "@/server/tenancy/service";
import { redirect } from "next/navigation";

export const generateMetadata = titled("pf.choose.title");

/**
 * AUTH-09: one person, several workspaces — choose where to work. A single workspace opens straight away unless the
 * person asked to stay (?stay=1, e.g. to open another workspace).
 */
export default async function ChoosePage({ params, searchParams }: PageProps<"/[lang]/app/choose">) {
  const { lang } = await params;
  const sp = await searchParams;
  const t = tr(lang);
  const session = await requireSession(lang, `/${lang}/app/choose`);
  const memberships = await myMemberships(session.identity.userId);
  if (!memberships.length) redirect(`/${lang}/app/onboarding`);
  return (
    <>
      <PageTitle title={t("pf.choose.title")} lead={t("pf.choose.lead", { name: session.name })} />
      <ChooseWorkspace lang={lang} memberships={memberships} auto={sp.stay !== "1"} />
    </>
  );
}
