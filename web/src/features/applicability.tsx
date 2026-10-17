"use client";

import { useMemo } from "react";
import { useI18n } from "@/i18n/provider";
import { criteriaMet, evaluate, tsrsThresholds, type EntityType, type Finding, type Profile } from "@/lib/calc/applicability";
import { CBAM_SECTORS } from "@/lib/calc/cbam";
import { PILOT_SECTORS, type PilotSector } from "@/lib/calc/ets";
import { InputGroup, PageHeader, ToolLayout } from "@/components/shell";
import { SourceNote } from "@/components/figure";
import { NumberField, SelectField, StatusMark, Toggle } from "@/components/ui";
import { Hydrated, ToolActions, useTool } from "./common";

const ENTITY_TYPES: EntityType[] = ["listed", "bank", "bank_tmsf", "nonbank_fi", "insurer", "capital_markets_fi", "precious_metals", "unlisted_company", "public_body"];
const ORDER: Record<string, number> = { required: 0, indirect: 1, review: 2, voluntary: 3, not_applicable: 4 };

export function ApplicabilityTool() {
  return (
    <Hydrated>
      <Inner />
    </Hydrated>
  );
}

function Inner() {
  const { t, fmt } = useI18n();
  const [p, set] = useTool("profile");
  const findings = useMemo(() => evaluate(p).sort((a, b) => ORDER[a.status] - ORDER[b.status]), [p]);
  const required = findings.filter((f) => f.status === "required").length;
  const indirect = findings.filter((f) => f.status === "indirect").length;
  const up = (patch: Partial<Profile>) => set({ ...p, ...patch });
  const th = tsrsThresholds(p.reportingYear);
  const hist = (i: 0 | 1, k: keyof Profile["history"][0], v: number) => {
    const h = [...p.history] as Profile["history"];
    h[i] = { ...h[i], [k]: v };
    up({ history: h });
  };

  return (
    <>
      <PageHeader family="compass" title={t("nav.applicability")} result={t("app.result", { required, indirect, year: p.reportingYear })} actions={<ToolActions tool="profile" />} />
      <ToolLayout
        family="compass"
        inputs={
          <>
            <InputGroup title={t("app.company")}>
              <SelectField<EntityType> label={t("app.entityType")} value={p.entityType} onChange={(v) => up({ entityType: v })} options={ENTITY_TYPES.map((e) => ({ value: e, label: t(`app.entity.${e}`) }))} />
              {p.entityType === "listed" && (
                <>
                  <Toggle label={t("app.bistMain")} checked={p.bistMainMarkets} onChange={(v) => up({ bistMainMarkets: v })} />
                  <Toggle label={t("app.watchlist")} checked={p.watchlistMarket} onChange={(v) => up({ watchlistMarket: v })} />
                </>
              )}
              <NumberField label={t("app.reportingYear")} value={p.reportingYear} min={2024} max={2032} onChange={(v) => up({ reportingYear: Math.round(v) })} />
              <NumberField label={t("app.firstTsrsYear")} nullable value={p.firstTsrsYear ?? NaN} hint={t("app.firstTsrsHint")} onChange={(v) => up({ firstTsrsYear: Number.isFinite(v) ? Math.round(v) : null })} />
              <NumberField label={t("app.branches")} value={p.branches} min={0} onChange={(v) => up({ branches: Math.round(v) })} />
              {(p.entityType === "bank" || p.entityType === "nonbank_fi") && (
                <Toggle label={t("app.sharesListed")} hint={t("app.sharesListedHint")} checked={p.sharesListed ?? false} onChange={(v) => up({ sharesListed: v })} />
              )}
            </InputGroup>
            {([0, 1] as const).map((i) => (
              <InputGroup key={i} title={t("app.yearFigures", { year: p.reportingYear - 2 + i })}>
                <Toggle label={t("app.regulatedStatus")} checked={p.regulatedStatus[i]} onChange={(v) => up({ regulatedStatus: (i === 0 ? [v, p.regulatedStatus[1]] : [p.regulatedStatus[0], v]) as [boolean, boolean] })} />
                <NumberField label={t("app.assets")} unit="TL" value={p.history[i].totalAssetsTry} min={0} onChange={(v) => hist(i, "totalAssetsTry", v)} />
                <NumberField label={t("app.revenue")} unit="TL" value={p.history[i].revenueTry} min={0} onChange={(v) => hist(i, "revenueTry", v)} />
                <NumberField label={t("app.employees")} value={p.history[i].employees} min={0} onChange={(v) => hist(i, "employees", v)} />
                <p className="text-[12.5px] text-[var(--ink-3)]">{t("app.criteriaMet", { n: criteriaMet(p.history[i], p.reportingYear) })}</p>
              </InputGroup>
            ))}
            <InputGroup title={t("app.eu")}>
              <Toggle label={t("app.euEntity")} checked={p.euEntity} onChange={(v) => up({ euEntity: v })} />
              <NumberField label={t("app.employeesGroup")} value={p.employeesGroup} min={0} onChange={(v) => up({ employeesGroup: Math.round(v) })} />
              <NumberField label={t("app.worldwideTurnover")} unit="€" value={p.worldwideTurnoverEur} min={0} onChange={(v) => up({ worldwideTurnoverEur: v })} />
              <NumberField label={t("app.euTurnover")} unit="€" value={p.euTurnoverEur} min={0} onChange={(v) => up({ euTurnoverEur: v })} />
              {!p.euEntity && (
                <NumberField label={t("app.euTurnoverPrev")} unit="€" hint={t("app.euTurnoverPrevHint")} value={p.euTurnoverPrevEur ?? p.euTurnoverEur} min={0} onChange={(v) => up({ euTurnoverPrevEur: v })} />
              )}
              <NumberField label={t("app.euSubsidiary")} unit="€" value={p.euSubsidiaryTurnoverEur} min={0} onChange={(v) => up({ euSubsidiaryTurnoverEur: v })} />
              <Toggle label={t("app.euCustomers")} hint={t("app.euCustomersHint")} checked={p.euCsrdCustomers} onChange={(v) => up({ euCsrdCustomers: v })} />
            </InputGroup>
            <InputGroup title={t("app.carbon")}>
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-[13px] font-medium text-[var(--ink-2)]">{t("app.cbamSectors")}</legend>
                {CBAM_SECTORS.map((s) => (
                  <Toggle key={s} label={t(`sectors.${s}`)} checked={p.cbamSectors.includes(s)} onChange={(v) => up({ cbamSectors: v ? [...p.cbamSectors, s] : p.cbamSectors.filter((x) => x !== s) })} />
                ))}
              </fieldset>
              <NumberField label={t("app.euExportTonnes")} unit="t" value={p.euExportTonnes} min={0} onChange={(v) => up({ euExportTonnes: v })} />
              <NumberField label={t("app.emissions")} unit="tCO₂e" hint={t("app.emissionsHint")} value={p.annualEmissionsTco2e} min={0} onChange={(v) => up({ annualEmissionsTco2e: v })} />
              <SelectField<PilotSector> label={t("app.pilotSector")} value={p.pilotSector} onChange={(v) => up({ pilotSector: v })} options={[...PILOT_SECTORS, "other" as const].map((s) => ({ value: s, label: t(`sectors.${s}`) }))} />
              <NumberField label={t("app.energyToe")} unit="TEP" value={p.energyToe} min={0} onChange={(v) => up({ energyToe: v })} />
            </InputGroup>
            <InputGroup title={t("app.products")}>
              <Toggle label={t("app.eudr")} checked={p.eudrCommodities} onChange={(v) => up({ eudrCommodities: v })} />
              <Toggle label={t("app.small")} checked={p.smallOrMicro} onChange={(v) => up({ smallOrMicro: v })} />
              <Toggle label={t("app.dpp")} checked={p.dppProducts} onChange={(v) => up({ dppProducts: v })} />
              <Toggle label={t("app.batteries")} checked={p.batteries} onChange={(v) => up({ batteries: v })} />
            </InputGroup>
          </>
        }
      >
        <p className="max-w-[72ch] text-[14px] text-[var(--ink-2)]">
          {t("app.thresholdLine", { year: p.reportingYear, assets: fmt.compact(th.assets), revenue: fmt.compact(th.revenue), employees: th.employees })}
        </p>
        <ol className="flex flex-col gap-4">
          {findings.map((f) => (
            <FindingRow key={f.id} f={f} />
          ))}
        </ol>
      </ToolLayout>
    </>
  );
}

function FindingRow({ f }: { f: Finding }) {
  const { t, fmt } = useI18n();
  const kind = f.status === "required" ? "required" : f.status === "indirect" ? "indirect" : f.status === "review" ? "review" : f.status === "voluntary" ? "voluntary" : "na";
  return (
    <li className="glass grid gap-x-8 gap-y-3 p-5 md:grid-cols-[minmax(0,220px)_minmax(0,1fr)] md:p-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-[18px] font-semibold leading-tight">{t(`app.reg.${f.id}`)}</h2>
        <StatusMark kind={kind} label={t(`app.status.${f.status}`)} />
        {f.firstYear && <span className="text-[13px] text-[var(--ink-3)]">{t("app.firstYear", { year: f.firstYear })}</span>}
      </div>
      <div className="flex min-w-0 flex-col gap-3">
        <ul className="flex flex-col gap-1.5 text-[14.5px] leading-relaxed text-[var(--ink-2)]">
          {f.notes.map((n) => (
            <li key={n} className="flex gap-3">
              <span aria-hidden className="mt-[0.75em] h-px w-3 shrink-0 bg-[var(--ink-3)]" />
              <span>{t(`app.notes.${n}`)}</span>
            </li>
          ))}
        </ul>
        {f.dates.length > 0 && (
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-[13px]">
            {f.dates.map((d) => (
              <span key={d.key}>
                <span className="text-[var(--ink-3)]">{t(`dates.${d.key}`)}: </span>
                <span className="num font-semibold">{fmt.date(d.date)}</span>
              </span>
            ))}
          </div>
        )}
        <SourceNote meta={{ sources: f.sources, status: f.status === "review" ? "review" : undefined }} />
      </div>
    </li>
  );
}
