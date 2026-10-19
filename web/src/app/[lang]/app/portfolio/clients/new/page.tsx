import { ProvisionalClientForm } from "@/platform/forms";
import { PageTitle, Section, StateBox } from "@/platform/ui";
import { titled, tr } from "@/platform/server";
import { requireWorkspace } from "@/server/http/dal";
import { memberCan } from "@/server/policy/policy";

export const generateMetadata = titled("pf.clients.title");

/** PORT-03 / path D: an advisory prepares a customer workspace; the customer's representative claims ownership. */
export default async function NewClientPage({ params }: PageProps<"/[lang]/app/portfolio/clients/new">) {
  const { lang } = await params;
  const t = tr(lang);
  const ws = await requireWorkspace(lang);
  const allowed = ws.tenant.kind === "advisory" && ws.actor.role !== null && memberCan(ws.actor.role, "client.create");
  return (
    <>
      <PageTitle title={t("pf.clients.title")} lead={t("pf.clients.lead")} />
      {allowed ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <Section title={t("pf.clients.formTitle")}>
            <ProvisionalClientForm lang={lang} />
          </Section>
          <aside className="glass flex flex-col gap-3 p-5 text-[13.5px] leading-relaxed text-[var(--ink-2)]">
            <h2 className="text-[15px] font-semibold text-[var(--ink)]">{t("pf.clients.howTitle")}</h2>
            <ol className="flex list-decimal flex-col gap-2 pl-4">
              <li>{t("pf.clients.how1")}</li>
              <li>{t("pf.clients.how2")}</li>
              <li>{t("pf.clients.how3")}</li>
              <li>{t("pf.clients.how4")}</li>
            </ol>
          </aside>
        </div>
      ) : (
        <StateBox state="not_authorized">{t("pf.clients.advisoryOnly")}</StateBox>
      )}
    </>
  );
}
