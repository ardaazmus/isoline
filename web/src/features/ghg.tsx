"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useI18n } from "@/i18n/provider";
import {
  computeInventory,
  electricityLocation,
  electricityMarket,
  fuelEmissions,
  FUELS,
  GRID_FACTORS,
  GWP_AR6,
  refrigerantEmissions,
  scope3Emissions,
  SCOPE3_CATEGORIES,
  type FuelId,
  type Inventory,
  type Quality,
} from "@/lib/calc/ghg";
import { FiguresRow, InputGroup, PageHeader, ToolLayout } from "@/components/shell";
import { Figure } from "@/components/figure";
import { Waterfall } from "@/components/charts";
import { Button, NumberField, SelectField, StatusMark, Tabs, TextField } from "@/components/ui";
import { Hydrated, NoteList, SectionTitle, ToolActions, useTool } from "./common";

const SOURCES = ["ghg_protocol", "ipcc_2006", "ipcc_ar6_gwp", "etkb_ef_2023"];
const uid = () => Math.random().toString(36).slice(2, 9);

export function GhgTool() {
  return (
    <Hydrated>
      <Inner />
    </Hydrated>
  );
}

function QualitySelect({ value, onChange }: { value: Quality; onChange: (q: Quality) => void }) {
  const { t } = useI18n();
  return (
    <SelectField<Quality>
      label={t("ghg.quality")}
      value={value}
      onChange={onChange}
      options={(["measured", "calculated", "estimated"] as Quality[]).map((q) => ({ value: q, label: t(`ghg.q_${q}`) }))}
    />
  );
}

function Inner() {
  const { t, fmt } = useI18n();
  const [inv, set, client] = useTool("ghg");
  const [tab, setTab] = useState<"s1" | "s2" | "s3" | "norm">("s1");
  const r = useMemo(() => computeInventory(inv), [inv]);
  const n0 = (v: number) => fmt.number(v, 0);
  const patch = (p: Partial<Inventory>) => set({ ...inv, ...p });
  const meta = { sources: SOURCES, boundary: t("ghg.boundary"), unit: "tCO₂e", status: client.sample ? ("sample" as const) : undefined };

  const steps = [
    { id: "st", label: t("ghg.w_stationary"), value: r.scope1Stationary, color: "var(--carbon)" },
    { id: "mo", label: t("ghg.w_mobile"), value: r.scope1Mobile, color: "var(--carbon)" },
    { id: "pr", label: t("ghg.w_process"), value: r.scope1Process, color: "var(--carbon)" },
    { id: "fu", label: t("ghg.w_fugitive"), value: r.scope1Fugitive, color: "var(--carbon)", dash: true },
    { id: "s1", label: t("ghg.scope1"), value: r.scope1, color: "var(--ink)", total: true },
    { id: "s2", label: t("ghg.scope2loc"), value: r.scope2Location, color: "var(--carbon-2)" },
    { id: "s3", label: t("ghg.scope3"), value: r.scope3, color: "var(--carbon-3)", dash: true },
    { id: "tot", label: t("common.total"), value: r.totalLocation, color: "var(--ink)", total: true },
  ];

  const cats = SCOPE3_CATEGORIES.filter((c) => (r.scope3ByCategory[c] ?? 0) > 0);

  return (
    <>
      <PageHeader
        family="carbon"
        title={t("nav.ghg")}
        result={t("ghg.result", { total: fmt.compact(r.totalLocation), s12: fmt.compact(r.scope1 + r.scope2Location), est: fmt.percent(r.estimatedShare, 0) })}
        actions={<ToolActions tool="ghg" />}
      />
      <ToolLayout
        family="carbon"
        inputs={
          <>
            <Tabs
              label={t("ghg.inputs")}
              value={tab}
              onChange={setTab}
              items={[
                { value: "s1", label: t("ghg.tabS1") },
                { value: "s2", label: t("ghg.tabS2") },
                { value: "s3", label: t("ghg.tabS3") },
                { value: "norm", label: t("ghg.tabNorm") },
              ]}
            />
            {tab === "s1" && (
              <>
                {inv.fuels.map((f, i) => (
                  <InputGroup key={f.id} title={`${t("ghg.fuel")} ${i + 1} · ${fmt.number(fuelEmissions(f))} tCO₂`}>
                    <TextField label={t("ghg.label")} value={f.label} onChange={(v) => patch({ fuels: inv.fuels.map((x) => (x.id === f.id ? { ...x, label: v } : x)) })} />
                    <div className="grid grid-cols-2 gap-4">
                      <SelectField<FuelId>
                        label={t("ghg.fuelType")}
                        value={f.fuel}
                        onChange={(v) => patch({ fuels: inv.fuels.map((x) => (x.id === f.id ? { ...x, fuel: v, ncv: FUELS[v].ncv, ef: FUELS[v].ef } : x)) })}
                        options={Object.keys(FUELS).map((k) => ({ value: k as FuelId, label: t(`ghg.fuels.${k}`) }))}
                      />
                      <NumberField label={t("ghg.amount")} unit={FUELS[f.fuel].unit} value={f.amount} min={0} onChange={(v) => patch({ fuels: inv.fuels.map((x) => (x.id === f.id ? { ...x, amount: v } : x)) })} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <NumberField label={t("ghg.ncv")} unit={`GJ/${FUELS[f.fuel].unit}`} value={f.ncv} min={0} onChange={(v) => patch({ fuels: inv.fuels.map((x) => (x.id === f.id ? { ...x, ncv: v } : x)) })} />
                      <NumberField label={t("ghg.ef")} unit="tCO₂/TJ" value={f.ef} min={0} onChange={(v) => patch({ fuels: inv.fuels.map((x) => (x.id === f.id ? { ...x, ef: v } : x)) })} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <SelectField<"0" | "1"> label={t("ghg.use")} value={f.mobile ? "1" : "0"} onChange={(v) => patch({ fuels: inv.fuels.map((x) => (x.id === f.id ? { ...x, mobile: v === "1" } : x)) })} options={[{ value: "0", label: t("ghg.stationary") }, { value: "1", label: t("ghg.mobile") }]} />
                      <QualitySelect value={f.quality} onChange={(q) => patch({ fuels: inv.fuels.map((x) => (x.id === f.id ? { ...x, quality: q } : x)) })} />
                    </div>
                    <Button variant="ghost" size="sm" className="self-start text-[var(--crit)]" onClick={() => patch({ fuels: inv.fuels.filter((x) => x.id !== f.id) })}>
                      <Trash2 size={14} aria-hidden /> {t("actions.remove")}
                    </Button>
                  </InputGroup>
                ))}
                <Button variant="quiet" onClick={() => patch({ fuels: [...inv.fuels, { id: uid(), fuel: "natural_gas", label: t("ghg.fuels.natural_gas"), amount: 0, ncv: FUELS.natural_gas.ncv, ef: FUELS.natural_gas.ef, mobile: false, quality: "measured" }] })}>
                  <Plus size={15} aria-hidden /> {t("ghg.addFuel")}
                </Button>
                {inv.process.map((p) => (
                  <InputGroup key={p.id} title={t("ghg.process")}>
                    <TextField label={t("ghg.label")} value={p.label} onChange={(v) => patch({ process: inv.process.map((x) => (x.id === p.id ? { ...x, label: v } : x)) })} />
                    <NumberField label={t("ghg.processEmissions")} unit="tCO₂e" value={p.tco2e} min={0} onChange={(v) => patch({ process: inv.process.map((x) => (x.id === p.id ? { ...x, tco2e: v } : x)) })} />
                  </InputGroup>
                ))}
                {inv.refrigerants.map((g) => (
                  <InputGroup key={g.id} title={`${t("ghg.refrigerant")} · ${fmt.number(refrigerantEmissions(g), 1)} tCO₂e`}>
                    <div className="grid grid-cols-2 gap-4">
                      <SelectField label={t("ghg.gas")} value={g.gas} onChange={(v) => patch({ refrigerants: inv.refrigerants.map((x) => (x.id === g.id ? { ...x, gas: v } : x)) })} options={Object.keys(GWP_AR6).map((k) => ({ value: k, label: `${k} (GWP ${fmt.number(GWP_AR6[k])})` }))} />
                      <NumberField label={t("ghg.leaked")} unit="kg" value={g.leakedKg} min={0} onChange={(v) => patch({ refrigerants: inv.refrigerants.map((x) => (x.id === g.id ? { ...x, leakedKg: v } : x)) })} />
                    </div>
                  </InputGroup>
                ))}
                <div className="flex flex-wrap gap-2">
                  <Button variant="ghost" size="sm" onClick={() => patch({ process: [...inv.process, { id: uid(), label: t("ghg.process"), tco2e: 0, quality: "calculated" }] })}>
                    <Plus size={14} aria-hidden /> {t("ghg.addProcess")}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => patch({ refrigerants: [...inv.refrigerants, { id: uid(), gas: "R-410A", leakedKg: 0, quality: "estimated" }] })}>
                    <Plus size={14} aria-hidden /> {t("ghg.addRefrigerant")}
                  </Button>
                </div>
              </>
            )}
            {tab === "s2" && (
              <>
                {inv.electricity.map((e) => (
                  <InputGroup key={e.id} title={`${e.label || t("ghg.electricity")}`}>
                    <TextField label={t("ghg.label")} value={e.label} onChange={(v) => patch({ electricity: inv.electricity.map((x) => (x.id === e.id ? { ...x, label: v } : x)) })} />
                    <div className="grid grid-cols-2 gap-4">
                      <NumberField label={t("ghg.mwh")} unit="MWh" value={e.mwh} min={0} onChange={(v) => patch({ electricity: inv.electricity.map((x) => (x.id === e.id ? { ...x, mwh: v } : x)) })} />
                      <SelectField<"transmission" | "distribution">
                        label={t("ghg.connection")}
                        value={e.connection}
                        onChange={(v) => patch({ electricity: inv.electricity.map((x) => (x.id === e.id ? { ...x, connection: v } : x)) })}
                        options={[
                          { value: "transmission", label: `${t("ghg.transmission")} · ${GRID_FACTORS.transmission}` },
                          { value: "distribution", label: `${t("ghg.distribution")} · ${GRID_FACTORS.distribution}` },
                        ]}
                      />
                    </div>
                    <NumberField label={t("ghg.certified")} unit="MWh" hint={t("ghg.certifiedHint")} value={e.certifiedMwh} min={0} onChange={(v) => patch({ electricity: inv.electricity.map((x) => (x.id === e.id ? { ...x, certifiedMwh: v } : x)) })} />
                    <NumberField
                      label={t("ghg.supplierFactor")}
                      unit="tCO₂e/MWh"
                      hint={t("ghg.supplierFactorHint")}
                      nullable
                      value={e.supplierFactor ?? NaN}
                      onChange={(v) => patch({ electricity: inv.electricity.map((x) => (x.id === e.id ? { ...x, supplierFactor: Number.isFinite(v) ? v : null } : x)) })}
                    />
                  </InputGroup>
                ))}
                <Button variant="quiet" onClick={() => patch({ electricity: [...inv.electricity, { id: uid(), label: "", mwh: 0, connection: "distribution", certifiedMwh: 0, supplierFactor: null, quality: "measured" }] })}>
                  <Plus size={15} aria-hidden /> {t("ghg.addElectricity")}
                </Button>
              </>
            )}
            {tab === "s3" && (
              <>
                {inv.scope3.map((l) => (
                  <InputGroup key={l.id} title={`${t("ghg.category")} ${l.category} · ${fmt.number(scope3Emissions(l))} tCO₂e`}>
                    <SelectField<string> label={t("ghg.category")} value={String(l.category)} onChange={(v) => patch({ scope3: inv.scope3.map((x) => (x.id === l.id ? { ...x, category: Number(v) } : x)) })} options={SCOPE3_CATEGORIES.map((c) => ({ value: String(c), label: `${c}. ${t(`ghg.cat.${c}`)}` }))} />
                    <TextField label={t("ghg.label")} value={l.label} onChange={(v) => patch({ scope3: inv.scope3.map((x) => (x.id === l.id ? { ...x, label: v } : x)) })} />
                    <div className="grid grid-cols-2 gap-4">
                      <NumberField label={t("ghg.amount")} unit={l.unit} value={l.amount} min={0} onChange={(v) => patch({ scope3: inv.scope3.map((x) => (x.id === l.id ? { ...x, amount: v } : x)) })} />
                      <TextField label={t("ghg.unit")} value={l.unit} onChange={(v) => patch({ scope3: inv.scope3.map((x) => (x.id === l.id ? { ...x, unit: v } : x)) })} />
                    </div>
                    <NumberField label={t("ghg.factor")} unit={`tCO₂e/${l.unit}`} value={l.factor} min={0} onChange={(v) => patch({ scope3: inv.scope3.map((x) => (x.id === l.id ? { ...x, factor: v } : x)) })} />
                    <TextField label={t("ghg.factorSource")} value={l.factorSource} onChange={(v) => patch({ scope3: inv.scope3.map((x) => (x.id === l.id ? { ...x, factorSource: v } : x)) })} />
                    <QualitySelect value={l.quality} onChange={(q) => patch({ scope3: inv.scope3.map((x) => (x.id === l.id ? { ...x, quality: q } : x)) })} />
                    <Button variant="ghost" size="sm" className="self-start text-[var(--crit)]" onClick={() => patch({ scope3: inv.scope3.filter((x) => x.id !== l.id) })}>
                      <Trash2 size={14} aria-hidden /> {t("actions.remove")}
                    </Button>
                  </InputGroup>
                ))}
                <Button variant="quiet" onClick={() => patch({ scope3: [...inv.scope3, { id: uid(), category: 1, label: "", amount: 0, unit: "t", factor: 0, factorSource: "", quality: "estimated" }] })}>
                  <Plus size={15} aria-hidden /> {t("ghg.addScope3")}
                </Button>
              </>
            )}
            {tab === "norm" && (
              <InputGroup title={t("ghg.normalisers")}>
                <NumberField label={t("ghg.revenue")} unit={t("units.mTry")} value={inv.revenueMillionTry} min={0} onChange={(v) => patch({ revenueMillionTry: v })} />
                <NumberField label={t("ghg.production")} unit="t" value={inv.productionTonnes} min={0} onChange={(v) => patch({ productionTonnes: v })} />
              </InputGroup>
            )}
          </>
        }
      >
        <FiguresRow
          pulseKey={Math.round(r.totalLocation)}
          items={[
            { label: t("ghg.scope1"), value: fmt.compact(r.scope1), tone: "fam" },
            { label: t("ghg.scope2loc"), value: fmt.compact(r.scope2Location), note: `${t("ghg.scope2mkt")}: ${fmt.compact(r.scope2Market)}` },
            { label: t("ghg.scope3"), value: fmt.compact(r.scope3) },
            { label: t("ghg.intensity"), value: fmt.number(r.intensityProduct, 2), note: t("ghg.intensityNote", { rev: fmt.number(r.intensityRevenue, 1) }) },
          ]}
        />
        <Figure
          title={t("ghg.chartWaterfall")}
          caption={t("ghg.chartWaterfallCaption")}
          meta={meta}
          csv={{ header: ["item", "tco2e"], rows: steps.map((s) => [s.label, Math.round(s.value)]) }}
          table={
            <table className="report-table text-[14px]">
              <thead>
                <tr>
                  <th>{t("ghg.item")}</th>
                  <th className="r">tCO₂e</th>
                  <th className="r">{t("ghg.share")}</th>
                </tr>
              </thead>
              <tbody>
                {steps.map((s) => (
                  <tr key={s.id}>
                    <td className={s.total ? "font-semibold" : ""}>{s.label}</td>
                    <td className="r num">{n0(s.value)}</td>
                    <td className="r num">{fmt.percent(r.totalLocation ? s.value / r.totalLocation : 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          }
        >
          <Waterfall label={t("ghg.chartWaterfall")} steps={steps} yFormat={(v) => fmt.compact(v)} />
        </Figure>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="glass flex min-w-0 flex-col gap-3 p-5 md:p-6">
            <SectionTitle>{t("ghg.scope2compare")}</SectionTitle>
            <table className="report-table text-[14px]">
              <thead>
                <tr>
                  <th>{t("ghg.label")}</th>
                  <th className="r">MWh</th>
                  <th className="r">{t("ghg.location")}</th>
                  <th className="r">{t("ghg.market")}</th>
                </tr>
              </thead>
              <tbody>
                {inv.electricity.map((e) => (
                  <tr key={e.id}>
                    <td>{e.label || t("ghg.electricity")}</td>
                    <td className="r num">{n0(e.mwh)}</td>
                    <td className="r num">{n0(electricityLocation(e))}</td>
                    <td className="r num">{n0(electricityMarket(e))}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>{t("common.total")}</td>
                  <td className="r num">{n0(r.electricityMwh)}</td>
                  <td className="r num">{n0(r.scope2Location)}</td>
                  <td className="r num">{n0(r.scope2Market)}</td>
                </tr>
              </tfoot>
            </table>
            <p className="text-[13px] text-[var(--ink-3)]">{t("ghg.renewableShare", { share: fmt.percent(r.renewableShare) })}</p>
          </div>
          <div className="glass flex min-w-0 flex-col gap-3 p-5 md:p-6">
            <SectionTitle>{t("ghg.scope3byCat")}</SectionTitle>
            <table className="report-table text-[14px]">
              <thead>
                <tr>
                  <th>{t("ghg.category")}</th>
                  <th className="r">tCO₂e</th>
                  <th>{t("ghg.quality")}</th>
                </tr>
              </thead>
              <tbody>
                {cats.map((c) => {
                  const lines = inv.scope3.filter((l) => l.category === c);
                  const est = lines.some((l) => l.quality === "estimated");
                  return (
                    <tr key={c}>
                      <td>
                        {c}. {t(`ghg.cat.${c}`)}
                      </td>
                      <td className="r num">{n0(r.scope3ByCategory[c])}</td>
                      <td>
                        <StatusMark kind={est ? "estimated" : "verified"} label={est ? t("ghg.q_estimated") : t("ghg.q_calculated")} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <div className="glass flex min-w-0 flex-col gap-3 p-5 md:p-6">
          <SectionTitle>{t("common.notes")}</SectionTitle>
          <NoteList prefix="ghg.notes" keys={["factors", "grid", "market", "scope3", "gwp", "tsrs"]} />
        </div>
      </ToolLayout>
    </>
  );
}
