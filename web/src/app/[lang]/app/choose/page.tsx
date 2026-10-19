import { ChooseWorkspace } from "@/platform/forms";
import { PageTitle } from "@/platform/ui";
import { titled, tr } from "@/platform/server";
import { requireSession } from "@/server/http/dal";
import { myMemberships } from "@/server/tenancy/service";
import { redirect } from "next/navigation";

export const generateMetadata = titled("pf.choose.title");

/** AUTH-09: one person, several workspaces — choose where to work. */
export default async function ChoosePage({ params }: PageProps<"/[lang]/app/choose">) {
  const { lang } = await params;
  const t = tr(lang);
  const session = await requireSession(lang, `/${lang}/app/choose`);
  const memberships = await myMemberships(session.identity.userId);
  if (!memberships.length) redirect(`/${lang}/app/onboarding`);
  return (
    <>
      <PageTitle title={t("pf.choose.title")} lead={t("pf.choose.lead", { name: session.name })} />
      <ChooseWorkspace lang={lang} memberships={memberships} />
    </>
  );
}
