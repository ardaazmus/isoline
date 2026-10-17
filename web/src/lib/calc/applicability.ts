/**
 * Applicability engine: which reporting / carbon-pricing regimes apply to a company profile.
 * Every rule returns a status, the first year it bites, the key dates and the source ids behind it.
 * Rules that the research could not verify are returned with status "review" (expert confirmation).
 */
import { DE_MINIMIS_TONNES } from "./cbam";
import { etsCategory, inEts, lastBusinessDayOfNovember, PILOT_SECTORS, type PilotSector } from "./ets";

export type EntityType =
  | "listed"
  | "bank"
  | "bank_tmsf"
  | "nonbank_fi"
  | "insurer"
  | "capital_markets_fi"
  | "precious_metals"
  | "unlisted_company"
  | "public_body";

export type YearFigures = { totalAssetsTry: number; revenueTry: number; employees: number };

export type Profile = {
  entityType: EntityType;
  /** Listed on Yakın İzleme Pazarı or qualified-investor Girişim Sermayesi Pazarı (excluded from TSRS). */
  watchlistMarket: boolean;
  /** BIST Yıldız/Ana/Alt market (SPK sustainability template). */
  bistMainMarkets: boolean;
  branches: number;
  /** Shares traded on Borsa İstanbul (banks and other financial institutions). Missing = listed only when entityType is "listed". */
  sharesListed?: boolean;
  /** Figures for the two years before the reporting year (index 0 = Y-2, 1 = Y-1). */
  history: [YearFigures, YearFigures];
  /** Years the entity already had the regulated status before the reporting year (Y-2, Y-1). */
  regulatedStatus: [boolean, boolean];
  reportingYear: number;
  firstTsrsYear: number | null;
  // EU exposure
  euEntity: boolean;
  euTurnoverEur: number;
  /** EU net turnover in the year before; Omnibus I Art. 40a requires > €450 m in each of the last two years. Missing = same as euTurnoverEur. */
  euTurnoverPrevEur?: number;
  euSubsidiaryTurnoverEur: number;
  worldwideTurnoverEur: number;
  employeesGroup: number;
  euCsrdCustomers: boolean;
  // Carbon pricing
  cbamSectors: string[];
  euExportTonnes: number;
  annualEmissionsTco2e: number;
  pilotSector: PilotSector;
  // Products
  eudrCommodities: boolean;
  smallOrMicro: boolean;
  dppProducts: boolean;
  batteries: boolean;
  energyToe: number;
};

export type Status = "required" | "voluntary" | "not_applicable" | "review" | "indirect";

export type Finding = {
  id: string;
  status: Status;
  firstYear?: number;
  dates: { key: string; date: string }[];
  notes: string[];
  sources: string[];
};

export const TSRS_THRESHOLDS = [
  { from: 2025, assets: 1_000_000_000, revenue: 2_000_000_000, employees: 500, source: "kgk_scope_2026" },
  { from: 2024, assets: 500_000_000, revenue: 1_000_000_000, employees: 250, source: "kgk_scope_decision" },
] as const;

export function tsrsThresholds(year: number) {
  return TSRS_THRESHOLDS.find((t) => year >= t.from) ?? TSRS_THRESHOLDS[TSRS_THRESHOLDS.length - 1];
}

export function criteriaMet(f: YearFigures, year: number): number {
  const t = tsrsThresholds(year);
  return (f.totalAssetsTry > t.assets ? 1 : 0) + (f.revenueTry > t.revenue ? 1 : 0) + (f.employees > t.employees ? 1 : 0);
}

const THRESHOLD_TYPES: EntityType[] = ["listed", "bank", "nonbank_fi", "insurer", "capital_markets_fi", "precious_metals"];

export function tsrs(p: Profile): Finding {
  const sources = ["kgk_scope_decision", "kgk_scope_2026", "kgk_decision_tree"];
  const notes: string[] = [];
  if (p.entityType === "bank") {
    if (smallUnlistedFiRelief(p)) return { id: "tsrs", status: "voluntary", dates: [], notes: ["tsrs.small_fi_relief"], sources };
    return withReliefs(p, { id: "tsrs", status: "required", firstYear: 2024, dates: [], notes: ["tsrs.bank_always"], sources });
  }
  if (p.entityType === "bank_tmsf") {
    return { id: "tsrs", status: "not_applicable", dates: [], notes: ["tsrs.tmsf"], sources };
  }
  if (!THRESHOLD_TYPES.includes(p.entityType) || (p.entityType === "listed" && p.watchlistMarket)) {
    return { id: "tsrs", status: "voluntary", dates: [], notes: [p.watchlistMarket ? "tsrs.watchlist" : "tsrs.not_listed_type"], sources };
  }
  const y = p.reportingYear;
  const statusBoth = p.regulatedStatus[0] && p.regulatedStatus[1];
  const met = [criteriaMet(p.history[0], y), criteriaMet(p.history[1], y)];
  const inScope = statusBoth && met[0] >= 2 && met[1] >= 2;
  if (!statusBoth) notes.push("tsrs.status_two_years");
  if (inScope && p.entityType === "nonbank_fi" && smallUnlistedFiRelief(p)) {
    return { id: "tsrs", status: "voluntary", dates: [], notes: ["tsrs.small_fi_relief"], sources };
  }
  if (!inScope) {
    return { id: "tsrs", status: "voluntary", dates: [], notes: [...notes, "tsrs.below_thresholds"], sources };
  }
  // KGK decision 13.01.2026 (RG 33139) applies the new thresholds to accounting periods starting on or after
  // 1.1.2025; no primary text says how they apply to the 2023–2024 reference years: flag for review.
  if (y === 2025) notes.push("tsrs.threshold_transition_review");
  return withReliefs(p, { id: "tsrs", status: "required", firstYear: y, dates: [], notes, sources });
}

/**
 * KGK scope decision (temporary provision): banks and non-bank financial institutions whose shares are not
 * traded on the exchange and that had no more than 1 branch or 250 employees at the previous year end are not
 * subject to mandatory reporting while the scope 3 relief runs (the first two TSRS reporting years).
 */
export function smallUnlistedFiRelief(p: Profile): boolean {
  if (p.entityType !== "bank" && p.entityType !== "nonbank_fi") return false;
  if (p.sharesListed ?? false) return false;
  const small = p.branches <= 1 || p.history[1].employees <= 250;
  const first = p.firstTsrsYear ?? p.reportingYear;
  const inScope3Relief = p.reportingYear - first <= 1;
  return small && inScope3Relief;
}

function withReliefs(p: Profile, f: Finding): Finding {
  const first = p.firstTsrsYear ?? f.firstYear ?? p.reportingYear;
  const n = p.reportingYear - first;
  if (n === 0) f.notes.push("tsrs.relief_comparatives", "tsrs.relief_climate_first", "tsrs.relief_timing");
  if (n >= 0 && n <= 1) f.notes.push("tsrs.relief_scope3");
  if (first === 2024 && p.reportingYear === 2025) f.notes.push("tsrs.relief_2024_extension");
  if (p.reportingYear >= 2027) f.notes.push("tsrs.s2_amendments_2027");
  f.notes.push("tsrs.assurance");
  f.sources.push("kgk_relief_ext", "kgk_assurance");
  f.dates.push({ key: "tsrs_s2_amend", date: "2027-01-01" });
  return f;
}

export function csrd(p: Profile): Finding {
  const sources = ["csrd_omnibus", "stop_clock", "esrs_2026", "vss_2026"];
  if (p.euEntity && p.employeesGroup > 1000 && p.worldwideTurnoverEur > 450_000_000) {
    return { id: "csrd", status: "required", firstYear: 2027, dates: [{ key: "csrd_first_report", date: "2028-01-01" }, { key: "esrs_2026_in_force", date: "2026-11-10" }], notes: ["csrd.eu_large"], sources };
  }
  const euTwoYears = p.euTurnoverEur > 450_000_000 && (p.euTurnoverPrevEur ?? p.euTurnoverEur) > 450_000_000;
  if (!p.euEntity && euTwoYears && p.euSubsidiaryTurnoverEur > 200_000_000) {
    return { id: "csrd", status: "required", firstYear: 2028, dates: [{ key: "csrd_nonEU_first_report", date: "2029-01-01" }], notes: ["csrd.non_eu_parent"], sources };
  }
  if (p.euCsrdCustomers) {
    return {
      id: "csrd",
      status: "indirect",
      dates: [{ key: "value_chain_cap", date: "2027-01-01" }],
      notes: [p.employeesGroup <= 1000 ? "csrd.value_chain_protected" : "csrd.value_chain_supplier"],
      sources,
    };
  }
  return { id: "csrd", status: "not_applicable", dates: [], notes: ["csrd.out_of_scope"], sources };
}

export function csddd(p: Profile): Finding {
  const sources = ["csrd_omnibus"];
  const eu = p.euEntity && p.employeesGroup > 5000 && p.worldwideTurnoverEur > 1_500_000_000;
  const nonEu = !p.euEntity && p.euTurnoverEur > 1_500_000_000;
  if (eu || nonEu) return { id: "csddd", status: "required", firstYear: 2029, dates: [{ key: "csddd_apply", date: "2029-07-26" }], notes: ["csddd.in_scope"], sources };
  if (p.euCsrdCustomers) return { id: "csddd", status: "indirect", dates: [{ key: "csddd_apply", date: "2029-07-26" }], notes: ["csddd.supplier"], sources };
  return { id: "csddd", status: "not_applicable", dates: [], notes: [], sources };
}

export function cbam(p: Profile): Finding {
  const sources = ["cbam_reg", "cbam_price", "cbam_guidance3"];
  if (p.cbamSectors.length === 0) return { id: "cbam", status: "not_applicable", dates: [], notes: ["cbam.no_sector"], sources };
  const dates = [
    { key: "cbam_cert_sales", date: "2027-02-01" },
    { key: "cbam_first_declaration", date: "2027-09-30" },
  ];
  const notes = ["cbam.operator_data"];
  if (p.euExportTonnes <= DE_MINIMIS_TONNES &&!p.cbamSectors.some((s) => s === "electricity" || s === "hydrogen")) notes.push("cbam.de_minimis_check");
  notes.push("cbam.default_markup");
  if (p.cbamSectors.some((s) => s === "iron_steel" || s === "aluminium")) notes.push("cbam.downstream_2028");
  return { id: "cbam", status: "indirect", firstYear: 2026, dates, notes, sources };
}

export function trEts(p: Profile): Finding {
  const sources = ["climate_law", "tr_ets_reg", "kpk_2026_1"];
  if (p.annualEmissionsTco2e <= 0) return { id: "tr_ets", status: "not_applicable", dates: [], notes: ["ets.no_emissions"], sources };
  const cat = etsCategory(p.annualEmissionsTco2e);
  const pilot = inEts(cat) && (PILOT_SECTORS as readonly string[]).includes(p.pilotSector);
  const dates = [
    { key: "ets_report", date: `${p.reportingYear + 1}-04-30` },
    { key: "ets_surrender", date: lastBusinessDayOfNovember(p.reportingYear + 1) },
  ];
  if (!inEts(cat)) return { id: "tr_ets", status: "required", firstYear: 2026, dates, notes: ["ets.category_a"], sources };
  if (pilot) {
    return {
      id: "tr_ets",
      status: "required",
      firstYear: 2026,
      dates: [{ key: "ets_monitoring_plan", date: "2026-10-27" }, ...dates],
      notes: [`ets.category_${cat.toLowerCase()}`, "ets.pilot", "ets.pilot_free"],
      sources,
    };
  }
  return { id: "tr_ets", status: "review", dates, notes: [`ets.category_${cat.toLowerCase()}`, "ets.non_pilot_sector"], sources };
}

export function annualReport(p: Profile): Finding {
  const notes = ["ar.ttk"];
  const sources = ["ttk", "ar_min_content"];
  if (p.entityType === "listed") {
    notes.push("ar.spk", "ar.cg_forms");
    sources.push("spk_ii_14_1", "spk_cg_forms");
    if (p.bistMainMarkets) {
      notes.push("ar.spk_sust_template");
      sources.push("spk_sust_template");
    }
  }
  if (p.entityType === "bank" || p.entityType === "bank_tmsf") {
    notes.push("ar.bddk");
    sources.push("bddk_ar");
  }
  if (p.entityType === "public_body") return { id: "annual_report", status: "review", dates: [], notes: ["ar.public_body"], sources };
  if (p.euEntity) {
    notes.push("ar.eu_art19");
    sources.push("acc_directive");
  }
  return { id: "annual_report", status: "required", dates: [], notes, sources };
}

export function taxonomy(p: Profile): Finding {
  const fi = ["bank", "nonbank_fi", "insurer", "capital_markets_fi"].includes(p.entityType);
  const tr: Finding = fi
    ? { id: "tr_taxonomy", status: "required", firstYear: 2029, dates: [{ key: "tr_taxonomy_fi", date: "2029-01-01" }], notes: ["tax.tr_fi"], sources: ["tr_taxonomy"] }
    : { id: "tr_taxonomy", status: "voluntary", dates: [], notes: ["tax.tr_real_sector"], sources: ["tr_taxonomy"] };
  return tr;
}

export function eudr(p: Profile): Finding {
  if (!p.eudrCommodities) return { id: "eudr", status: "not_applicable", dates: [], notes: [], sources: ["eudr"] };
  return {
    id: "eudr",
    status: "required",
    dates: [{ key: "eudr_apply", date: p.smallOrMicro ? "2027-06-30" : "2026-12-30" }],
    notes: ["eudr.dds"],
    sources: ["eudr"],
  };
}

export function products(p: Profile): Finding[] {
  const out: Finding[] = [];
  if (p.dppProducts) out.push({ id: "espr_dpp", status: "review", dates: [], notes: ["dpp.pending_acts"], sources: ["espr_dpp"] });
  if (p.batteries) out.push({ id: "battery_passport", status: "required", dates: [{ key: "battery_passport", date: "2027-02-18" }], notes: ["battery.scope"], sources: ["battery_reg"] });
  if (p.energyToe >= 1000) out.push({ id: "energy_manager", status: "required", dates: [], notes: ["energy.manager"], sources: ["energy_eff_reg"] });
  return out;
}

export function evaluate(p: Profile): Finding[] {
  return [annualReport(p), tsrs(p), trEts(p), cbam(p), csrd(p), csddd(p), taxonomy(p), eudr(p), ...products(p)];
}
