"use client";

import { useMemo } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useI18n } from "@/i18n/provider";
import { CBAM_PRICES_2026, CBAM_SECTORS, cbamFactor, countsIndirect, projectPortfolio, projectProduct, type CbamProduct, type CbamSector } from "@/lib/calc/cbam";
import { FiguresRow, InputGroup, PageHeader, ToolLayout } from "@/components/shell";
import { Figure, LegendItem } from "@/components/figure";
import { StackedBars } from "@/components/charts";
import { Button, Callout, NumberField, SelectField, TextField, Toggle } from "@/components/ui";
import { Hydrated, KeyDates, NoteList, SectionTitle, ToolActions, useTool } from "./common";

const SOURCES = ["cbam_reg", "cbam_factor", "cbam_guidance3", "cbam_price", "cbam_faa"];

export function CbamTool() {
  return (
    <Hydrated>
      <Inner />
    </Hydrated>
  );
}

function Inner() {
  const { t, fmt } = useI18n();
  const [data, set, client] = useTool("cbam");
  const rows = useMemo(() => projectPortfolio(data.products, data.scenario), [data]);
  const y2030 = rows.find((r) => r.year === 2030)!;
  const cumulative = rows.reduce((s, r) => s + r.cost, 0);
  const cumDefault = rows.reduce((s, r) => s + r.costDefault, 0);
  const cumActual = rows.reduce((s, r) => s + r.costActual, 0);
  const eur = (v: number) => fmt.currency(v, "EUR", 0);
  const eurC = (v: number) => (Math.abs(v) >= 1e6 ? `€${fmt.number(v / 1e6, 1)} m` : eur(v));
  const tco2 = (v: number) => fmt.compact(v);
  const years = rows.map((r) => String(r.year));

  const setProduct = (id: string, patch: Partial<CbamProduct>) => set({ ...data, products: data.products.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
  const addProduct = () =>
    set({
      ...data,
      products: [
        ...data.products,
        { id: `p-${Date.now().toString(36)}`, name: t("cbam.newProduct"), cn: "", sector: "iron_steel", tonnes: 0, growth: 0, seeDirect: 0, seeIndirect: 0, defaultSee: 0, useDefault: true, benchmark: 0 },
      ],
    });

  const meta = { sources: SOURCES, boundary: t("cbam.boundary"), unit: "€ · tCO₂e", status: client.sample ? ("sample" as const) : undefined };

  return (
    <>
      <PageHeader
        family="carbon"
        title={t("nav.cbam")}
        result={data.products.length ? t("cbam.result", { cost: eurC(y2030.cost), total: eurC(cumulative) }) : t("cbam.empty")}
        actions={<ToolActions tool="cbam" />}
      />
      <ToolLayout
        family="carbon"
        inputs={
          <>
            <InputGroup title={t("cbam.scenario")}>
              <NumberField label={t("cbam.startPrice")} unit="€/tCO₂e" value={data.scenario.startPrice} onChange={(v) => set({ ...data, scenario: { ...data.scenario, startPrice: v } })} hint={t("cbam.startPriceHint", { q1: CBAM_PRICES_2026[0].price, q2: CBAM_PRICES_2026[1].price, q3: CBAM_PRICES_2026[2].price })} min={0} />
              <NumberField label={t("cbam.priceGrowth")} percent value={data.scenario.priceGrowth} onChange={(v) => set({ ...data, scenario: { ...data.scenario, priceGrowth: v } })} />
              <NumberField label={t("cbam.originPrice")} unit="€/tCO₂e" value={data.scenario.originCarbonPrice} onChange={(v) => set({ ...data, scenario: { ...data.scenario, originCarbonPrice: v } })} hint={t("cbam.originPriceHint")} min={0} />
              <NumberField label={t("cbam.eurTry")} unit="TRY/€" value={data.scenario.eurTry} onChange={(v) => set({ ...data, scenario: { ...data.scenario, eurTry: v } })} min={0} />
            </InputGroup>
            {data.products.map((p, i) => (
              <InputGroup key={p.id} title={`${t("cbam.product")} ${i + 1}`}>
                <TextField label={t("cbam.productName")} value={p.name} onChange={(v) => setProduct(p.id, { name: v })} />
                <div className="grid grid-cols-2 gap-4">
                  <TextField label={t("cbam.cn")} value={p.cn} onChange={(v) => setProduct(p.id, { cn: v })} />
                  <SelectField<CbamSector> label={t("cbam.sector")} value={p.sector} onChange={(v) => setProduct(p.id, { sector: v })} options={CBAM_SECTORS.map((s) => ({ value: s, label: t(`sectors.${s}`) }))} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <NumberField label={t("cbam.tonnes")} unit="t" value={p.tonnes} onChange={(v) => setProduct(p.id, { tonnes: v })} min={0} />
                  <NumberField label={t("cbam.growth")} percent value={p.growth} onChange={(v) => setProduct(p.id, { growth: v })} />
                </div>
                <Toggle label={t("cbam.useDefault")} hint={t("cbam.useDefaultHint")} checked={p.useDefault} onChange={(v) => setProduct(p.id, { useDefault: v })} />
                <div className="grid grid-cols-2 gap-4">
                  <NumberField label={t("cbam.seeDirect")} unit="t/t" value={p.seeDirect} onChange={(v) => setProduct(p.id, { seeDirect: v })} min={0} />
                  {countsIndirect(p.sector) ? (
                    <NumberField label={t("cbam.seeIndirect")} unit="t/t" value={p.seeIndirect} onChange={(v) => setProduct(p.id, { seeIndirect: v })} min={0} />
                  ) : (
                    <p className="self-end pb-1 text-[12px] text-[var(--ink-3)]">{t("cbam.noIndirect")}</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <NumberField label={t("cbam.defaultSee")} unit="t/t" value={p.defaultSee} onChange={(v) => setProduct(p.id, { defaultSee: v })} min={0} />
                  <NumberField label={t("cbam.benchmark")} unit="t/t" value={p.benchmark} onChange={(v) => setProduct(p.id, { benchmark: v })} min={0} />
                </div>
                <Button variant="ghost" size="sm" className="self-start text-[var(--crit)]" onClick={() => set({ ...data, products: data.products.filter((x) => x.id !== p.id) })}>
                  <Trash2 size={14} aria-hidden />
                  {t("actions.remove")}
                </Button>
              </InputGroup>
            ))}
            <Button variant="quiet" onClick={addProduct}>
              <Plus size={15} aria-hidden />
              {t("cbam.addProduct")}
            </Button>
          </>
        }
      >
        <FiguresRow
          pulseKey={Math.round(y2030.cost)}
          items={[
            { label: t("cbam.fig2026"), value: eurC(rows[0].cost), trend: rows.map((r) => r.cost), mark: 0 },
            { label: t("cbam.fig2030"), value: eurC(y2030.cost), tone: "fam", trend: rows.map((r) => r.cost), mark: 4 },
            { label: t("cbam.figTotal"), value: eurC(cumulative), trend: rows.map((_, i) => rows.slice(0, i + 1).reduce((a, r) => a + r.cost, 0)), mark: rows.length - 1 },
            { label: t("cbam.figSaving"), value: eurC(Math.max(0, cumDefault - cumActual)), note: t("cbam.figSavingNote"), tone: "ok", trend: rows.map((r) => r.costDefault - r.costActual) },
          ]}
        />

        <Figure
          title={t("cbam.chartCost")}
          caption={t("cbam.chartCostCaption")}
          meta={meta}
          legend={
            <>
              <LegendItem kind="swatch" color="var(--carbon)" label={t("cbam.legendCost")} />
              <LegendItem color="var(--ink)" dash label={t("cbam.legendDefault")} />
              <LegendItem color="var(--forest)" label={t("cbam.legendActual")} />
            </>
          }
          csv={{
            header: ["year", "tonnes", "gross_tco2e", "faa_tco2e", "deduction_tco2e", "certificates", "price_eur", "cost_eur", "cost_try"],
            rows: rows.map((r) => [r.year, Math.round(r.tonnes), Math.round(r.gross), Math.round(r.faa), Math.round(r.deduction), Math.round(r.certificates), r.price.toFixed(2), Math.round(r.cost), Math.round(r.cost * data.scenario.eurTry)]),
          }}
          table={<CbamTable rows={rows} eurTry={data.scenario.eurTry} />}
        >
          <StackedBars
            label={t("cbam.chartCost")}
            categories={years}
            yFormat={(v) => (v >= 1e6 ? `${fmt.number(v / 1e6, 1)} m` : fmt.compact(v))}
            stacks={[{ id: "cost", label: t("cbam.legendCost"), values: rows.map((r) => r.cost), color: "var(--carbon)" }]}
            overlay={[
              { id: "def", label: t("cbam.legendDefault"), values: rows.map((r) => r.costDefault), color: "var(--ink)", dash: true },
              { id: "act", label: t("cbam.legendActual"), values: rows.map((r) => r.costActual), color: "var(--forest)" },
            ]}
          />
        </Figure>

        <Figure
          title={t("cbam.chartEmissions")}
          caption={t("cbam.chartEmissionsCaption")}
          meta={meta}
          legend={
            <>
              <LegendItem kind="swatch" color="var(--carbon)" label={t("cbam.legendCertificates")} />
              <LegendItem kind="swatch" color="var(--carbon-3)" label={t("cbam.legendFaa")} />
              <LegendItem kind="swatch" color="var(--ink-3)" label={t("cbam.legendDeduction")} />
            </>
          }
          table={<CbamTable rows={rows} eurTry={data.scenario.eurTry} />}
        >
          <StackedBars
            label={t("cbam.chartEmissions")}
            categories={years}
            yFormat={tco2}
            stacks={[
              { id: "cert", label: t("cbam.legendCertificates"), values: rows.map((r) => r.certificates), color: "var(--carbon)" },
              { id: "ded", label: t("cbam.legendDeduction"), values: rows.map((r) => r.deduction), color: "var(--ink-3)", hatch: true },
              { id: "faa", label: t("cbam.legendFaa"), values: rows.map((r) => r.faa), color: "var(--carbon-3)" },
            ]}
          />
        </Figure>

        <div className="grid gap-6 2xl:grid-cols-2">
          <div className="glass flex min-w-0 flex-col gap-3 p-5 md:p-6">
            <SectionTitle>{t("cbam.byProduct")}</SectionTitle>
            <div className="overflow-x-auto">
              <table className="report-table text-[14px]">
                <thead>
                  <tr>
                    <th>{t("cbam.product")}</th>
                    <th className="r">{t("cbam.seeUsed")}</th>
                    <th className="r">€/t 2030</th>
                    <th className="r">€/t 2034</th>
                  </tr>
                </thead>
                <tbody>
                  {data.products.map((p) => {
                    const pr = projectProduct(p, data.scenario);
                    return (
                      <tr key={p.id}>
                        <td>
                          {p.name}
                          <span className="block text-[12px] text-[var(--ink-3)]">
                            KN {p.cn || "—"} · {p.useDefault ? t("cbam.defaultValues") : t("cbam.verifiedValues")}
                          </span>
                        </td>
                        <td className="r num">{fmt.number(pr[0].see, 2)}</td>
                        <td className="r num">{fmt.number(pr.find((r) => r.year === 2030)!.costPerTonne, 1)}</td>
                        <td className="r num">{fmt.number(pr.at(-1)!.costPerTonne, 1)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <div className="glass flex min-w-0 flex-col gap-3 p-5 md:p-6">
            <SectionTitle>{t("common.keyDates")}</SectionTitle>
            <KeyDates
              dates={[
                { key: "cbam_definitive", date: "2026-01-01" },
                { key: "cbam_cert_sales", date: "2027-02-01" },
                { key: "cbam_first_declaration", date: "2027-09-30" },
                { key: "cbam_repurchase", date: "2027-10-31" },
                { key: "cbam_downstream", date: "2028-01-01" },
              ]}
            />
          </div>
        </div>

        <div className="glass flex min-w-0 flex-col gap-3 p-5 md:p-6">
          <SectionTitle>{t("common.notes")}</SectionTitle>
          <NoteList prefix="cbam.notes" keys={["deMinimis", "indirect", "markup", "deduction", "holding", "penalty", "csCf"]} />
          <Callout tone="warn">{t("cbam.sampleWarning")}</Callout>
        </div>
      </ToolLayout>
    </>
  );
}

function CbamTable({ rows, eurTry }: { rows: ReturnType<typeof projectPortfolio>; eurTry: number }) {
  const { t, fmt } = useI18n();
  return (
    <table className="report-table text-[13.5px]">
      <thead>
        <tr>
          <th>{t("common.year")}</th>
          <th className="r">{t("cbam.colShare")}</th>
          <th className="r">{t("cbam.colTonnes")}</th>
          <th className="r">{t("cbam.colGross")}</th>
          <th className="r">{t("cbam.colFaa")}</th>
          <th className="r">{t("cbam.colCertificates")}</th>
          <th className="r">€/tCO₂e</th>
          <th className="r">{t("cbam.colCost")}</th>
          <th className="r">{t("cbam.colCostTry")}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.year}>
            <td className="num">{r.year}</td>
            <td className="r num">{fmt.percent(1 - cbamFactor(r.year))}</td>
            <td className="r num">{fmt.number(r.tonnes)}</td>
            <td className="r num">{fmt.number(r.gross)}</td>
            <td className="r num">{fmt.number(r.faa)}</td>
            <td className="r num">{fmt.number(r.certificates)}</td>
            <td className="r num">{fmt.number(r.price, 2)}</td>
            <td className="r num">{fmt.number(r.cost)}</td>
            <td className="r num">{fmt.number(r.cost * eurTry)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <td colSpan={7}>{t("common.total")}</td>
          <td className="r num">{fmt.number(rows.reduce((s, r) => s + r.cost, 0))}</td>
          <td className="r num">{fmt.number(rows.reduce((s, r) => s + r.cost, 0) * eurTry)}</td>
        </tr>
      </tfoot>
    </table>
  );
}
