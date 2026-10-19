import Link from "next/link";
import { TEMPLATES } from "@/data/templates";
import { CampaignForm } from "@/platform/g3/campaign";
import { loadProject, pickCycle, ProjectHeader } from "@/platform/project-shell";
import { Badge, Section, StateBox } from "@/platform/ui";
import { titled, tr } from "@/platform/server";
import { grantCan, memberCan } from "@/server/policy/policy";
import { listCampaigns, suggestedTemplates } from "@/server/data/service";
import { listCycles } from "@/server/projects/service";
import { listConnectors } from "@/server/connectors/service";
import { ConnectorForm, TriggerButton } from "@/platform/g8/connectors";
import { dateTime } from "@/platform/server";

export const generateMetadata = titled("pf.data.title");

/** DATA-01/02: the data plan — campaigns built from the chosen report templates, with their progress. */
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
  const [campaigns, suggested, connectors] = await Promise.all([listCampaigns(ws.actor, projectId), suggestedTemplates(ws.actor, cycle.id), listConnectors(ws.actor, projectId)]);
  const role = ws.actor.role;
  const canRequest = role !== null && memberCan(role, "data.request") && (data.access.via !== "grant" || grantCan(data.access.grantRole!, "data.request"));
  const mine = campaigns.filter((c) => c.cycle_id === cycle.id);
  return (
    <>
      <ProjectHeader lang={lang} p={loaded.p} />
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
        {(connectors.length > 0 || (canRequest && data.access.via === "member" && mine.length > 0)) && (
          <Section title={t("pf.con.title")}>
            <p className="text-[12.5px] leading-relaxed text-[var(--ink-3)]">{t("pf.con.lead")}</p>
            {connectors.length > 0 && (
              <ul className="flex flex-col gap-3">
                {connectors.map((c) => (
                  <li key={c.id} className="rounded-[12px] border border-[var(--rule)] bg-[var(--paper)] p-3 text-[13px]">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span>
                        <span className="font-semibold">{c.name}</span> · {t(`pf.con.kinds.${c.kind}`)} · <span className="font-mono text-[12px]">{c.allowed_host}</span> · {c.campaign_title} · {t(`pf.con.schedules.${c.schedule}`)}
                      </span>
                      {canRequest && <TriggerButton connectorId={c.id} />}
                    </div>
                    {c.runs.length > 0 && (
                      <ul className="mt-2 flex flex-col gap-0.5 text-[12px] text-[var(--ink-2)]">
                        {c.runs.slice(0, 5).map((r) => (
                          <li key={r.id}>
                            <Badge tone={r.status === "failed" ? "crit" : r.status === "unchanged" ? "neutral" : "ok"}>{t(`pf.con.runStatus.${r.status}`)}</Badge> {dateTime(lang, r.pulled_at)}
                            {r.rows !== null ? ` · ${t("pf.con.rows", { rows: r.rows, valid: r.valid ?? 0 })}` : ""}
                            {r.message ? ` · ${r.message}` : ""}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {canRequest && data.access.via === "member" && mine.length > 0 && <ConnectorForm campaigns={mine.map((c) => ({ id: c.id, title: c.title }))} />}
          </Section>
        )}
        {canRequest && (
          <Section title={t("pf.data.newCampaign")}>
            <p className="text-[13px] leading-relaxed text-[var(--ink-2)]">{suggested.basedOnDecisions ? t("pf.data.fromDecisions") : t("pf.data.fromSuggestions")}</p>
            <CampaignForm cycleId={cycle.id} lang={lang} projectId={projectId} templates={TEMPLATES.map((x) => ({ id: x.id, kind: x.kind }))} suggested={suggested.suggestions.map((s) => s.template)} />
          </Section>
        )}
      </div>
    </>
  );
}
