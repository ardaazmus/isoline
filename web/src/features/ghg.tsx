"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useI18n } from "@/i18n/provider";
import {
  computeInventory,
  defaultNonCo2,
  electricityLocation,
  electricityMarket,
  fuelEmissions,
  FUELS,
  GRID_FACTORS,
  GWP_AR6,
  GWP_AR6_COMBUSTION,
  nonCo2Of,
  refrigerantEmissions,
  scope3Emissions,
  SCOPE3_CATEGORIES,
  type FuelId,
  type FuelLine,
  type Inventory,
  type Quality,
} from "@/lib/calc/ghg";
import { FiguresRow, InputGroup, PageHeader, ToolLayout } from "@/components/shell";
import { Figure } from "@/components/figure";
import { Waterfall } from "@/components/charts";
import { Button, NumberField, SelectField, StatusMark, Tabs, TextField } from "@/components/ui";
import { INVENTORY_TEMPLATE_ROWS, inventoryTemplateCsv, type ImportResult } from "@/lib/inventory-csv";
import { importInventoryFile, lastImport, logImport, type FileRead } from "@/lib/imports";
import { xlsxWorkbook, XLSX_MIME } from "@/lib/spreadsheet";
import { FileImport, ImportPreview, IssueList } from "@/components/file-import";
import { FactorYear, useEditionName } from "./factor-year";
import { gridEdition } from "@/lib/recalc";
import { useActiveClient, useWorkspace } from "@/store/workspace";
import { InlineBar, ThemeIcon } from "@/components/data";
import { th } from "@/data/themes";
import { Hydrated, NoteList, SectionTitle, ToolActions, useTool } from "./common";
import { FactorPicker, useFactorSets } from "@/components/factor-picker";
import { factorRef } from "@/lib/factors";
import { ApprovalBar, useApproval } from "./approval";
import { SourceNotes } from "./source-notes";

const SOURCES = ["ghg_protocol", "ipcc_2006", "ipcc_ar6_gwp", "etkb_ef_2023"];

/** The IPCC 2006 table a line's default CH₄ and N₂O come from (see NON_CO2_STATIONARY / NON_CO2_MOBILE). */
function nonCo2Source(fuel: FuelId, mobile: boolean): "stationary" | "road" | "ship" | "rail" {
  if (!mobile || fuel === "lignite") return "stationary";
  if (fuel === "fuel_oil") return "ship";
  if (fuel === "coal") return "rail";
  return "road";
}
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
  const { locked } = useApproval("ghg");
  const [inv, set, client] = useTool("ghg");
  const sets = useFactorSets();
  const [tab, setTab] = useState<"s1" | "s2" | "s3" | "norm">("s1");
  const r = useMemo(() => computeInventory(inv), [inv]);
  const n0 = (v: number) => fmt.number(v, 0);
  const patch = (p: Partial<Inventory>) => set({ ...inv, ...p });
  const patchFuel = (id: string, p: Partial<FuelLine>) => patch({ fuels: inv.fuels.map((x) => (x.id === id ? { ...x, ...p } : x)) });
  const year = inv.year ?? client.profile.reportingYear;
  const grid = inv.grid ?? GRID_FACTORS;
  const editionName = useEditionName(sets);
  const meta = { sources: SOURCES, boundary: t("ghg.boundary"), unit: "tCO₂e", status: client.sample ? ("sample" as const) : undefined };

  const steps = [
    { id: "st", label: t("ghg.w_stationary"), value: r.scope1Stationary, color: "var(--th-climate)" },
    { id: "mo", label: t("ghg.w_mobile"), value: r.scope1Mobile, color: "var(--th-climate)" },
    { id: "pr", label: t("ghg.w_process"), value: r.scope1Process, color: "var(--th-climate)" },
    { id: "fu", label: t("ghg.w_fugitive"), value: r.scope1Fugitive, color: "var(--th-climate)", dash: true },
    { id: "s1", label: t("ghg.scope1"), value: r.scope1, color: "var(--ink)", total: true },
    { id: "s2", label: t("ghg.scope2loc"), value: r.scope2Location, color: "var(--th-climate-2)" },
    { id: "s3", label: t("ghg.scope3"), value: r.scope3, color: "var(--th-climate-3)", dash: true },
    { id: "tot", label: t("common.total"), value: r.totalLocation, color: "var(--ink)", total: true },
  ];

  const cats = SCOPE3_CATEGORIES.filter((c) => (r.scope3ByCategory[c] ?? 0) > 0);

  return (
    <>
      <PageHeader
        family="climate"
        title={t("nav.ghg")}
        result={t("ghg.result", { total: fmt.compact(r.totalLocation), s12: fmt.compact(r.scope1 + r.scope2Location), est: fmt.percent(r.estimatedShare, 0) })}
        actions={<ToolActions tool="ghg" />}
      />
      <ApprovalBar section="ghg" />
      <ToolLayout
        notes={<SourceNotes section="ghg" />}
        locked={locked}
        family="climate"
        inputs={
          <>
            <FactorYear inv={inv} year={year} sets={sets} baseYear={client.pathway.baseYear} onApply={(next) => set(next)} />
            <InventoryImport inv={inv} onApply={(next) => set(next)} />
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
                  <InputGroup key={f.id} title={`${t("ghg.fuel")} ${i + 1} · ${fmt.number(fuelEmissions(f))} tCO₂e`}>
                    <TextField label={t("ghg.label")} value={f.label} onChange={(v) => patch({ fuels: inv.fuels.map((x) => (x.id === f.id ? { ...x, label: v } : x)) })} />
                    <div className="grid grid-cols-2 gap-4">
                      <SelectField<FuelId>
                        label={t("ghg.fuelType")}
                        value={f.fuel}
                        onChange={(v) => patchFuel(f.id, { fuel: v, ncv: FUELS[v].ncv, ef: FUELS[v].ef, ...defaultNonCo2(v, f.mobile), factorRef: undefined })}
                        options={Object.keys(FUELS).map((k) => ({ value: k as FuelId, label: t(`ghg.fuels.${k}`) }))}
                      />
                      <NumberField label={t("ghg.amount")} unit={FUELS[f.fuel].unit} value={f.amount} min={0} onChange={(v) => patch({ fuels: inv.fuels.map((x) => (x.id === f.id ? { ...x, amount: v } : x)) })} />
                    </div>
                    <FactorPicker
                      kind="fuel_co2"
                      year={year}
                      matchKey={f.fuel}
                      sets={sets}
                      value={f.factorRef}
                      onPick={(o) => patchFuel(f.id, o ? { ncv: o.factor.ncv ?? f.ncv, ef: o.factor.value, ch4: o.factor.ch4 ?? f.ch4, n2o: o.factor.n2o ?? f.n2o, factorRef: factorRef(o) } : { factorRef: undefined })}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <NumberField label={t("ghg.ncv")} unit={`GJ/${FUELS[f.fuel].unit}`} value={f.ncv} min={0} onChange={(v) => patch({ fuels: inv.fuels.map((x) => (x.id === f.id ? { ...x, ncv: v, factorRef: undefined } : x)) })} />
                      <NumberField label={t("ghg.ef")} unit="tCO₂/TJ" value={f.ef} min={0} onChange={(v) => patch({ fuels: inv.fuels.map((x) => (x.id === f.id ? { ...x, ef: v, factorRef: undefined } : x)) })} />
                    </div>
                    <NonCo2Fields line={f} onChange={(p) => patchFuel(f.id, p)} />
                    <div className="grid grid-cols-2 gap-4">
                      <SelectField<"0" | "1"> label={t("ghg.use")} value={f.mobile ? "1" : "0"} onChange={(v) => patchFuel(f.id, { mobile: v === "1", ...defaultNonCo2(f.fuel, v === "1") })} options={[{ value: "0", label: t("ghg.stationary") }, { value: "1", label: t("ghg.mobile") }]} />
                      <QualitySelect value={f.quality} onChange={(q) => patch({ fuels: inv.fuels.map((x) => (x.id === f.id ? { ...x, quality: q } : x)) })} />
                    </div>
                    <Button variant="ghost" size="sm" className="self-start text-[var(--crit)]" onClick={() => patch({ fuels: inv.fuels.filter((x) => x.id !== f.id) })}>
                      <Trash2 size={14} aria-hidden /> {t("actions.remove")}
                    </Button>
                  </InputGroup>
                ))}
                <Button variant="quiet" onClick={() => patch({ fuels: [...inv.fuels, { id: uid(), fuel: "natural_gas", label: t("ghg.fuels.natural_gas"), amount: 0, ncv: FUELS.natural_gas.ncv, ef: FUELS.natural_gas.ef, ...defaultNonCo2("natural_gas", false), mobile: false, quality: "measured" }] })}>
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
                          { value: "transmission", label: `${t("ghg.transmission")} · ${grid.transmission}` },
                          { value: "distribution", label: `${t("ghg.distribution")} · ${grid.distribution}` },
                        ]}
                      />
                    </div>
                    <NumberField label={t("ghg.certified")} unit="MWh" hint={t("ghg.certifiedHint")} value={e.certifiedMwh} min={0} onChange={(v) => patch({ electricity: inv.electricity.map((x) => (x.id === e.id ? { ...x, certifiedMwh: v } : x)) })} />
                    <FactorPicker
                      kind="grid"
                      year={year}
                      sets={sets}
                      value={e.factorRef}
                      onPick={(o) => patch({ electricity: inv.electricity.map((x) => (x.id === e.id ? (o ? { ...x, gridFactor: o.factor.value, factorRef: factorRef(o) } : { ...x, factorRef: undefined }) : x)) })}
                    />
                    <NumberField
                      label={t("ghg.gridFactor")}
                      unit="tCO₂e/MWh"
                      hint={t("ghg.gridFactorHint", { value: grid[e.connection], edition: editionName(gridEdition(inv)) })}
                      nullable
                      value={e.gridFactor ?? NaN}
                      onChange={(v) => patch({ electricity: inv.electricity.map((x) => (x.id === e.id ? { ...x, gridFactor: Number.isFinite(v) ? v : null, factorRef: undefined } : x)) })}
                    />
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
                    <FactorPicker
                      kind="scope3"
                      year={year}
                      filter={(f) => !f.categories || f.categories.includes(l.category)}
                      sets={sets}
                      value={l.factorRef}
                      onPick={(o) =>
                        patch({
                          scope3: inv.scope3.map((x) =>
                            x.id === l.id ? (o ? { ...x, factor: o.factor.value, unit: o.factor.unit ?? x.unit, factorSource: `${o.set.name} — ${o.factor.label}`, factorRef: factorRef(o) } : { ...x, factorRef: undefined }) : x,
                          ),
                        })
                      }
                    />
                    <NumberField label={t("ghg.factor")} unit={`tCO₂e/${l.unit}`} value={l.factor} min={0} onChange={(v) => patch({ scope3: inv.scope3.map((x) => (x.id === l.id ? { ...x, factor: v, factorRef: undefined } : x)) })} />
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
          <div className="glass sheet group flex min-w-0 flex-col gap-3 overflow-x-auto p-5 md:p-6">
            <SectionTitle aside={<ThemeIcon theme="energy" />}>{t("ghg.scope2compare")}</SectionTitle>
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
                {inv.electricity.map((e, i) => (
                  <tr key={e.id} className="anim-row" style={{ ["--i" as string]: i }}>
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
          <div className="glass sheet group flex min-w-0 flex-col gap-3 overflow-x-auto p-5 md:p-6">
            <SectionTitle aside={<ThemeIcon theme="valuechain" />}>{t("ghg.scope3byCat")}</SectionTitle>
            <table className="report-table text-[14px]">
              <thead>
                <tr>
                  <th>{t("ghg.category")}</th>
                  <th className="r">tCO₂e</th>
                  <th>{t("ghg.quality")}</th>
                </tr>
              </thead>
              <tbody>
                {cats.map((c, i) => {
                  const lines = inv.scope3.filter((l) => l.category === c);
                  const est = lines.some((l) => l.quality === "estimated");
                  const share = r.scope3 ? r.scope3ByCategory[c] / r.scope3 : 0;
                  return (
                    <tr key={c} className="anim-row" style={{ ["--i" as string]: i }}>
                      <td>
                        {c}. {t(`ghg.cat.${c}`)}
                      </td>
                      <td className="r num">
                        <span className="flex flex-col items-end gap-1.5">
                          {n0(r.scope3ByCategory[c])}
                          <InlineBar value={share} color={th("valuechain")} label={`${t(`ghg.cat.${c}`)}: ${fmt.percent(share)}`} index={i} width={64} />
                        </span>
                      </td>
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
        <ByGas r={r} />
        <div className="glass sheet flex min-w-0 flex-col gap-3 p-5 md:p-6">
          <SectionTitle>{t("common.notes")}</SectionTitle>
          <NoteList prefix="ghg.notes" keys={["factors", "grid", "market", "scope3", "gwp", "tsrs"]} />
        </div>
      </ToolLayout>
    </>
  );
}

/** CH₄ and N₂O factors of a fuel line, with the IPCC default they start from and a way back to it. */
function NonCo2Fields({ line, onChange }: { line: FuelLine; onChange: (p: Partial<FuelLine>) => void }) {
  const { t, fmt } = useI18n();
  const d = defaultNonCo2(line.fuel, line.mobile);
  const v = nonCo2Of(line);
  const custom = v.ch4 !== d.ch4 || v.n2o !== d.n2o;
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-4">
        <NumberField label={t("ghg.ch4")} unit="kg/TJ" value={v.ch4} min={0} onChange={(x) => onChange({ ch4: x })} />
        <NumberField label={t("ghg.n2o")} unit="kg/TJ" value={v.n2o} min={0} onChange={(x) => onChange({ n2o: x })} />
      </div>
      <p className="flex flex-wrap items-center gap-x-2 text-[12px] leading-snug text-[var(--ink-3)]">
        {t("ghg.nonCo2Default", { ch4: fmt.number(d.ch4, 1), n2o: fmt.number(d.n2o, 1), source: t(`ghg.nonCo2Src.${nonCo2Source(line.fuel, line.mobile)}`) })}
        {custom && (
          <Button variant="ghost" size="sm" onClick={() => onChange(d)}>
            {t("ghg.nonCo2Reset")}
          </Button>
        )}
      </p>
    </div>
  );
}

/** Scope 1 by gas: fuel combustion split into CO₂, CH₄ and N₂O, then fluorinated gases and process emissions. */
function ByGas({ r }: { r: ReturnType<typeof computeInventory> }) {
  const { t, fmt } = useI18n();
  const g = r.combustionGases;
  const rows = [
    { id: "co2", label: "CO₂", mass: g.co2, gwp: 1, co2e: g.co2 },
    { id: "ch4", label: "CH₄", mass: g.ch4, gwp: GWP_AR6_COMBUSTION.ch4, co2e: g.ch4 * GWP_AR6_COMBUSTION.ch4 },
    { id: "n2o", label: "N₂O", mass: g.n2o, gwp: GWP_AR6_COMBUSTION.n2o, co2e: g.n2o * GWP_AR6_COMBUSTION.n2o },
    { id: "fgas", label: t("ghg.byGasFgas"), mass: null, gwp: null, co2e: r.scope1Fugitive },
    { id: "process", label: t("ghg.w_process"), mass: null, gwp: null, co2e: r.scope1Process },
  ];
  return (
    <div className="glass sheet flex min-w-0 flex-col gap-3 overflow-x-auto p-5 md:p-6">
      <SectionTitle aside={<ThemeIcon theme="climate" />}>{t("ghg.byGas")}</SectionTitle>
      <table className="report-table text-[14px]">
        <thead>
          <tr>
            <th>{t("ghg.gas")}</th>
            <th className="r">{t("ghg.byGasMass")}</th>
            <th className="r">GWP</th>
            <th className="r">tCO₂e</th>
            <th className="r">{t("ghg.share")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((x, i) => (
            <tr key={x.id} className="anim-row" style={{ ["--i" as string]: i }}>
              <td>{x.label}</td>
              <td className="r num">{x.mass === null ? "–" : fmt.number(x.mass, x.id === "co2" ? 0 : 2)}</td>
              <td className="r num">{x.gwp === null ? "–" : fmt.number(x.gwp, Number.isInteger(x.gwp) ? 0 : 1)}</td>
              <td className="r num">{fmt.number(x.co2e, 0)}</td>
              <td className="r num">{fmt.percent(r.scope1 ? x.co2e / r.scope1 : 0)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>{t("ghg.scope1")}</td>
            <td />
            <td />
            <td className="r num">{fmt.number(r.scope1, 0)}</td>
            <td className="r num">{fmt.percent(r.scope1 ? 1 : 0)}</td>
          </tr>
        </tfoot>
      </table>
      <p className="text-[13px] text-[var(--ink-3)]">{t("ghg.byGasNote")}</p>
    </div>
  );
}

/** Bulk CSV import: download the template, upload a file, preview, then add to or replace the inventory. */
function InventoryImport({ inv, onApply }: { inv: Inventory; onApply: (next: Inventory) => void }) {
  const { t } = useI18n();
  const client = useActiveClient();
  const update = useWorkspace((s) => s.update);
  const [result, setResult] = useState<{ read: FileRead<ImportResult>; name: string } | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const read = result?.read.ok ? result.read : null;
  const count = read ? Object.values(read.result.lines).reduce((n, l) => n + l.length, 0) : 0;
  const apply = (mode: "append" | "replace") => {
    if (!read || !result) return;
    const l = read.result.lines;
    onApply(
      mode === "replace"
        ? { ...inv, ...l }
        : {
            ...inv,
            fuels: [...inv.fuels, ...l.fuels],
            process: [...inv.process, ...l.process],
            refrigerants: [...inv.refrigerants, ...l.refrigerants],
            electricity: [...inv.electricity, ...l.electricity],
            scope3: [...inv.scope3, ...l.scope3],
          },
    );
    update("importLog", logImport(client.importLog, { tool: "ghg", fileName: result.name, sha256: read.sha256, importedAt: new Date().toISOString(), sheet: read.sheet, rows: read.result.rows, applied: count, mode }));
    setDone(t(mode === "replace" ? "ghg.import.replaced" : "ghg.import.appended", { n: count }));
    setResult(null);
  };
  return (
    <FileImport
      title={t("ghg.import.title")}
      hint={t("ghg.import.hint")}
      templates={[
        { label: t("imp.templateCsv"), fileName: "isoline-envanter-sablonu.csv", mime: "text/csv;charset=utf-8", make: inventoryTemplateCsv },
        {
          label: t("imp.templateXlsx"),
          fileName: "isoline-envanter-sablonu.xlsx",
          mime: XLSX_MIME,
          excel: true,
          make: () => xlsxWorkbook([{ name: t("imp.inv.sheet"), rows: INVENTORY_TEMPLATE_ROWS, widths: [12, 30, 14, 12, 8, 8, 8, 10, 13, 14, 15, 8, 20, 11] }, { name: t("imp.valuesSheet"), rows: inventoryHelpRows(t), widths: [22, 90] }]),
        },
      ]}
      last={lastImport(client.importLog, "ghg")}
      done={done}
      onFile={async (f) => {
        setDone(null);
        setResult({ read: await importInventoryFile(await f.arrayBuffer(), f.name), name: f.name });
      }}
    >
      {result && (
        <ImportPreview>
          {!result.read.ok ? (
            <>
              <p className="font-semibold">{result.name}</p>
              <IssueList items={[t(`imp.err.${result.read.error}`, { mb: 15 })]} />
            </>
          ) : (
            <>
              <p className="font-semibold">{t("ghg.import.preview", { file: result.read.sheet ? `${result.name} · ${result.read.sheet}` : result.name, n: count, rows: result.read.result.rows })}</p>
              <p className="text-[12.5px] text-[var(--ink-2)]">
                {t("ghg.import.counts", {
                  fuels: result.read.result.lines.fuels.length,
                  process: result.read.result.lines.process.length,
                  ref: result.read.result.lines.refrigerants.length,
                  el: result.read.result.lines.electricity.length,
                  s3: result.read.result.lines.scope3.length,
                })}
              </p>
              <IssueList items={result.read.result.issues.map((i) => `${t("ghg.import.row", { row: i.row })} ${t(`ghg.import.err.${i.key}`, i.vars)}`)} />
            </>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            {count > 0 && (
              <>
                <Button variant="primary" size="sm" onClick={() => apply("append")}>
                  {t("ghg.import.append")}
                </Button>
                <Button variant="quiet" size="sm" onClick={() => apply("replace")}>
                  {t("ghg.import.replace")}
                </Button>
              </>
            )}
            <Button variant="ghost" size="sm" onClick={() => setResult(null)}>
              {t("clients.cancel")}
            </Button>
          </div>
        </ImportPreview>
      )}
    </FileImport>
  );
}

/** Allowed values sheet of the Excel template. */
function inventoryHelpRows(t: (k: string, v?: Record<string, string | number>) => string): string[][] {
  return [
    [t("imp.inv.help.column"), t("imp.inv.help.values")],
    ["type", "fuel, process, refrigerant, electricity, scope3"],
    ["item (fuel)", Object.keys(FUELS).join(", ")],
    ["item (refrigerant)", Object.keys(GWP_AR6).join(", ")],
    ["item (scope3)", t("imp.inv.help.category")],
    ["amount", t("imp.inv.help.amount")],
    ["ncv / ef", t("imp.inv.help.ncvEf")],
    ["ch4 / n2o", t("imp.inv.help.ch4N2o")],
    ["use", "stationary, mobile"],
    ["connection", "transmission, distribution"],
    ["certified_mwh / supplier_factor", t("imp.inv.help.electricity")],
    ["factor / factor_source", t("imp.inv.help.factor")],
    ["quality", "measured, calculated, estimated"],
  ];
}
