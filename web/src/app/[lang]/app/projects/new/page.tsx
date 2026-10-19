import { ProjectWizard } from "@/platform/g2/project";
import { PageTitle, Section, StateBox } from "@/platform/ui";
import { attempt, titled, tr } from "@/platform/server";
import { requireWorkspace } from "@/server/http/dal";
import { wizardOptions } from "@/server/projects/service";

export const generateMetadata = titled("pf.wizard.title");

/** PORT-07: name, organisation, engagement, reporting period and publication date → project with its plan. */
export default async function NewProjectPage({ params }: PageProps<"/[lang]/app/projects/new">) {
  const { lang } = await params;
  const t = tr(lang);
  const ws = await requireWorkspace(lang);
  const opts = await attempt(() => wizardOptions(ws.actor));
  if (!opts.ok) return <StateBox state="not_authorized">{t("pf.wizard.notAllowed")}</StateBox>;
  return (
    <>
      <PageTitle title={t("pf.wizard.title")} lead={t("pf.wizard.lead")} />
      <Section title={t("pf.wizard.formTitle")}>
        <ProjectWizard lang={lang} organizations={opts.data.organizations} engagements={opts.data.engagements} clients={opts.data.clients} defaultYear={new Date().getFullYear()} />
      </Section>
    </>
  );
}
