import Link from "next/link";
import { DeliverableForm, EngagementForm, EngagementStatus } from "@/platform/g2/engagements";
import { Badge, PageTitle, Section, StateBox } from "@/platform/ui";
import { dateOnly, titled, tr } from "@/platform/server";
import { requireWorkspace } from "@/server/http/dal";
import { memberCan } from "@/server/policy/policy";
import { listEngagements, wizardOptions } from "@/server/projects/service";
import { listProjects } from "@/server/tenancy/service";

export const generateMetadata = titled("pf.eng.title");

/** PORT-04/05 / G2-04: engagements (one contract, many reports) with deliverables linked to projects. */
export default async function EngagementsPage({ params }: PageProps<"/[lang]/app/engagements">) {
  const { lang } = await params;
  const t = tr(lang);
  const ws = await requireWorkspace(lang);
  const [engagements, projects] = await Promise.all([listEngagements(ws.actor), listProjects(ws.actor)]);
  const canCreate = ws.actor.role !== null && memberCan(ws.actor.role, "project.create");
  const opts = canCreate ? await wizardOptions(ws.actor) : { clients: [] };
  return (
    <>
      <PageTitle title={t("pf.eng.title")} lead={t("pf.eng.lead")} />
      <div className="flex flex-col gap-6">
        {canCreate && (
          <Section title={t("pf.eng.new")}>
            <EngagementForm clients={opts.clients} />
          </Section>
        )}
        {engagements.length === 0 ? (
          <StateBox state="empty" title={t("pf.eng.none")} />
        ) : (
          engagements.map((e) => {
            const mine = e.owner_tenant_id === ws.tenant.tenantId || opts.clients.some((c) => c.id === e.owner_tenant_id);
            return (
              <Section key={e.id} title={e.title} aside={<Badge tone={e.status === "active" ? "ok" : e.status === "cancelled" ? "crit" : "neutral"}>{t(`pf.eng.status.${e.status}`)}</Badge>}>
                <p className="text-[13px] text-[var(--ink-2)]">
                  {t("pf.eng.ownerLine", { owner: e.owner_name })}
                  {e.starts_on && ` · ${dateOnly(lang, e.starts_on)} – ${e.ends_on ? dateOnly(lang, e.ends_on) : "…"}`}
                </p>
                {e.deliverables.length > 0 && (
                  <ul className="flex flex-col divide-y divide-[var(--rule)]">
                    {e.deliverables.map((d) => (
                      <li key={d.id} className="flex flex-wrap items-center gap-3 py-2 text-[13.5px]">
                        <span className="flex-1 font-medium">{d.title}</span>
                        <Badge>{t(`pf.eng.kinds.${d.report_kind}`)}</Badge>
                        {d.due_on && <span className="text-[12.5px] text-[var(--ink-3)]">{dateOnly(lang, d.due_on)}</span>}
                        {d.project_id && (
                          <Link href={`/${lang}/app/projects/${d.project_id}`} className="text-[12.5px] text-[var(--b-700)]">
                            {t("pf.eng.openProject")}
                          </Link>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {mine && canCreate && (
                  <>
                    <EngagementStatus id={e.id} status={e.status} />
                    <DeliverableForm engagementId={e.id} projects={projects.filter((p) => p.owner_tenant_id === e.owner_tenant_id).map((p) => ({ id: p.id, name: p.name }))} />
                  </>
                )}
              </Section>
            );
          })
        )}
      </div>
    </>
  );
}
