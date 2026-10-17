"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useI18n } from "@/i18n/provider";
import { environment, safetyRates, taxonomyKpis, workforce, type EnvInput, type KpiKey, type SafetyInput, type TaxonomyActivity, type WorkforceInput } from "@/lib/calc/indicators";
import { FiguresRow, InputGroup, PageHeader, ToolLayout } from "@/components/shell";
import { Figure, LegendItem, SourceNote } from "@/components/figure";
import { ShareBar, StackedBars } from "@/components/charts";
import { Button, NumberField, StatusMark, TextField, Toggle } from "@/components/ui";
import { GroupRow, InlineBar, ThemeIcon } from "@/components/data";
import { th, type ThemeId } from "@/data/themes";
import { Hydrated, NoteList, SectionTitle, ToolActions, useTool } from "./common";

// ---------------------------------------------------------------- Environment
export function EnvironmentTool() {
  return (
    <Hydrated>
      <EnvInner />
    </Hydrated>
  );
}

function EnvInner() {
  const { t, fmt } = useI18n();
  const [ind, set, client] = useTool("indicators");
  const e = ind.env;
  const r = useMemo(() => environment(e), [e]);
  const field = (k: keyof EnvInput, unit: string, opts: { percent?: boolean } = {}) => (
    <NumberField key={k} label={t(`env.${k}`)} unit={unit} percent={opts.percent} value={e[k]} min={0} onChange={(v) => set({ ...ind, env: { ...e, [k]: v } })} />
  );
  const meta = { sources: ["gri_standards", "energy_eff_reg", "esrs_topics"], boundary: t("env.boundary"), status: client.sample ? ("sample" as const) : undefined };
  return (
    <>
      <PageHeader
        family="environment"
        title={t("nav.environment")}
        result={t("env.result", { toe: fmt.compact(r.energyToe), ren: fmt.percent(r.renewableShare), rec: fmt.percent(r.wasteRecoveryRate) })}
        actions={<ToolActions tool="indicators" />}
      />
      <ToolLayout
        family="environment"
        inputs={
          <>
            <InputGroup title={t("env.energy")}>
              {field("energyGj", "GJ")}
              {field("renewableGj", "GJ")}
            </InputGroup>
            <InputGroup title={t("env.water")}>
              {field("waterWithdrawalM3", "m³")}
              {field("waterDischargeM3", "m³")}
              {field("waterStressShare", "", { percent: true })}
            </InputGroup>
            <InputGroup title={t("env.waste")}>
              {field("wasteTotalT", "t")}
              {field("wasteRecoveredT", "t")}
              {field("wasteHazardousT", "t")}
            </InputGroup>
            <InputGroup title={t("env.normaliser")}>{field("revenueMillionTry", t("units.mTry"))}</InputGroup>
          </>
        }
      >
        <FiguresRow
          pulseKey={Math.round(r.energyToe)}
          items={[
            { label: t("env.figEnergy"), value: fmt.compact(r.energyToe), note: t("env.figEnergyNote", { mwh: fmt.compact(r.energyMwh) }), tone: "fam" },
            { label: t("env.figRenewable"), value: fmt.percent(r.renewableShare) },
            { label: t("env.figWater"), value: fmt.compact(r.waterConsumption), note: "m³" },
            { label: t("env.figRecovery"), value: fmt.percent(r.wasteRecoveryRate), tone: "fam" },
          ]}
        />
        <div className="grid gap-10 lg:grid-cols-3">
          {(
            [
              { theme: "energy", title: t("env.energy"), parts: [{ value: r.renewableShare, color: th("energy"), label: t("env.renewableGj") }], foot: t("env.energyFoot", { ints: fmt.number(r.energyIntensity, 0) }) },
              { theme: "water", title: t("env.water"), parts: [{ value: e.waterWithdrawalM3 ? r.waterConsumption / e.waterWithdrawalM3 : 0, color: th("water"), label: t("env.consumption") }, { value: e.waterStressShare, color: th("water", "ink"), label: t("env.waterStressShare"), hatch: true }], foot: t("env.waterFoot", { ints: fmt.number(r.waterIntensity, 0) }) },
              { theme: "circularity", title: t("env.waste"), parts: [{ value: r.wasteRecoveryRate, color: th("circularity"), label: t("env.wasteRecoveredT") }], foot: t("env.wasteFoot", { haz: fmt.percent(r.hazardousShare) }) },
            ] satisfies { theme: ThemeId; title: string; parts: { value: number; color: string; label: string; hatch?: boolean }[]; foot: string }[]
          ).map((b) => (
            <div key={b.title} className="glass sheet lift group flex min-w-0 flex-col gap-3 p-5 md:p-6">
              <SectionTitle aside={<ThemeIcon theme={b.theme} />}>{b.title}</SectionTitle>
              <ShareBar parts={b.parts} label={b.title} />
              <div className="flex flex-col gap-1 text-[12.5px] text-[var(--ink-2)]">
                {b.parts.map((p) => (
                  <LegendItem key={p.label} kind="swatch" color={p.color} label={`${p.label}: ${fmt.percent(p.value)}`} />
                ))}
              </div>
              <p className="text-[13px] text-[var(--ink-3)]">{b.foot}</p>
            </div>
          ))}
        </div>
        {r.energyManagerRequired && (
          <div className="min-w-0 [&>span]:whitespace-normal">
            <StatusMark kind="required" label={t("env.energyManager")} />
          </div>
        )}
        <div className="glass sheet flex min-w-0 flex-col gap-4 overflow-x-auto p-5 md:p-6">
        <table className="report-table text-[14px]">
          <thead>
            <tr>
              <th>{t("env.indicator")}</th>
              <th className="r">{t("env.value")}</th>
              <th>{t("env.unit")}</th>
              <th>{t("env.refs")}</th>
            </tr>
          </thead>
          {(
            [
              {
                theme: "energy",
                title: t("env.energy"),
                rows: [
                  [t("env.figEnergy"), fmt.number(r.energyToe), "TEP", "GRI 302-1 / 103 · ESRS E1-5 · TSRS 2 (sektör)"],
                  [t("env.energyMwh"), fmt.number(r.energyMwh), "MWh", "GRI 302-1 / 103 · ESRS E1-5"],
                  [t("env.figRenewable"), fmt.percent(r.renewableShare), "%", "ESRS E1-5", r.renewableShare],
                ],
              },
              {
                theme: "water",
                title: t("env.water"),
                rows: [
                  [t("env.waterWithdrawalM3"), fmt.number(e.waterWithdrawalM3), "m³", "GRI 303-3 · ESRS E3-4"],
                  [t("env.consumption"), fmt.number(r.waterConsumption), "m³", "GRI 303-5 · ESRS E3-4", e.waterWithdrawalM3 ? r.waterConsumption / e.waterWithdrawalM3 : 0],
                ],
              },
              {
                theme: "circularity",
                title: t("env.waste"),
                rows: [
                  [t("env.wasteTotalT"), fmt.number(e.wasteTotalT), "t", "GRI 306-3 · ESRS E5-5"],
                  [t("env.figRecovery"), fmt.percent(r.wasteRecoveryRate), "%", "GRI 306-4 · ESRS E5-5", r.wasteRecoveryRate],
                ],
              },
            ] satisfies { theme: ThemeId; title: string; rows: [string, string, string, string, number?][] }[]
          ).map((g, gi) => (
            <tbody key={g.theme}>
              <GroupRow theme={g.theme} colSpan={4} title={g.title} />
              {g.rows.map((row, i) => (
                <tr key={row[0]} className="anim-row" style={{ ["--i" as string]: gi * 3 + i }}>
                  <td>{row[0]}</td>
                  <td className="r num">
                    <span className="inline-flex items-center justify-end gap-3">
                      {row[4] !== undefined && <InlineBar value={row[4]} color={th(g.theme)} label={`${row[0]}: ${row[1]}`} index={i} width={72} />}
                      {row[1]}
                    </span>
                  </td>
                  <td>{row[2]}</td>
                  <td className="text-[13px] text-[var(--ink-3)]">{row[3]}</td>
                </tr>
              ))}
            </tbody>
          ))}
        </table>
        <SourceNote meta={meta} />
        </div>
        <NoteList prefix="env.notes" keys={["toe", "water", "waste", "refs"]} />
      </ToolLayout>
    </>
  );
}

// ---------------------------------------------------------------- Workforce & safety
export function WorkforceTool() {
  return (
    <Hydrated>
      <WorkInner />
    </Hydrated>
  );
}

function WorkInner() {
  const { t, fmt } = useI18n();
  const [ind, set, client] = useTool("indicators");
  const s = safetyRates(ind.safety);
  const w = workforce(ind.workforce);
  const sf = (k: keyof SafetyInput, unit = "") => <NumberField key={k} label={t(`work.${k}`)} unit={unit} value={ind.safety[k]} min={0} onChange={(v) => set({ ...ind, safety: { ...ind.safety, [k]: v } })} />;
  const wf = (k: keyof WorkforceInput, unit = "") => <NumberField key={k} label={t(`work.${k}`)} unit={unit} value={ind.workforce[k]} min={0} onChange={(v) => set({ ...ind, workforce: { ...ind.workforce, [k]: v } })} />;
  const meta = { sources: ["osha_rates", "gri_standards", "esrs_topics"], boundary: t("work.boundary"), status: client.sample ? ("sample" as const) : undefined };
  return (
    <>
      <PageHeader
        family="people"
        title={t("nav.workforce")}
        result={t("work.result", { ltifr: fmt.number(s.ltifr, 2), gap: fmt.percent(w.payGap), train: fmt.number(w.trainingPerEmployee, 1) })}
        actions={<ToolActions tool="indicators" />}
      />
      <ToolLayout
        family="people"
        inputs={
          <>
            <InputGroup title={t("work.safety")}>
              {sf("hoursWorked", t("units.hours"))}
              {sf("lostTimeInjuries")}
              {sf("recordables")}
              {sf("lostDays", t("units.days"))}
              {sf("fatalities")}
            </InputGroup>
            <InputGroup title={t("work.people")}>
              {wf("headcountStart")}
              {wf("headcountEnd")}
              {wf("leavers")}
              {wf("trainingHours", t("units.hours"))}
              {wf("women")}
              {wf("managers")}
              {wf("womenManagers")}
            </InputGroup>
            <InputGroup title={t("work.pay")}>
              {wf("avgPayMen", "TL")}
              {wf("avgPayWomen", "TL")}
            </InputGroup>
          </>
        }
      >
        <FiguresRow
          pulseKey={Math.round(s.ltifr * 100)}
          items={[
            { label: "LTIFR", value: fmt.number(s.ltifr, 2), note: t("work.ltifrNote"), tone: "fam" },
            { label: "TRIR", value: fmt.number(s.trir, 2), note: t("work.trirNote") },
            { label: t("work.payGapLabel"), value: fmt.percent(w.payGap) },
            { label: t("work.turnoverLabel"), value: fmt.percent(w.turnover) },
          ]}
        />
        <Figure
          title={t("work.chart")}
          caption={t("work.chartCaption")}
          meta={meta}
          legend={
            <>
              <LegendItem kind="swatch" color="var(--th-people)" label={t("work.women")} />
              <LegendItem kind="swatch" color="var(--th-people-3)" label={t("work.men")} />
            </>
          }
          table={
            <table className="report-table text-[14px]">
              <tbody>
                <tr>
                  <td>{t("work.womenShare")}</td>
                  <td className="r num">{fmt.percent(w.womenShare)}</td>
                </tr>
                <tr>
                  <td>{t("work.womenManagerShare")}</td>
                  <td className="r num">{fmt.percent(w.womenManagerShare)}</td>
                </tr>
              </tbody>
            </table>
          }
        >
          <StackedBars
            label={t("work.chart")}
            height={240}
            categories={[t("work.all"), t("work.mgmt")]}
            yFormat={(v) => fmt.percent(v, 0)}
            stacks={[
              { id: "w", label: t("work.women"), values: [w.womenShare, w.womenManagerShare], color: "var(--th-people)" },
              { id: "m", label: t("work.men"), values: [1 - w.womenShare, 1 - w.womenManagerShare], color: "var(--th-people-3)" },
            ]}
          />
        </Figure>
        <div className="glass sheet min-w-0 overflow-x-auto p-5 md:p-6">
          <table className="report-table text-[14px]">
            <thead>
              <tr>
                <th>{t("env.indicator")}</th>
                <th className="r">{t("env.value")}</th>
                <th>{t("env.refs")}</th>
              </tr>
            </thead>
            {[
              {
                title: t("work.safety"),
                rows: [
                  [t("work.ltifrRow"), fmt.number(s.ltifr, 2), "GRI 403-9 · ESRS S1-14"],
                  [t("work.trirRow"), fmt.number(s.trir, 2), "GRI 403-9"],
                  [t("work.severity"), fmt.number(s.severity, 1), "GRI 403-9"],
                  [t("work.fatalityRate"), fmt.number(s.fatalityRate, 2), "GRI 403-9 · ESRS S1-14"],
                ],
              },
              {
                title: t("work.people"),
                rows: [
                  [t("work.trainingPerEmployee"), fmt.number(w.trainingPerEmployee, 1), "GRI 404-1 · ESRS S1-13"],
                  [t("work.payGapLabel"), fmt.percent(w.payGap), "GRI 405-2 · ESRS S1-16"],
                  [t("work.turnoverLabel"), fmt.percent(w.turnover), "GRI 401-1 · ESRS S1-6"],
                ],
              },
            ].map((g, gi) => (
              <tbody key={g.title}>
                <GroupRow theme="people" colSpan={3} title={g.title} />
                {g.rows.map((row, i) => (
                  <tr key={row[0]} className="anim-row" style={{ ["--i" as string]: gi * 4 + i }}>
                    <td>{row[0]}</td>
                    <td className="r num">{row[1]}</td>
                    <td className="text-[13px] text-[var(--ink-3)]">{row[2]}</td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
        <NoteList prefix="work.notes" keys={["bases", "payGap", "headcount"]} />
      </ToolLayout>
    </>
  );
}

// ---------------------------------------------------------------- Taxonomy
export function TaxonomyTool() {
  return (
    <Hydrated>
      <TaxInner />
    </Hydrated>
  );
}

function TaxInner() {
  const { t, fmt } = useI18n();
  const [tax, set, client] = useTool("taxonomy");
  const k = useMemo(() => taxonomyKpis(tax.activities, tax.totals, tax.notAssessed), [tax]);
  const [open, setOpen] = useState<string | null>(null);
  const setAct = (id: string, p: Partial<TaxonomyActivity>) => set({ ...tax, activities: tax.activities.map((a) => (a.id === id ? { ...a, ...p } : a)) });
  const keys: KpiKey[] = ["turnover", "capex", "opex"];
  const meta = { sources: ["taxonomy_2026_73", "tr_taxonomy"], boundary: t("tax.boundary"), unit: "%", status: client.sample ? ("sample" as const) : undefined };
  return (
    <>
      <PageHeader
        family="environment"
        title={t("nav.taxonomy")}
        result={t("tax.result", { turnover: fmt.percent(k.turnover.aligned), capex: fmt.percent(k.capex.aligned) })}
        actions={<ToolActions tool="taxonomy" />}
      />
      <ToolLayout
        family="environment"
        inputs={
          <>
            <InputGroup title={t("tax.totals")}>
              {keys.map((kk) => (
                <NumberField key={kk} label={t(`tax.${kk}`)} unit={t("units.mTry")} value={tax.totals[kk]} min={0} onChange={(v) => set({ ...tax, totals: { ...tax.totals, [kk]: v } })} />
              ))}
            </InputGroup>
            {tax.activities.map((a) => (
              <InputGroup key={a.id} title={`${a.code} · ${a.name}`}>
                {open === a.id ? (
                  <>
                    <div className="grid grid-cols-[80px_1fr] gap-4">
                      <TextField label={t("tax.code")} value={a.code} onChange={(v) => setAct(a.id, { code: v })} />
                      <TextField label={t("tax.activity")} value={a.name} onChange={(v) => setAct(a.id, { name: v })} />
                    </div>
                    {keys.map((kk) => (
                      <NumberField key={kk} label={t(`tax.${kk}`)} unit={t("units.mTry")} value={a[kk]} min={0} onChange={(v) => setAct(a.id, { [kk]: v } as Partial<TaxonomyActivity>)} />
                    ))}
                  </>
                ) : (
                  <Button variant="ghost" size="sm" className="self-start" onClick={() => setOpen(a.id)}>
                    {t("tax.edit")}
                  </Button>
                )}
                <Toggle label={t("tax.eligible")} checked={a.eligible} onChange={(v) => setAct(a.id, { eligible: v, aligned: v ? a.aligned : false })} />
                <Toggle label={t("tax.aligned")} hint={t("tax.alignedHint")} checked={a.aligned} onChange={(v) => setAct(a.id, { aligned: v, eligible: v ? true : a.eligible })} />
                <Toggle
                  label={t("tax.notAssessed")}
                  hint={t("tax.notAssessedHint")}
                  checked={tax.notAssessed.includes(a.id)}
                  onChange={(v) => set({ ...tax, notAssessed: v ? [...tax.notAssessed, a.id] : tax.notAssessed.filter((x) => x !== a.id) })}
                />
                <Button variant="ghost" size="sm" className="self-start text-[var(--crit)]" onClick={() => set({ ...tax, activities: tax.activities.filter((x) => x.id !== a.id), notAssessed: tax.notAssessed.filter((x) => x !== a.id) })}>
                  <Trash2 size={14} aria-hidden /> {t("actions.remove")}
                </Button>
              </InputGroup>
            ))}
            <Button
              variant="quiet"
              onClick={() => {
                const id = `t-${Date.now().toString(36)}`;
                set({ ...tax, activities: [...tax.activities, { id, code: "", name: t("tax.newActivity"), turnover: 0, capex: 0, opex: 0, eligible: true, aligned: false }] });
                setOpen(id);
              }}
            >
              <Plus size={15} aria-hidden /> {t("tax.addActivity")}
            </Button>
          </>
        }
      >
        <FiguresRow
          pulseKey={Math.round(k.capex.aligned * 1000)}
          items={keys
            .map((kk) => ({ label: t("tax.alignedOf", { kpi: t(`tax.${kk}`) }), value: fmt.percent(k[kk].aligned), note: t("tax.eligibleNote", { pct: fmt.percent(k[kk].eligible) }), tone: "fam" as const }))
            .concat([{ label: t("tax.capCheck"), value: keys.every((kk) => k[kk].notAssessedWithinCap) ? t("tax.capOk") : t("tax.capOver"), note: t("tax.capNote"), tone: "fam" as const }])}
        />
        <Figure
          title={t("tax.chart")}
          caption={t("tax.chartCaption")}
          meta={meta}
          legend={
            <>
              <LegendItem kind="swatch" color="var(--th-nature)" label={t("tax.legendAligned")} />
              <LegendItem kind="swatch" color="var(--th-nature-3)" label={t("tax.legendEligibleNotAligned")} />
              <LegendItem kind="swatch" color="var(--ink-3)" label={t("tax.legendNotAssessed")} />
              <LegendItem kind="swatch" color="var(--data-other-3)" label={t("tax.legendNotEligible")} />
            </>
          }
          csv={{ header: ["kpi", "aligned", "eligible_not_aligned", "not_assessed", "not_eligible"], rows: keys.map((kk) => [kk, k[kk].aligned.toFixed(4), (k[kk].eligible - k[kk].aligned).toFixed(4), k[kk].notAssessed.toFixed(4), k[kk].notEligible.toFixed(4)]) }}
          table={
            <table className="report-table text-[14px]">
              <thead>
                <tr>
                  <th>KPI</th>
                  <th className="r">{t("tax.legendAligned")}</th>
                  <th className="r">{t("tax.legendEligibleNotAligned")}</th>
                  <th className="r">{t("tax.legendNotAssessed")}</th>
                  <th className="r">{t("tax.legendNotEligible")}</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((kk) => (
                  <tr key={kk}>
                    <td>{t(`tax.${kk}`)}</td>
                    <td className="r num">{fmt.percent(k[kk].aligned)}</td>
                    <td className="r num">{fmt.percent(k[kk].eligible - k[kk].aligned)}</td>
                    <td className="r num">{fmt.percent(k[kk].notAssessed)}</td>
                    <td className="r num">{fmt.percent(k[kk].notEligible)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          }
        >
          <StackedBars
            label={t("tax.chart")}
            height={280}
            categories={keys.map((kk) => t(`tax.${kk}`))}
            yFormat={(v) => fmt.percent(v, 0)}
            stacks={[
              { id: "al", label: t("tax.legendAligned"), values: keys.map((kk) => k[kk].aligned), color: "var(--th-nature)" },
              { id: "el", label: t("tax.legendEligibleNotAligned"), values: keys.map((kk) => k[kk].eligible - k[kk].aligned), color: "var(--th-nature-3)" },
              { id: "na", label: t("tax.legendNotAssessed"), values: keys.map((kk) => k[kk].notAssessed), color: "var(--ink-3)", hatch: true },
              { id: "ne", label: t("tax.legendNotEligible"), values: keys.map((kk) => k[kk].notEligible), color: "var(--data-other-3)" },
            ]}
          />
        </Figure>
        <NoteList prefix="tax.notes" keys={["threshold", "steps", "tr", "fi"]} />
      </ToolLayout>
    </>
  );
}
