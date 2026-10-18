/** Key figures per tool for one client — shared by the overview page and the Word exports. */
import type { ClientData } from "@/data/sample";
import type { Formatters } from "@/i18n/core";
import { computeInventory } from "./calc/ghg";
import { projectPortfolio } from "./calc/cbam";
import { etsCategory, projectEts } from "./calc/ets";
import { buildPathway, targetGap } from "./calc/pathway";
import { classify, environment, safetyRates, taxonomyKpis, workforce } from "./calc/indicators";

export type SummaryRow = { label: string; value: string };
type T = (key: string, vars?: Record<string, string | number>) => string;

export function toolSummary(c: ClientData, tool: string, t: T, fmt: Formatters): SummaryRow[] {
  switch (tool) {
    case "ghg": {
      const r = computeInventory(c.ghg);
      return [
        { label: t("ghg.scope1"), value: `${fmt.number(r.scope1)} tCO₂e` },
        { label: t("ghg.scope2loc"), value: `${fmt.number(r.scope2Location)} tCO₂e` },
        { label: t("ghg.scope2mkt"), value: `${fmt.number(r.scope2Market)} tCO₂e` },
        { label: t("ghg.scope3"), value: `${fmt.number(r.scope3)} tCO₂e` },
        { label: t("ghg.intensity"), value: `${fmt.number(r.intensityProduct, 2)} tCO₂e/t` },
      ];
    }
    case "cbam": {
      const rows = projectPortfolio(c.cbam.products, c.cbam.scenario);
      if (!rows.length) return [];
      const y30 = rows.find((r) => r.year === 2030) ?? rows[rows.length - 1];
      return [
        { label: t("cbam.fig2026"), value: fmt.currency(rows[0].cost) },
        { label: t("cbam.fig2030"), value: fmt.currency(y30.cost) },
        { label: t("cbam.figTotal"), value: fmt.currency(rows.reduce((s, r) => s + r.cost, 0)) },
      ];
    }
    case "ets": {
      const rows = projectEts(c.ets, 2026, 2030);
      const p = rows.find((r) => r.priced) ?? rows[rows.length - 1];
      return [
        { label: t("ets.category"), value: etsCategory(c.ets.emissions) },
        { label: t("ets.figDeficit", { year: p.year }), value: `${fmt.number(p.deficit)} tCO₂e` },
        { label: t("ets.figCost", { from: 2026, to: 2030 }), value: fmt.currency(rows.reduce((s, r) => s + r.cost, 0), "TRY") },
      ];
    }
    case "pathway": {
      const rows = buildPathway(c.pathway, 2050);
      const gap = targetGap(rows, c.pathway.targetYear);
      const tr = rows.find((r) => r.year === c.pathway.targetYear);
      return [
        { label: t("pathway.figTarget", { year: c.pathway.targetYear }), value: `${fmt.number(tr?.target15 ?? 0)} tCO₂e` },
        { label: t("pathway.figPlan", { year: c.pathway.targetYear }), value: `${fmt.number(tr?.withMeasures ?? 0)} tCO₂e` },
        { label: t("pathway.gapLabel"), value: `${fmt.number(gap)} tCO₂e` },
      ];
    }
    case "materiality": {
      const s = c.materiality.topics.map((tp) => ({ id: tp.id, c: classify(tp, c.materiality.threshold) })).filter((x) => x.c.material);
      return [{ label: t("mat.figMaterial"), value: s.map((x) => `${x.id} ${t(`mat.topics.${x.id}`)}`).join(", ") || "—" }];
    }
    case "environment": {
      const r = environment(c.indicators.env);
      return [
        { label: t("env.figEnergy"), value: `${fmt.number(r.energyToe)} TEP` },
        { label: t("env.figRenewable"), value: fmt.percent(r.renewableShare) },
        { label: t("env.figWater"), value: `${fmt.number(r.waterConsumption)} m³` },
        { label: t("env.figRecovery"), value: fmt.percent(r.wasteRecoveryRate) },
      ];
    }
    case "workforce": {
      const s = safetyRates(c.indicators.safety);
      const w = workforce(c.indicators.workforce);
      return [
        { label: "LTIFR", value: fmt.number(s.ltifr, 2) },
        { label: "TRIR", value: fmt.number(s.trir, 2) },
        { label: t("work.payGapLabel"), value: fmt.percent(w.payGap) },
        { label: t("work.trainingPerEmployee"), value: fmt.number(w.trainingPerEmployee, 1) },
      ];
    }
    case "taxonomy": {
      const k = taxonomyKpis(c.taxonomy.activities, c.taxonomy.totals, c.taxonomy.notAssessed);
      return [
        { label: t("tax.alignedOf", { kpi: t("tax.turnover") }), value: fmt.percent(k.turnover.aligned) },
        { label: t("tax.alignedOf", { kpi: t("tax.capex") }), value: fmt.percent(k.capex.aligned) },
        { label: t("tax.alignedOf", { kpi: t("tax.opex") }), value: fmt.percent(k.opex.aligned) },
      ];
    }
    default:
      return [];
  }
}
