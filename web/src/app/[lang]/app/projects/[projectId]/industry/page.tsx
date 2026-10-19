import Link from "next/link";
import { RunButton } from "@/platform/g5/close";
import { PackForm, PackRequestsForm } from "@/platform/g7/g7";
import { factValue, metricLabel } from "@/platform/g4/format";
import { loadProject, pickCycle, ProjectHeader } from "@/platform/project-shell";
import { Badge, Section, StateBox } from "@/platform/ui";
import { titled, tr } from "@/platform/server";
import { grantCan, memberCan, type Action } from "@/server/policy/policy";
import { listFacts } from "@/server/calc/service";
import { listCampaigns } from "@/server/data/service";
import { projectPacks } from "@/server/industry/service";
import { listCycles } from "@/server/projects/service";

export const generateMetadata = titled("pf.ind.title");

/** Industry pack manager (G7-04..06): packs suggested by facility activity, their data items and basis, pack KPIs. */
export default async function IndustryPage({ params, searchParams }: PageProps<"/[lang]/app/projects/[projectId]/industry">) {
  const { lang, projectId } = await params;
  const sp = await searchParams;
  const t = tr(lang);
  const loaded = await loadProject(lang, projectId);
  if (!loaded.ok) return loaded.view;
  const { ws, data } = loaded.p;
  const can = (a: Action) => ws.actor.role !== null && memberCan(ws.actor.role, a) && (data.access.via !== "grant" || grantCan(data.access.grantRole!, a));
  const cycles = await listCycles(ws.actor, projectId);
  const cycle = pickCycle(cycles, sp.cycle);
  const [packs, campaigns, facts] = await Promise.all([projectPacks(ws.actor, projectId), listCampaigns(ws.actor, projectId), cycle ? listFacts(ws.actor, cycle.id) : Promise.resolve([])]);
  const kpis = facts.filter((f) => f.metric_key.startsWith("ind."));
  const anyEnabled = packs.packs.some((p) => p.enabled);
  return (
    <>
      <ProjectHeader lang={lang} p={loaded.p} cycleId={cycle?.id} />
      <div className="flex flex-col gap-6">
        <p className="max-w-[80ch] text-[13.5px] leading-relaxed text-[var(--ink-2)]">{t("pf.ind.lead")}</p>
        {packs.packs.map((p) => (
          <Section
            key={p.id}
            title={`${p.code} · ${t(`pf.ind.pack.${p.id}`)}`}
            aside={
              <span className="flex flex-wrap gap-1.5">
                {p.suggested && <Badge tone="info">{t("pf.ind.suggested")}</Badge>}
                {p.enabled && <Badge tone="ok">{t("pf.ind.on")}</Badge>}
                <Badge>{t(`pf.ind.status.${p.standardStatus}`)}</Badge>
              </span>
            }
          >
            <p className="text-[12.5px] text-[var(--ink-3)]">
              v{p.version} · NACE {p.nace.join(", ")} · {p.standardRefs.join(" · ")}
            </p>
            <ul className="flex flex-col gap-1 text-[13px]">
              {p.metrics.map((m) => (
                <li key={m.code}>
                  <Badge tone={m.status === "mandatory" ? "warn" : "neutral"}>{t(`pf.ind.metricStatus.${m.status}`)}</Badge> {t(`req.items.${m.code}`)} <span className="text-[12px] text-[var(--ink-3)]">— {m.basis}</span>
                </li>
              ))}
            </ul>
            {can("project.update") && <PackForm projectId={projectId} packId={p.id} facilities={packs.facilities.map((f) => ({ id: f.id, name: `${f.name}${f.nace_code ? ` (${f.nace_code})` : ""}` }))} initial={p.enabled?.facility_ids ?? p.suggestedFacilities} enabled={Boolean(p.enabled)} />}
          </Section>
        ))}
        {anyEnabled && can("data.request") && (
          <Section title={t("pf.ind.requestsTitle")}>
            <PackRequestsForm campaigns={campaigns.filter((c) => !cycle || c.cycle_id === cycle.id).map((c) => ({ id: c.id, title: c.title }))} />
          </Section>
        )}
        {cycle && anyEnabled && (
          <Section title={t("pf.ind.kpis", { label: cycle.label })}>
            {can("calc.run") && <RunButton path={`/api/v1/cycles/${cycle.id}/industry`} label={t("pf.ind.run")} />}
            {kpis.length === 0 ? (
              <StateBox state="empty" title={t("pf.ind.noKpis")} />
            ) : (
              <ul className="flex flex-col gap-1.5 text-[13.5px]">
                {kpis.map((f) => (
                  <li key={f.id} className="flex flex-wrap items-center gap-2">
                    <Link href={`/${lang}/app/facts/${f.id}`} className="text-[var(--b-700)]">
                      {metricLabel(t, f.metric_key)}
                    </Link>
                    {f.facility_name && <span className="text-[12.5px] text-[var(--ink-3)]">{f.facility_name}</span>}
                    <span className="tabular-nums">
                      {factValue(lang, f.value_num, f.unit)} {f.unit === "ratio" ? "" : f.unit}
                    </span>
                    {Number(f.estimated_share) === 1 && <Badge tone="warn">{t("pf.ind.estimated")}</Badge>}
                  </li>
                ))}
              </ul>
            )}
          </Section>
        )}
      </div>
    </>
  );
}
