"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useI18n } from "@/i18n/provider";
import { buildPathway, maccCurve, measureEffect, RATE_15C, RATE_WB2C, requiredReduction, targetGap, type Measure } from "@/lib/calc/pathway";
import { FiguresRow, InputGroup, PageHeader, ToolLayout } from "@/components/shell";
import { Figure, LegendItem } from "@/components/figure";
import { LineChart, MaccChart } from "@/components/charts";
import { Button, NumberField, Tabs, TextField } from "@/components/ui";
import { Hydrated, NoteList, SectionTitle, ToolActions, useTool } from "./common";

const SOURCES = ["sbti_criteria", "sbti_v2", "ndc3"];
const PALETTE = ["var(--forest)", "var(--forest-2)", "var(--hydro)", "var(--hydro-2)", "var(--carbon-2)", "var(--carbon)", "var(--report-2)"];

export function PathwayTool() {
  return (
    <Hydrated>
      <Inner />
    </Hydrated>
  );
}

function Inner() {
  const { t, fmt } = useI18n();
  const [d, set, client] = useTool("pathway");
  const [tab, setTab] = useState<"base" | "measures" | "actuals">("base");
  const rows = useMemo(() => buildPathway(d, 2050), [d]);
  const x = rows.map((r) => r.year);
  const gap = targetGap(rows, d.targetYear);
  const target = rows.find((r) => r.year === d.targetYear);
  const macc = useMemo(() => maccCurve(d.measures), [d.measures]);
  const base = d.baseScope12 + d.baseScope3;
  const actualByYear = new Map(d.actuals.map((a) => [a.year, a]));
  const meta = { sources: SOURCES, boundary: t("pathway.boundary"), unit: "tCO₂e", status: client.sample ? ("sample" as const) : undefined };
  const setMeasure = (id: string, p: Partial<Measure>) => set({ ...d, measures: d.measures.map((m) => (m.id === id ? { ...m, ...p } : m)) });
  const abatementAtTarget = d.measures.reduce((s, m) => s + measureEffect(m, d.targetYear), 0);

  return (
    <>
      <PageHeader
        family="carbon"
        title={t("nav.pathway")}
        result={
          base === 0
            ? t("pathway.empty")
            : gap > 0
              ? t("pathway.resultGap", { year: d.targetYear, gap: fmt.compact(gap) })
              : t("pathway.resultOk", { year: d.targetYear, margin: fmt.compact(-gap) })
        }
        actions={<ToolActions tool="pathway" />}
      />
      <ToolLayout
        family="carbon"
        inputs={
          <>
            <Tabs
              label={t("pathway.inputs")}
              value={tab}
              onChange={setTab}
              items={[
                { value: "base", label: t("pathway.tabBase") },
                { value: "measures", label: t("pathway.tabMeasures") },
                { value: "actuals", label: t("pathway.tabActuals") },
              ]}
            />
            {tab === "base" && (
              <InputGroup title={t("pathway.baseYear")}>
                <NumberField label={t("pathway.baseYearLabel")} value={d.baseYear} min={2015} max={2030} onChange={(v) => set({ ...d, baseYear: Math.round(v) })} />
                <NumberField label={t("pathway.baseS12")} unit="tCO₂e" value={d.baseScope12} min={0} onChange={(v) => set({ ...d, baseScope12: v })} />
                <NumberField label={t("pathway.baseS3")} unit="tCO₂e" value={d.baseScope3} min={0} onChange={(v) => set({ ...d, baseScope3: v })} />
                <NumberField label={t("pathway.targetYear")} value={d.targetYear} min={d.baseYear + 1} max={2050} onChange={(v) => set({ ...d, targetYear: Math.round(v) })} hint={t("pathway.targetYearHint")} />
                <NumberField label={t("pathway.bau")} percent value={d.bauGrowth} onChange={(v) => set({ ...d, bauGrowth: v })} />
              </InputGroup>
            )}
            {tab === "measures" && (
              <>
                {d.measures.map((m) => (
                  <InputGroup key={m.id} title={m.name || t("pathway.measure")}>
                    <TextField label={t("pathway.measureName")} value={m.name} onChange={(v) => setMeasure(m.id, { name: v })} />
                    <div className="grid grid-cols-2 gap-4">
                      <NumberField label={t("pathway.abatement")} unit="t/yıl" value={m.abatement} min={0} onChange={(v) => setMeasure(m.id, { abatement: v })} />
                      <NumberField label={t("pathway.cost")} unit="€/t" value={m.cost} onChange={(v) => setMeasure(m.id, { cost: v })} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <NumberField label={t("pathway.start")} value={m.startYear} min={2024} max={2050} onChange={(v) => setMeasure(m.id, { startYear: Math.round(v) })} />
                      <NumberField label={t("pathway.ramp")} unit={t("units.years")} value={m.rampYears} min={1} max={15} onChange={(v) => setMeasure(m.id, { rampYears: Math.round(v) })} />
                    </div>
                    <Button variant="ghost" size="sm" className="self-start text-[var(--crit)]" onClick={() => set({ ...d, measures: d.measures.filter((x) => x.id !== m.id) })}>
                      <Trash2 size={14} aria-hidden /> {t("actions.remove")}
                    </Button>
                  </InputGroup>
                ))}
                <Button variant="quiet" onClick={() => set({ ...d, measures: [...d.measures, { id: `m-${Date.now().toString(36)}`, name: "", abatement: 0, cost: 0, startYear: 2027, rampYears: 2 }] })}>
                  <Plus size={15} aria-hidden /> {t("pathway.addMeasure")}
                </Button>
              </>
            )}
            {tab === "actuals" && (
              <InputGroup title={t("pathway.actuals")}>
                {Array.from({ length: 2026 - d.baseYear + 1 }, (_, i) => d.baseYear + i).map((y) => {
                  const a = actualByYear.get(y);
                  return (
                    <NumberField
                      key={y}
                      label={`${y}${a?.estimated ? ` · ${t("pathway.estimated")}` : ""}`}
                      unit="tCO₂e"
                      nullable
                      value={a?.value ?? NaN}
                      onChange={(v) => {
                        const others = d.actuals.filter((x) => x.year !== y);
                        set({ ...d, actuals: Number.isFinite(v) ? [...others, { year: y, value: v, estimated: y >= 2026 }].sort((p, q) => p.year - q.year) : others });
                      }}
                    />
                  );
                })}
              </InputGroup>
            )}
          </>
        }
      >
        <FiguresRow
          pulseKey={Math.round(gap)}
          items={[
            { label: t("pathway.figBase", { year: d.baseYear }), value: fmt.compact(base), trend: rows.filter((r) => r.year <= d.targetYear).map((r) => r.withMeasures), mark: 0 },
            { label: t("pathway.figTarget", { year: d.targetYear }), value: fmt.compact(target?.target15 ?? 0), trend: rows.filter((r) => r.year <= d.targetYear).map((r) => r.target15), mark: d.targetYear - d.baseYear, note: t("pathway.figTargetNote", { pct: fmt.percent(requiredReduction(d.baseYear, d.targetYear, RATE_15C), 0) }) },
            { label: t("pathway.figPlan", { year: d.targetYear }), value: fmt.compact(target?.withMeasures ?? 0), tone: gap > 0 ? "crit" : "ok", trend: rows.filter((r) => r.year <= d.targetYear).map((r) => r.withMeasures), mark: d.targetYear - d.baseYear },
            { label: t("pathway.figAbatement", { year: d.targetYear }), value: fmt.compact(abatementAtTarget), trend: rows.filter((r) => r.year <= d.targetYear).map((r) => r.abatement), mark: d.targetYear - d.baseYear },
          ]}
        />
        <Figure
          title={t("pathway.chart")}
          caption={t("pathway.chartCaption")}
          meta={meta}
          legend={
            <>
              <LegendItem kind="band" color="var(--forest-3)" label={t("pathway.band15")} />
              <LegendItem kind="band" color="var(--forest-wash)" label={t("pathway.bandWb2c")} />
              <LegendItem color="var(--ink-3)" dash label={t("pathway.bau")} />
              <LegendItem color="var(--carbon)" label={t("pathway.withMeasures")} />
              <LegendItem color="var(--forest)" dash label={t("pathway.netZero")} />
              <LegendItem color="var(--ink)" label={t("pathway.actualsLegend")} />
            </>
          }
          csv={{ header: ["year", "target_1_5c", "target_wb2c", "net_zero", "bau", "with_measures", "actual"], rows: rows.map((r) => [r.year, Math.round(r.target15), Math.round(r.targetWb2c), Math.round(r.netZero), Math.round(r.bau), Math.round(r.withMeasures), actualByYear.get(r.year)?.value ?? ""]) }}
          table={
            <table className="report-table text-[13.5px]">
              <thead>
                <tr>
                  <th>{t("common.year")}</th>
                  <th className="r">1,5 °C</th>
                  <th className="r">WB2C</th>
                  <th className="r">{t("pathway.netZero")}</th>
                  <th className="r">{t("pathway.bau")}</th>
                  <th className="r">{t("pathway.withMeasures")}</th>
                  <th className="r">{t("pathway.actualsLegend")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.filter((r) => r.year <= Math.max(d.targetYear, 2035) || r.year % 5 === 0).map((r) => (
                  <tr key={r.year}>
                    <td className="num">{r.year}</td>
                    <td className="r num">{fmt.number(r.target15)}</td>
                    <td className="r num">{fmt.number(r.targetWb2c)}</td>
                    <td className="r num">{fmt.number(r.netZero)}</td>
                    <td className="r num">{fmt.number(r.bau)}</td>
                    <td className="r num">{fmt.number(r.withMeasures)}</td>
                    <td className="r num">{actualByYear.has(r.year) ? fmt.number(actualByYear.get(r.year)!.value) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          }
        >
          <LineChart
            label={t("pathway.chart")}
            x={x}
            yFormat={(v) => fmt.compact(v)}
            bands={[
              { id: "wb", label: t("pathway.bandWb2c"), lower: rows.map((r) => r.target15), upper: rows.map((r) => r.targetWb2c), fill: "var(--forest-wash)" },
              { id: "b15", label: t("pathway.band15"), lower: rows.map((r) => r.netZero * 0), upper: rows.map((r) => r.target15), fill: "var(--forest-3)" },
            ]}
            markers={[
              { x: d.targetYear, label: t("pathway.markerTarget") },
              { x: 2027, label: "SBTi V2" },
            ]}
            series={[
              { id: "bau", label: t("pathway.bau"), values: rows.map((r) => r.bau), color: "var(--ink-3)", dash: true, width: 1.5 },
              { id: "nz", label: t("pathway.netZero"), values: rows.map((r) => r.netZero), color: "var(--forest)", dash: true, width: 1.5 },
              { id: "plan", label: t("pathway.withMeasures"), values: rows.map((r) => r.withMeasures), color: "var(--carbon)", width: 2.5 },
              {
                id: "act",
                label: t("pathway.actualsLegend"),
                values: rows.map((r) => actualByYear.get(r.year)?.value ?? null),
                color: "var(--ink)",
                width: 2.5,
              },
            ]}
          />
        </Figure>
        <Figure
          title={t("pathway.macc")}
          caption={t("pathway.maccCaption")}
          meta={{ ...meta, unit: "€/tCO₂e · tCO₂e/yıl" }}
          csv={{ header: ["measure", "cost_eur_per_t", "abatement_t_per_year", "start_year"], rows: macc.map((m) => [m.name, m.cost, m.abatement, m.startYear]) }}
          legend={macc.map((m, i) => (
            <LegendItem key={m.id} kind="swatch" color={PALETTE[i % PALETTE.length]} label={m.name} />
          ))}
          table={
            <table className="report-table text-[14px]">
              <thead>
                <tr>
                  <th>{t("pathway.measure")}</th>
                  <th className="r">€/tCO₂e</th>
                  <th className="r">tCO₂e/yıl</th>
                  <th className="r">{t("pathway.start")}</th>
                </tr>
              </thead>
              <tbody>
                {macc.map((m) => (
                  <tr key={m.id}>
                    <td>{m.name}</td>
                    <td className="r num">{fmt.number(m.cost, 1)}</td>
                    <td className="r num">{fmt.number(m.abatement)}</td>
                    <td className="r num">{m.startYear}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          }
        >
          <MaccChart
            label={t("pathway.macc")}
            segments={macc.map((m, i) => ({ id: m.id, name: m.name, x0: m.x0, x1: m.x1, cost: m.cost, color: PALETTE[i % PALETTE.length] }))}
            xFormat={(v) => fmt.compact(v)}
            yFormat={(v) => fmt.number(v, 0)}
            carbonPrice={80}
            carbonPriceLabel={t("pathway.carbonPriceRef")}
          />
        </Figure>
        <div className="glass flex min-w-0 flex-col gap-3 p-5 md:p-6">
          <SectionTitle>{t("common.notes")}</SectionTitle>
          <NoteList prefix="pathway.notes" keys={["rates", "netzero", "v2", "ndc", "macc"]} />
          <p className="text-[13px] text-[var(--ink-3)]">{t("pathway.rateLine", { r15: fmt.percent(RATE_15C), rwb: fmt.percent(RATE_WB2C) })}</p>
        </div>
      </ToolLayout>
    </>
  );
}
