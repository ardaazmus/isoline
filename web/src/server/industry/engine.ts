/**
 * Industry pack formulas (G7-05/06). Pure: accepted observations and current facts in, pack KPIs and findings out.
 *   steel     scrap share = scrap input / crude steel; GHG intensity = (scope 1 + scope 2 location) / crude steel
 *             (worldsteel methodology, crude steel basis)
 *   cement    clinker ratio = clinker / cement (GCCA); measured process CO₂ per tonne of clinker, or — when the plant
 *             has not measured it — IPCC 2006 Tier 1 calcination: clinker × 0.52 tCO₂/t × 1.02 CKD correction
 *             (Vol. 3 eq. 2.2), flagged as estimated with a request for Tier 2 (CaO content)
 *   logistics transport intensity = scope 1 mobile × 10⁶ / tonne-km (gCO₂e/tkm, ISO 14083 / GLEC, tank-to-wheel)
 *   services  electricity intensity = kWh / m² of floor area (CRREM / GRESB style)
 */
import type { FactOut } from "../calc/engines";
import type { Obs, Warning } from "../calc/ghg-engine";

export const CLINKER_EF = 0.52;
export const CKD_CORRECTION = 1.02;

export type PackScope = { id: string; facilityIds: string[] };
export type FactIn = { id: string; metricKey: string; facilityId: string | null; boundaryKind: string | null; value: number | null };
export type IndustryInput = { packs: PackScope[]; observations: Obs[]; facts: FactIn[] };
export type IndustryOut = { facts: FactOut[]; warnings: (Warning & { severity?: "blocker" | "warning" })[]; used: { observations: string[]; facts: string[] } };

const n = (s: string | null) => (s === null ? 0 : Number(s));

export function computeIndustry(input: IndustryInput): IndustryOut {
  const facts: FactOut[] = [];
  const warnings: IndustryOut["warnings"] = [];
  const usedObs = new Set<string>();
  const usedFacts = new Set<string>();
  const obs = (metric: string, facility: string | null) => {
    const list = input.observations.filter((o) => o.metricCode === metric && o.facilityId === facility);
    list.forEach((o) => usedObs.add(o.versionId));
    if (!list.length) return null;
    return list.reduce((s, o) => s + (o.canonical !== null ? n(o.canonical) : (o.lines ?? []).reduce((a, l) => a + Number(l.canonical), 0)), 0);
  };
  const estimated = (metric: string, facility: string | null) => input.observations.some((o) => o.metricCode === metric && o.facilityId === facility && o.quality === "estimated");
  const fact = (key: string, facility: string | null) => {
    const f = input.facts.find((x) => x.metricKey === key && x.facilityId === facility && (x.boundaryKind === "ghg_operational_control" || x.boundaryKind === null));
    if (f) usedFacts.add(f.id);
    return f?.value ?? null;
  };
  const missing = (pack: string, metric: string, facility: string | null) => warnings.push({ code: "pack_input_missing", target: `${pack}:${metric}${facility ? `:${facility}` : ""}`, detail: { pack, metric, facility } });

  for (const p of input.packs) {
    if (p.id === "steel")
      for (const f of p.facilityIds) {
        const crude = obs("ind_steel_crude_production", f);
        if (!crude) {
          missing("steel", "ind_steel_crude_production", f);
          continue;
        }
        const scrap = obs("ind_steel_scrap_input", f);
        if (scrap !== null) {
          const share = scrap / crude;
          facts.push({ metricKey: "ind.steel.scrap_share", facilityId: f, valueNum: share, unit: "ratio" });
          // an EAF charge is mostly scrap (yield ~0.9); far above 1.3 t scrap per tonne of crude steel is implausible
          if (share > 1.3) warnings.push({ code: "scrap_share_implausible", target: `facility:${f}`, detail: { share } });
        }
        const s1 = fact("ghg.scope1", f);
        const s2 = fact("ghg.scope2.location", f);
        if (s1 !== null && s2 !== null) facts.push({ metricKey: "ind.steel.ghg_intensity", facilityId: f, valueNum: (s1 + s2) / crude, unit: "tCO2e/t" });
        else warnings.push({ code: "pack_ghg_missing", target: `steel:${f}` });
      }
    if (p.id === "cement")
      for (const f of p.facilityIds) {
        const clinker = obs("ind_clinker_production", f);
        const cement = obs("ind_cement_production", f);
        if (!clinker) {
          missing("cement", "ind_clinker_production", f);
          continue;
        }
        if (cement) {
          const ratio = clinker / cement;
          facts.push({ metricKey: "ind.cement.clinker_ratio", facilityId: f, valueNum: ratio, unit: "ratio" });
          if (ratio < 0.5 || ratio > 0.97) warnings.push({ code: "clinker_ratio_out_of_range", target: `facility:${f}`, detail: { ratio } });
        } else missing("cement", "ind_cement_production", f);
        const process = obs("ghg_process", f);
        if (process !== null) {
          const ef = process / clinker;
          facts.push({ metricKey: "ind.cement.process_intensity", facilityId: f, valueNum: ef, unit: "tCO2/t clinker", estimatedShare: estimated("ghg_process", f) ? 1 : 0 });
          if (ef < 0.4 || ef > 0.6) warnings.push({ code: "calcination_factor_out_of_range", target: `facility:${f}`, detail: { factor: ef } });
        } else {
          facts.push({ metricKey: "ind.cement.calcination_tco2", facilityId: f, valueNum: clinker * CLINKER_EF * CKD_CORRECTION, unit: "tCO2", estimatedShare: 1 });
          warnings.push({ code: "tier1_calcination", target: `facility:${f}`, detail: { clinker, ef: CLINKER_EF, ckd: CKD_CORRECTION } });
        }
      }
    if (p.id === "logistics") {
      const tkm = obs("ind_transport_tkm", null);
      if (!tkm) missing("logistics", "ind_transport_tkm", null);
      else {
        facts.push({ metricKey: "ind.logistics.tkm", facilityId: null, valueNum: tkm, unit: "tkm" });
        const mobile = fact("ghg.scope1.mobile", null);
        if (mobile !== null) {
          facts.push({ metricKey: "ind.logistics.intensity", facilityId: null, valueNum: (mobile * 1e6) / tkm, unit: "gCO2e/tkm" });
          warnings.push({ code: "ttw_basis", target: "ind.logistics.intensity" });
        } else warnings.push({ code: "pack_ghg_missing", target: "logistics" });
      }
    }
    if (p.id === "services")
      for (const f of p.facilityIds) {
        const area = obs("ind_floor_area", f);
        if (!area) {
          missing("services", "ind_floor_area", f);
          continue;
        }
        const gj = obs("ghg_electricity", f);
        if (gj !== null) facts.push({ metricKey: "ind.services.electricity_intensity", facilityId: f, valueNum: ((gj / 3.6) * 1000) / area, unit: "kWh/m2" });
      }
  }
  facts.sort((a, b) => `${a.metricKey}|${a.facilityId ?? ""}`.localeCompare(`${b.metricKey}|${b.facilityId ?? ""}`));
  return { facts, warnings, used: { observations: [...usedObs].sort(), facts: [...usedFacts].sort() } };
}
