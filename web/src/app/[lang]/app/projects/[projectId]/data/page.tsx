import Link from "next/link";
import { TEMPLATES } from "@/data/templates";
import { CampaignForm } from "@/platform/g3/campaign";
import { loadProject, pickCycle, ProjectHeader } from "@/platform/project-shell";
import { Badge, Section, StateBox } from "@/platform/ui";
import { titled, tr } from "@/platform/server";
import { grantCan, memberCan } from "@/server/policy/policy";
import { listCampaigns, suggestedTemplates } from "@/server/data/service";
import { listCycles } from "@/server/projects/service";

export const generateMetadata = titled("pf.data.title");

/**
 * Step 2, data collection (DATA-01/02): the cycle's data request lists with their progress. Building a new list folds
 * away once one exists; connectors moved to Setup.
 */
export default async function DataPage({ params, searchParams }: PageProps<"/[lang]/app/projects/[projectId]/data">) {
  const { lang, projectId } = await params;
  const sp = await searchParams;
  const t = tr(lang);
  const loaded = await loadProject(lang, projectId);
  if (!loaded.ok) return loaded.view;
  const { ws, data } = loaded.p;
  const cycles = await listCycles(ws.actor, projectId);
  const cycle = pickCycle(cycles, sp.cycle);
  if (!cycle)
    return (
      <>
        <ProjectHeader lang={lang} p={loaded.p} />
        <StateBox state="empty" title={t("pf.cycle.none")} />
      </>
    );
  const [campaigns, suggested] = await Promise.all([listCampaigns(ws.actor, projectId), suggestedTemplates(ws.actor, cycle.id)]);
  const role = ws.actor.role;
  const canRequest = role !== null && memberCan(role, "data.request") && (data.access.via !== "grant" || grantCan(data.access.grantRole!, "data.request"));
  const mine = campaigns.filter((c) => c.cycle_id === cycle.id);
  return (
    <>
      <ProjectHeader lang={lang} p={loaded.p} cycleId={cycle?.id} />
      <div className="flex flex-col gap-6">
        <Section title={t("pf.data.campaigns", { label: cycle.label })}>
          {mine.length === 0 ? (
            <StateBox state="empty" title={t("pf.data.noCampaign")}>
              {t("pf.data.noCampaignLead")}
            </StateBox>
          ) : (
            <ul className="flex flex-col gap-3">
              {mine.map((c) => {
                const total = Object.values(c.counts).reduce((a, b) => a + b, 0);
                const done = (c.counts.accepted ?? 0) + (c.counts.not_applicable ?? 0) + (c.counts.withdrawn ?? 0);
                const pct = total ? Math.round((done / total) * 100) : 0;
                return (
                  <li key={c.id} className="rounded-[14px] border border-[var(--rule)] bg-[var(--paper)] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Link href={`/${lang}/app/projects/${projectId}/data/${c.id}`} className="text-[15px] font-semibold text-[var(--b-700)]">
                        {c.title}
                      </Link>
                      <span className="text-[12.5px] text-[var(--ink-3)]">{c.template_ids.map((x) => t(`tpl.${x}.title`)).join(" · ")}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--b-50)]" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={t("pf.data.progress")}>
                        <div className="h-full rounded-full bg-[var(--b-600)]" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[12.5px] text-[var(--ink-2)]">{t("pf.data.doneOf", { done, total })}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {Object.entries(c.counts).map(([s, n]) => (
                        <Badge key={s}>
                          {t(`pf.data.status.${s}`)}: {n}
                        </Badge>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
        {canRequest &&
          (mine.length === 0 ? (
            <Section title={t("pf.data.newCampaign")}>
              <p className="text-[13px] leading-relaxed text-[var(--ink-2)]">{suggested.basedOnDecisions ? t("pf.data.fromDecisions") : t("pf.data.fromSuggestions")}</p>
              <CampaignForm cycleId={cycle.id} lang={lang} projectId={projectId} templates={TEMPLATES.map((x) => ({ id: x.id, kind: x.kind }))} suggested={suggested.suggestions.map((s) => s.template)} />
            </Section>
          ) : (
            <details className="glass rounded-[18px] p-5">
              <summary className="cursor-pointer text-[15px] font-semibold text-[var(--ink)]">{t("pf.data.newCampaign")}</summary>
              <div className="mt-3 flex flex-col gap-3">
                <p className="text-[13px] leading-relaxed text-[var(--ink-2)]">{suggested.basedOnDecisions ? t("pf.data.fromDecisions") : t("pf.data.fromSuggestions")}</p>
                <CampaignForm cycleId={cycle.id} lang={lang} projectId={projectId} templates={TEMPLATES.map((x) => ({ id: x.id, kind: x.kind }))} suggested={suggested.suggestions.map((s) => s.template)} />
              </div>
            </details>
          ))}
      </div>
    </>
  );
}
