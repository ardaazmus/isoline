"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { useI18n } from "@/i18n/provider";
import { evaluate } from "@/lib/calc/applicability";
import { computeInventory } from "@/lib/calc/ghg";
import { projectPortfolio } from "@/lib/calc/cbam";
import { buildPathway } from "@/lib/calc/pathway";
import { environment, safetyRates, taxonomyKpis } from "@/lib/calc/indicators";
import { EVENTS } from "@/data/regulations";
import { JOURNEYS, stageStatus, type Track } from "@/data/journey";
import { PageHeader } from "@/components/shell";
import { LineChart, ShareBar, StackedBars } from "@/components/charts";
import { LegendItem, SourceNote } from "@/components/figure";
import { SampleFlag, StatusMark, cn } from "@/components/ui";
import { CountUp, ThemeIcon } from "@/components/data";
import { th, type ThemeId } from "@/data/themes";
import { Hydrated } from "./common";
import { localDay, useToday } from "@/lib/dates";
import { approvalOf, SECTION_IDS } from "@/lib/approval";
import { NAV } from "@/data/nav";
import { useActiveClient } from "@/store/workspace";


export function Overview() {
  return (
    <Hydrated>
      <Inner />
    </Hydrated>
  );
}

function Tile({ title, href, children, className, family = "compass", sources, theme }: { title: string; href?: string; children: ReactNode; className?: string; family?: string; sources?: string[]; theme?: ThemeId }) {
  const { locale } = useI18n();
  return (
    <section data-family={family} className={cn("glass sheet lift group flex min-w-0 flex-col gap-3 p-5", className)}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex min-w-0 items-center gap-2.5 text-[14px] font-semibold text-[var(--ink)]">
          {theme && <ThemeIcon theme={theme} size="sm" />}
          {title}
        </h2>
        {href !== undefined && (
          <Link href={`/${locale}${href}`} aria-label={title} className="grid h-7 w-7 place-items-center rounded-full bg-[var(--b-100)] text-[var(--accent-ink)] transition-colors hover:bg-[var(--b-600)] hover:text-white">
            <ArrowUpRight size={15} aria-hidden />
          </Link>
        )}
      </div>
      {children}
      {sources && (
        <div className="mt-auto pt-1">
          <SourceNote compact meta={{ sources }} />
        </div>
      )}
    </section>
  );
}

function Inner() {
  const { t, fmt } = useI18n();
  const c = useActiveClient();
  const today = useToday() ?? "";
  const findings = useMemo(() => evaluate(c.profile).filter((f) => f.status === "required" || f.status === "indirect" || f.status === "review"), [c.profile]);
  const ghg = useMemo(() => computeInventory(c.ghg), [c.ghg]);
  const cbam = useMemo(() => projectPortfolio(c.cbam.products, c.cbam.scenario), [c.cbam]);
  const path = useMemo(() => buildPathway(c.pathway, 2040), [c.pathway]);
  const env = environment(c.indicators.env);
  const safety = safetyRates(c.indicators.safety);
  const tax = taxonomyKpis(c.taxonomy.activities, c.taxonomy.totals, c.taxonomy.notAssessed);
  const deadlines = [
    ...findings.flatMap((f) => f.dates.map((d) => ({ id: f.id + d.key, label: t(`dates.${d.key}`), date: d.date, own: true }))),
    ...EVENTS.map((e) => ({ id: e.id, label: t(`reg.events.${e.id}`), date: e.date, own: false })),
  ]
    .filter((d) => d.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .filter((d, i, arr) => arr.findIndex((x) => x.label === d.label || x.date === d.date) === i)
    .slice(0, 6);
  const total = ghg.totalLocation || 1;
  const [allObl, setAllObl] = useState(false);
  const obligations = allObl ? findings : findings.slice(0, 6);

  return (
    <div>
      <PageHeader
        title={c.name}
        result={t("overview.result", { n: findings.length, total: fmt.compact(ghg.totalLocation), cbam: fmt.currency(cbam.find((r) => r.year === 2030)?.cost ?? 0) })}
        actions={c.sample ? <SampleFlag onBand text={t("shell.sample")} /> : undefined}
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-6 xl:grid-cols-12">
        <Tile title={t("overview.obligations")} href="/applicability" className="md:col-span-6 xl:col-span-5 xl:row-span-2" sources={["kgk_scope_2026", "csrd_omnibus", "cbam_reg", "tr_ets_reg"]}>
          <ul className="flex flex-col">
            {obligations.map((f) => (
              <li key={f.id} className="flex flex-col gap-1 border-b border-[var(--rule)] py-2.5 last:border-b-0">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="text-[14px] font-semibold">{t(`app.reg.${f.id}`)}</span>
                  <StatusMark kind={f.status === "required" ? "required" : f.status === "indirect" ? "indirect" : "review"} label={t(`app.status.${f.status}`)} />
                </div>
                <div className="line-clamp-2 text-[12.5px] text-[var(--ink-3)]">{t(`app.notes.${f.notes[0]}`)}</div>
              </li>
            ))}
          </ul>
          {findings.length > 6 && (
            <button type="button" onClick={() => setAllObl(!allObl)} className="self-start text-[13px] font-semibold text-[var(--accent-ink)] hover:underline">
              {allObl ? t("note.less") : t("overview.moreObligations", { n: findings.length - 6 })}
            </button>
          )}
        </Tile>

        <Tile title={t("nav.cbam")} href="/tools/cbam" family="climate" theme="climate" className="md:col-span-6 xl:col-span-4" sources={["cbam_reg", "cbam_price"]}>
          <div className="flex items-baseline gap-3">
            <span className="figure-num text-[34px] text-[var(--th-climate-ink)]">
              <CountUp text={`${fmt.compact(cbam.find((r) => r.year === 2030)?.cost ?? 0)} €`} />
            </span>
            <span className="text-[12.5px] text-[var(--ink-3)]">{t("overview.cbam2030")}</span>
          </div>
          <StackedBars
            height={150}
            label={t("cbam.chartCost")}
            categories={cbam.map((r) => String(r.year).slice(2))}
            yFormat={(v) => fmt.compact(v)}
            stacks={[{ id: "c", label: t("cbam.legendCost"), values: cbam.map((r) => r.cost), color: "var(--th-climate)" }]}
            overlay={[{ id: "d", label: t("cbam.legendDefault"), values: cbam.map((r) => r.costDefault), color: "var(--th-climate-2)", dash: true }]}
          />
        </Tile>

        <Tile title={t("nav.ghg")} href="/tools/ghg" family="climate" theme="climate" className="md:col-span-3 xl:col-span-3" sources={["ghg_protocol", "etkb_ef_2023"]}>
          <span className="figure-num text-[34px]">
            <CountUp text={fmt.compact(ghg.totalLocation)} />
          </span>
          <span className="-mt-2 text-[12.5px] text-[var(--ink-3)]">tCO₂e · {t("overview.locationBased")}</span>
          <ShareBar
            label={t("nav.ghg")}
            parts={[
              { value: ghg.scope1 / total, color: "var(--th-climate)", label: t("ghg.scope1") },
              { value: ghg.scope2Location / total, color: "var(--th-climate-2)", label: t("ghg.scope2loc") },
              { value: ghg.scope3 / total, color: "var(--th-climate-3)", label: t("ghg.scope3"), hatch: true },
            ]}
          />
          <div className="flex flex-col gap-1 text-[12.5px] text-[var(--ink-2)]">
            <LegendItem kind="swatch" color="var(--th-climate)" label={`${t("ghg.scope1")} · ${fmt.percent(ghg.scope1 / total, 0)}`} />
            <LegendItem kind="swatch" color="var(--th-climate-2)" label={`${t("ghg.scope2loc")} · ${fmt.percent(ghg.scope2Location / total, 0)}`} />
            <LegendItem kind="swatch" color="var(--th-climate-3)" label={`${t("ghg.scope3")} · ${fmt.percent(ghg.scope3 / total, 0)}`} />
          </div>
        </Tile>

        <Tile title={t("nav.journey")} href="/journey" className="md:col-span-6 xl:col-span-7" sources={["kgk_scope_decision", "ar_min_content", "cbam_guidance3"]}>
          <div className="flex flex-col gap-3.5">
            {(Object.keys(JOURNEYS) as Track[]).map((tr) => {
              const st = JOURNEYS[tr].map((s) => stageStatus(c, tr, s));
              const done = st.filter((s) => s.status === "done").length;
              return (
                <div key={tr} className="grid grid-cols-[minmax(0,150px)_minmax(0,1fr)_auto] items-center gap-3">
                  <span className="truncate text-[13.5px] font-medium">{t(`journey.tracks.${tr}`)}</span>
                  <div className="flex items-center">
                    {st.map((s, i) => (
                      <span key={i} className="flex flex-1 items-center last:flex-none">
                        <span
                          title={t(`journey.${tr}.${JOURNEYS[tr][i].id}.title`)}
                          className={cn(
                            "h-3.5 w-3.5 shrink-0 rounded-full border-2",
                            s.status === "done" && "border-[var(--b-600)] bg-[var(--b-600)]",
                            s.status === "doing" && "border-[var(--b-600)] bg-[var(--paper)]",
                            s.status === "todo" && "border-dashed border-[var(--b-300)] bg-transparent",
                          )}
                        />
                        {i < st.length - 1 && <span className={cn("h-[2px] flex-1", s.status === "done" ? "bg-[var(--b-500)]" : "bg-[var(--b-200)]")} />}
                      </span>
                    ))}
                  </div>
                  <span className="num text-[12.5px] text-[var(--ink-3)]">
                    {done}/{st.length}
                  </span>
                </div>
              );
            })}
          </div>
          <dl className="mt-1 grid gap-x-6 gap-y-2 border-t border-[var(--rule)] pt-3 sm:grid-cols-3">
            {(Object.keys(JOURNEYS) as Track[]).map((tr) => {
              const next = JOURNEYS[tr].find((s) => stageStatus(c, tr, s).status !== "done");
              return (
                <div key={tr} className="flex min-w-0 flex-col gap-0.5">
                  <dt className="text-[12px] text-[var(--ink-3)]">{t("overview.nextIn", { track: t(`journey.tracks.${tr}`) })}</dt>
                  <dd className="text-[13.5px] font-semibold text-[var(--accent-ink)]">{next ? t(`journey.${tr}.${next.id}.title`) : t("journey.st.done")}</dd>
                </div>
              );
            })}
          </dl>
        </Tile>

        <Tile title={t("nav.pathway")} href="/tools/pathway" family="climate" theme="climate" className="md:col-span-6 xl:col-span-7" sources={["sbti_criteria"]}>
          <LineChart
            height={230}
            label={t("pathway.chart")}
            x={path.map((r) => r.year)}
            yFormat={(v) => fmt.compact(v)}
            bands={[{ id: "b", label: t("pathway.band15"), lower: path.map(() => 0), upper: path.map((r) => r.target15), fill: "var(--th-nature-3)" }]}
            series={[
              { id: "plan", label: t("pathway.withMeasures"), values: path.map((r) => r.withMeasures), color: "var(--th-climate)", width: 2.5 },
              { id: "bau", label: t("pathway.bau"), values: path.map((r) => r.bau), color: "var(--ink-3)", dash: true, width: 1.5 },
            ]}
          />
        </Tile>

        <Tile title={t("overview.deadlines")} href="/regulations" className="md:col-span-6 xl:col-span-5" sources={["tr_ets_reg", "esrs_2026", "eudr"]}>
          <ul className="flex flex-col">
            {deadlines.map((d) => (
              <li key={d.id} className="flex items-baseline justify-between gap-4 border-b border-[var(--rule)] py-2 last:border-b-0">
                <span className={cn("text-[13.5px]", d.own ? "font-semibold" : "text-[var(--ink-2)]")}>{d.label}</span>
                <span className="num shrink-0 text-[13px] font-semibold text-[var(--accent-ink)]">{fmt.date(d.date)}</span>
              </li>
            ))}
          </ul>
        </Tile>

        {(
          [
            { id: "renewable", theme: "energy", href: "/tools/environment", fam: "environment", value: fmt.percent(env.renewableShare), sub: t("env.figRenewable"), bar: env.renewableShare, src: "gri_standards" },
            { id: "recovery", theme: "circularity", href: "/tools/environment", fam: "environment", value: fmt.percent(env.wasteRecoveryRate), sub: t("env.figRecovery"), bar: env.wasteRecoveryRate, src: "gri_standards" },
            { id: "taxonomy", theme: "nature", href: "/tools/taxonomy", fam: "environment", value: fmt.percent(tax.capex.aligned), sub: t("tax.alignedOf", { kpi: t("tax.capex") }), bar: tax.capex.aligned, src: "taxonomy_2026_73" },
            { id: "ltifr", theme: "people", href: "/tools/workforce", fam: "people", value: fmt.number(safety.ltifr, 2), sub: t("work.ltifrRow"), bar: Math.min(1, safety.ltifr / 5), src: "osha_rates" },
          ] satisfies { id: string; theme: ThemeId; href: string; fam: string; value: string; sub: string; bar: number; src: string }[]
        ).map((k) => (
          <Tile key={k.id} title={k.sub} href={k.href} family={k.fam} theme={k.theme} className="md:col-span-3 xl:col-span-3" sources={[k.src]}>
            <span className="figure-num text-[32px]" style={{ color: th(k.theme, "ink") }}>
              <CountUp text={k.value} />
            </span>
            <ShareBar label={k.sub} parts={[{ value: k.bar, color: th(k.theme), label: k.sub }]} />
          </Tile>
        ))}

        <ApprovalTile />
      </div>
    </div>
  );
}

const APPROVAL_MARK = { draft: "estimated", review: "review", approved: "verified", published: "verified" } as const;

/** Approval status of every tool section of the active client (workflow step 4). */
function ApprovalTile() {
  const { t, fmt, locale } = useI18n();
  const c = useActiveClient();
  const href = (id: string) => NAV.flatMap((g) => g.items).find((i) => i.id === id)?.href ?? "";
  return (
    <Tile title={t("appr.overview")} className="md:col-span-6 xl:col-span-12">
      <div className="overflow-x-auto">
        <table className="report-table text-[13.5px]">
          <thead>
            <tr>
              <th>{t("appr.section")}</th>
              <th>{t("appr.doc.status")}</th>
              <th>{t("appr.doc.preparedBy")}</th>
              <th>{t("appr.doc.approvedBy")}</th>
              <th>{t("appr.approvedAt")}</th>
            </tr>
          </thead>
          <tbody>
            {SECTION_IDS.map((id, i) => {
              const a = approvalOf(c.approvals, id);
              return (
                <tr key={id} className="anim-row" style={{ ["--i" as string]: i }}>
                  <td>
                    <Link href={`/${locale}${href(id)}`}>{t(`nav.${id}`)}</Link>
                  </td>
                  <td>
                    <StatusMark kind={APPROVAL_MARK[a.status]} label={t(`appr.status.${a.status}`)} />
                  </td>
                  <td>{a.preparedBy || "—"}</td>
                  <td>{a.approvedBy || "—"}</td>
                  <td className="num">{a.approvedAt ? fmt.date(localDay(a.approvedAt)) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[12.5px] text-[var(--ink-3)]">{t("appr.overviewCaption")}</p>
    </Tile>
  );
}
