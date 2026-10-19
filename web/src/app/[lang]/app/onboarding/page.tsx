import { OnboardingForm } from "@/platform/forms";
import { PageTitle } from "@/platform/ui";
import { titled, tr } from "@/platform/server";
import { requireSession } from "@/server/http/dal";

export const generateMetadata = titled("pf.onboarding.title");

/** ORG-01..04: company-first or advisory-first; both land on the same data model (ADR-002). */
export default async function OnboardingPage({ params }: PageProps<"/[lang]/app/onboarding">) {
  const { lang } = await params;
  const t = tr(lang);
  await requireSession(lang, `/${lang}/app/onboarding`);
  return (
    <>
      <PageTitle title={t("pf.onboarding.title")} lead={t("pf.onboarding.lead")} />
      <div className="max-w-[820px]">
        <OnboardingForm lang={lang} />
      </div>
    </>
  );
}
