"use client";

import { useMemo } from "react";
import { useI18n } from "@/i18n/provider";
import { etsCategory, inEts, lateReportFine, PILOT_SECTORS, projectEts, type PilotSector } from "@/lib/calc/ets";
import { FiguresRow, InputGroup, PageHeader, ToolLayout } from "@/components/shell";
import { Figure, LegendItem } from "@/components/figure";
import { StackedBars } from "@/components/charts";
import { Callout, NumberField, SelectField, StatusMark } from "@/components/ui";
import { Hydrated, KeyDates, NoteList, SectionTitle, ToolActions, useTool } from "./common";
import { eventDate } from "@/data/regulations";
import { ApprovalBar, useApproval } from "./approval";
import { SourceNotes } from "./source-notes";

const SOURCES = ["climate_law", "tr_ets_reg", "kpk_2026_1"];
const FROM = 2026;
const TO = 2030;

export function EtsTool() {
  return (
    <Hydrated>
      <Inner />
    </Hydrated>
  );
}

function Inner() {
  const { t, fmt } = useI18n();
  const { locked } = useApproval("ets");
  const [d, set, client] = useTool("ets");
  const rows = useMemo(() => projectEts(d, FROM, TO), [d]);
  const cat = etsCategory(d.emissions);
  const pilot = inEts(cat) && d.sector !== "other";
  const firstPriced = rows.find((r) => r.priced)!;
  const totalCost = rows.reduce((s, r) => s + r.cost, 0);
  const tl = (v: number) => (Math.abs(v) >= 1e6 ? `${fmt.number(v / 1e6, 1)} ${t("units.mTryShort")}` : fmt.currency(v, "TRY", 0));
  const meta = { sources: SOURCES, boundary: t("ets.boundary"), unit: "tCO₂e · TL", status: client.sample ? ("sample" as const) : undefined };

  return (
    <>
      <PageHeader
        family="climate"
        title={t("nav.ets")}
        result={
          !inEts(cat)
            ? t("ets.resultA")
            : t("ets.result", { cat, deficit: fmt.compact(firstPriced.deficit), cost: tl(firstPriced.cost), year: firstPriced.year })
        }
        actions={<ToolActions tool="ets" />}
      />
      <ApprovalBar section="ets" />
      <ToolLayout
        notes={<SourceNotes section="ets" />}
        locked={locked}
        family="climate"
        inputs={
          <>
            <InputGroup title={t("ets.installation")}>
              <SelectField<PilotSector>
                label={t("ets.sector")}
                value={d.sector}
                onChange={(v) => set({ ...d, sector: v })}
                options={[...PILOT_SECTORS, "other" as const].map((s) => ({ value: s, label: t(`sectors.${s}`) }))}
                hint={t("ets.sectorHint")}
              />
              <NumberField label={t("ets.emissions")} unit="tCO₂e" value={d.emissions} min={0} onChange={(v) => set({ ...d, emissions: v })} hint={t("ets.emissionsHint")} />
              <NumberField label={t("ets.emissionsGrowth")} percent value={d.emissionsGrowth} onChange={(v) => set({ ...d, emissionsGrowth: v })} />
            </InputGroup>
            <InputGroup title={t("ets.allocation")}>
              <NumberField label={t("ets.activity")} unit="t" value={d.activity} min={0} onChange={(v) => set({ ...d, activity: v })} />
              <NumberField label={t("ets.activityGrowth")} percent value={d.activityGrowth} onChange={(v) => set({ ...d, activityGrowth: v })} />
              <NumberField label={t("ets.benchmark")} unit="tCO₂e/t" value={d.benchmark} min={0} onChange={(v) => set({ ...d, benchmark: v })} hint={t("ets.benchmarkHint")} />
              <NumberField label={t("ets.coefficient")} value={d.coefficient} min={0} onChange={(v) => set({ ...d, coefficient: v })} />
              {[2026, 2027, 2028, 2029, 2030].map((y) => (
                <NumberField key={y} label={t("ets.rate", { year: y })} percent value={d.rateByYear[y] ?? 1} min={0} max={1} onChange={(v) => set({ ...d, rateByYear: { ...d.rateByYear, [y]: v } })} />
              ))}
            </InputGroup>
            <InputGroup title={t("ets.price")}>
              <NumberField label={t("ets.priceStart")} unit="TL/tCO₂e" value={d.price} min={0} onChange={(v) => set({ ...d, price: v })} hint={t("ets.priceHint")} />
              <NumberField label={t("ets.priceGrowth")} percent value={d.priceGrowth} onChange={(v) => set({ ...d, priceGrowth: v })} />
            </InputGroup>
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-x-8 gap-y-2 text-[14px]">
          <span>
            <span className="label mr-2">{t("ets.category")}</span>
            <span className="figure-num text-[28px]">{cat}</span>
          </span>
          <StatusMark kind={inEts(cat) ? "required" : "na"} label={inEts(cat) ? t("ets.inEts") : t("ets.mrvOnly")} />
          {pilot && <StatusMark kind="required" label={t("ets.inPilot")} />}
        </div>
        <FiguresRow
          pulseKey={Math.round(totalCost)}
          items={[
            { label: t("ets.figAllocation", { year: firstPriced.year }), value: fmt.compact(firstPriced.allocation) },
            { label: t("ets.figDeficit", { year: firstPriced.year }), value: fmt.compact(firstPriced.deficit), tone: firstPriced.deficit > 0 ? "fam" : "ok" },
            { label: t("ets.figCost", { from: FROM, to: TO }), value: tl(totalCost) },
            { label: t("ets.figFine"), value: tl(lateReportFine(d.emissions)), note: t("ets.figFineNote") },
          ]}
        />
        <Figure
          title={t("ets.chart")}
          caption={t("ets.chartCaption")}
          meta={meta}
          legend={
            <>
              <LegendItem kind="swatch" color="var(--th-climate-3)" label={t("ets.legendAllocation")} />
              <LegendItem kind="swatch" color="var(--th-climate)" label={t("ets.legendDeficit")} />
              <LegendItem color="var(--ink)" label={t("ets.legendEmissions")} />
            </>
          }
          csv={{ header: ["year", "emissions", "allocation", "deficit", "price_try", "cost_try"], rows: rows.map((r) => [r.year, Math.round(r.emissions), r.allocation, Math.round(r.deficit), Math.round(r.price), Math.round(r.cost)]) }}
          table={
            <table className="report-table text-[14px]">
              <thead>
                <tr>
                  <th>{t("common.year")}</th>
                  <th className="r">{t("ets.legendEmissions")}</th>
                  <th className="r">{t("ets.legendAllocation")}</th>
                  <th className="r">{t("ets.legendDeficit")}</th>
                  <th className="r">TL/t</th>
                  <th className="r">{t("ets.cost")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.year}>
                    <td className="num">
                      {r.year}
                      {!r.priced && <span className="ml-2 text-[12px] text-[var(--ink-3)]">{t("ets.reportingOnly")}</span>}
                    </td>
                    <td className="r num">{fmt.number(r.emissions)}</td>
                    <td className="r num">{fmt.number(r.allocation)}</td>
                    <td className="r num">{fmt.number(r.deficit)}</td>
                    <td className="r num">{fmt.number(r.price)}</td>
                    <td className="r num">{fmt.number(r.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          }
        >
          <StackedBars
            label={t("ets.chart")}
            categories={rows.map((r) => String(r.year))}
            yFormat={(v) => fmt.compact(v)}
            stacks={[
              { id: "alloc", label: t("ets.legendAllocation"), values: rows.map((r) => Math.min(r.allocation, r.emissions)), color: "var(--th-climate-3)" },
              { id: "def", label: t("ets.legendDeficit"), values: rows.map((r) => r.deficit), color: "var(--th-climate)" },
            ]}
            overlay={[{ id: "em", label: t("ets.legendEmissions"), values: rows.map((r) => r.emissions), color: "var(--ink)" }]}
          />
        </Figure>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="glass sheet flex min-w-0 flex-col gap-3 p-5 md:p-6">
            <SectionTitle>{t("common.keyDates")}</SectionTitle>
            <KeyDates
              dates={[
                { key: "ets_reg", date: "2026-08-27" },
                { key: "ets_monitoring_plan", date: eventDate("tr_ets_mp") },
                { key: "ets_price_start", date: "2027-01-01" },
                { key: "ets_report_2026", date: "2027-04-30" },
                { key: "ets_surrender_2027", date: "2028-11-30" },
                { key: "ets_permit", date: "2028-07-09" },
              ]}
            />
          </div>
          <div className="glass sheet flex min-w-0 flex-col gap-3 p-5 md:p-6">
            <SectionTitle>{t("common.notes")}</SectionTitle>
            <NoteList prefix="ets.notes" keys={["formula", "pilot", "penalty", "pilotDiscount", "cbamLink"]} />
          </div>
        </div>
        <Callout tone="warn">{t("ets.sampleWarning")}</Callout>
      </ToolLayout>
    </>
  );
}
