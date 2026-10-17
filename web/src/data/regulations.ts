import type { Confidence } from "./sources";

export type Lane = "tr_reporting" | "tr_carbon" | "eu_reporting" | "eu_carbon" | "eu_product" | "global";

export type RegEvent = {
  id: string;
  lane: Lane;
  date: string;
  /** True when the date is a quarter or approximate target rather than a legal deadline. */
  approx?: boolean;
  source: string;
  confidence: Confidence;
};

/** Regulatory calendar. Labels live in messages under reg.events.<id>. */
export const EVENTS: RegEvent[] = [
  // Türkiye — raporlama
  { id: "tsrs_thresholds_2026", lane: "tr_reporting", date: "2026-01-16", source: "kgk_scope_2026", confidence: "official" },
  { id: "tsrs2_amend_published", lane: "tr_reporting", date: "2026-07-28", source: "tsrs2_amend", confidence: "official" },
  { id: "tsrs2_amend_effective", lane: "tr_reporting", date: "2027-01-01", source: "tsrs2_amend", confidence: "official" },
  { id: "tr_taxonomy_published", lane: "tr_reporting", date: "2026-09-24", source: "tr_taxonomy", confidence: "secondary" },
  { id: "tr_taxonomy_fi", lane: "tr_reporting", date: "2029-01-01", source: "tr_taxonomy", confidence: "secondary" },
  { id: "spk_green_guides", lane: "tr_reporting", date: "2026-08-13", source: "spk_green_guides", confidence: "secondary" },
  // Türkiye — karbon
  { id: "climate_law", lane: "tr_carbon", date: "2025-07-09", source: "climate_law", confidence: "official" },
  { id: "tr_ets_reg", lane: "tr_carbon", date: "2026-08-27", source: "tr_ets_reg", confidence: "official" },
  { id: "tr_ets_mp", lane: "tr_carbon", date: "2026-10-27", source: "tr_ets_reg", confidence: "official" },
  { id: "tr_ets_price", lane: "tr_carbon", date: "2027-01-01", source: "kpk_2026_1", confidence: "official" },
  { id: "tr_ets_report_2026", lane: "tr_carbon", date: "2027-04-30", source: "tr_ets_reg", confidence: "official" },
  { id: "tr_local_plans", lane: "tr_carbon", date: "2027-12-31", source: "climate_law", confidence: "official" },
  { id: "tr_ets_permit", lane: "tr_carbon", date: "2028-07-09", source: "climate_law", confidence: "official" },
  // AB — raporlama
  { id: "omnibus_in_force", lane: "eu_reporting", date: "2026-03-18", source: "csrd_omnibus", confidence: "official" },
  { id: "vss_in_force", lane: "eu_reporting", date: "2026-09-24", source: "vss_2026", confidence: "official" },
  { id: "esrs_2026_in_force", lane: "eu_reporting", date: "2026-11-10", source: "esrs_2026", confidence: "official" },
  { id: "esrs_xbrl_consultation", lane: "eu_reporting", date: "2026-11-11", source: "esrs_xbrl", confidence: "official" },
  { id: "value_chain_cap", lane: "eu_reporting", date: "2027-01-01", source: "vss_2026", confidence: "official" },
  { id: "csrd_transposition", lane: "eu_reporting", date: "2027-03-19", source: "csrd_omnibus", confidence: "official" },
  { id: "assurance_standards", lane: "eu_reporting", date: "2027-07-01", source: "csrd_omnibus", confidence: "official" },
  { id: "csrd_first_reports", lane: "eu_reporting", date: "2028-01-01", source: "csrd_omnibus", confidence: "official" },
  { id: "csrd_non_eu", lane: "eu_reporting", date: "2029-01-01", source: "csrd_omnibus", confidence: "official" },
  { id: "csddd_apply", lane: "eu_reporting", date: "2029-07-26", source: "csrd_omnibus", confidence: "official" },
  // AB — karbon
  { id: "cbam_definitive", lane: "eu_carbon", date: "2026-01-01", source: "cbam_reg", confidence: "official" },
  { id: "cbam_cert_sales", lane: "eu_carbon", date: "2027-02-01", source: "cbam_price", confidence: "official" },
  { id: "cbam_first_declaration", lane: "eu_carbon", date: "2027-09-30", source: "cbam_reg", confidence: "secondary" },
  { id: "ets2_start", lane: "eu_carbon", date: "2028-01-01", source: "ets2", confidence: "secondary" },
  { id: "cbam_downstream", lane: "eu_carbon", date: "2028-01-01", source: "cbam_downstream", confidence: "secondary" },
  { id: "cbam_full", lane: "eu_carbon", date: "2034-01-01", source: "cbam_factor", confidence: "official" },
  // AB — ürün
  { id: "ecgt_apply", lane: "eu_product", date: "2026-09-27", source: "ecgt", confidence: "secondary" },
  { id: "eudr_large", lane: "eu_product", date: "2026-12-30", source: "eudr", confidence: "official" },
  { id: "battery_passport", lane: "eu_product", date: "2027-02-18", source: "battery_reg", confidence: "secondary" },
  { id: "eudr_small", lane: "eu_product", date: "2027-06-30", source: "eudr", confidence: "official" },
  { id: "dpp_steel", lane: "eu_product", date: "2026-12-31", approx: true, source: "espr_dpp", confidence: "secondary" },
  // Küresel
  { id: "gri_101", lane: "global", date: "2026-01-01", source: "gri_standards", confidence: "official" },
  { id: "cdp_2026", lane: "global", date: "2026-10-26", source: "cdp_2026", confidence: "secondary" },
  { id: "gri_102_103", lane: "global", date: "2027-01-01", source: "gri_standards", confidence: "official" },
  { id: "ifrs_s2_amend", lane: "global", date: "2027-01-01", source: "ifrs_s2", confidence: "secondary" },
  { id: "sbti_v2", lane: "global", date: "2027-01-31", source: "sbti_v2", confidence: "official" },
  { id: "ghg_draft", lane: "global", date: "2027-06-30", approx: true, source: "ghg_revision", confidence: "official" },
  { id: "ghg_final", lane: "global", date: "2028-12-31", approx: true, source: "ghg_revision", confidence: "official" },
];

export const LANES: { id: Lane; color: string }[] = [
  { id: "tr_reporting", color: "var(--report)" },
  { id: "tr_carbon", color: "var(--carbon)" },
  { id: "eu_reporting", color: "var(--report-2)" },
  { id: "eu_carbon", color: "var(--carbon-2)" },
  { id: "eu_product", color: "var(--hydro)" },
  { id: "global", color: "var(--forest)" },
];
