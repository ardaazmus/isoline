import type { Family } from "./nav";
import type { CrossCol } from "./crosswalk";
/**
 * Report template library. Section titles and guidance live in messages under
 * tpl.<template>.sections.<section>.title / .guide; references stay untranslated.
 * Tools named in `tools` feed the section with computed figures. `points` narrows a section to the crosswalk
 * data points its references name (e.g. Scope 1 and 2 only), so the data request list does not ask for more.
 */
export type TemplateSection = { id: string; refs: string[]; tools?: string[]; points?: string[] };
export type Template = {
  id: string;
  kind: "sustainability" | "annual" | "carbon" | "finance";
  family: Family;
  /** The crosswalk column of the template's framework; a data point with no counterpart there ("—") is not needed. */
  crosswalk?: CrossCol;
  sources: string[];
  /** "review" = structure derived from secondary sources; confirm before use. */
  status: "verified" | "review";
  sections: TemplateSection[];
};

export const TEMPLATES: Template[] = [
  {
    id: "tsrs_full",
    kind: "sustainability",
    family: "reporting",
    crosswalk: "tsrs",
    sources: ["tsrs1", "tsrs2", "kgk_scope_decision"],
    status: "verified",
    sections: [
      { id: "basis", refs: ["TSRS 1 ¶ 20–24, 64–72"], tools: ["reconciliation"] },
      { id: "governance", refs: ["TSRS 1 ¶ 26–27", "TSRS 2 ¶ 5–7"] },
      { id: "strategy_ro", refs: ["TSRS 1 ¶ 28–31", "TSRS 2 ¶ 8–12"], tools: ["materiality"] },
      { id: "business_model", refs: ["TSRS 1 ¶ 32", "TSRS 2 ¶ 13"] },
      { id: "transition_plan", refs: ["TSRS 2 ¶ 14"], tools: ["pathway"] },
      { id: "financial_effects", refs: ["TSRS 1 ¶ 34–40", "TSRS 2 ¶ 15–21"], tools: ["cbam", "ets"] },
      { id: "resilience", refs: ["TSRS 2 ¶ 22"] },
      { id: "risk_management", refs: ["TSRS 1 ¶ 43–44", "TSRS 2 ¶ 24–26"] },
      { id: "ghg", refs: ["TSRS 2 ¶ 29(a)"], tools: ["ghg"] },
      { id: "cross_industry", refs: ["TSRS 2 ¶ 29(b)–(g)"], tools: ["cbam", "taxonomy"] },
      { id: "industry_metrics", refs: ["TSRS 2 ¶ 32"] },
      { id: "targets", refs: ["TSRS 2 ¶ 33–36"], tools: ["pathway"] },
      { id: "assurance", refs: ["KGK güvence denetimi (RG 32653)"] },
    ],
  },
  {
    id: "tsrs_climate_first",
    kind: "sustainability",
    family: "reporting",
    crosswalk: "tsrs",
    sources: ["tsrs1", "tsrs2", "kgk_relief_ext"],
    status: "verified",
    sections: [
      { id: "basis_reliefs", refs: ["TSRS 1 Ek E (E3–E6)", "Kapsam Kararı Geçici md. 1–3"] },
      { id: "governance", refs: ["TSRS 2 ¶ 5–7"] },
      { id: "strategy_ro", refs: ["TSRS 2 ¶ 8–12"] },
      { id: "transition_plan", refs: ["TSRS 2 ¶ 14"], tools: ["pathway"] },
      { id: "risk_management", refs: ["TSRS 2 ¶ 24–26"] },
      { id: "ghg_s12", refs: ["TSRS 2 ¶ 29(a)(i)(1)–(2)"], tools: ["ghg"], points: ["scope1", "scope2"] },
      { id: "targets", refs: ["TSRS 2 ¶ 33–36"], tools: ["pathway"] },
    ],
  },
  {
    id: "gri",
    kind: "sustainability",
    family: "people",
    crosswalk: "gri",
    sources: ["gri_standards"],
    status: "verified",
    sections: [
      { id: "statement_of_use", refs: ["GRI 1 Req. 1–9"] },
      { id: "org_practices", refs: ["GRI 2-1 – 2-5"] },
      { id: "activities_workers", refs: ["GRI 2-6 – 2-8"], tools: ["workforce"] },
      { id: "governance_gri", refs: ["GRI 2-9 – 2-21"] },
      { id: "strategy_policies", refs: ["GRI 2-22 – 2-28"] },
      { id: "stakeholders", refs: ["GRI 2-29 – 2-30"] },
      { id: "material_topics", refs: ["GRI 3-1 – 3-3"], tools: ["materiality"] },
      { id: "climate_energy", refs: ["GRI 102 / GRI 103 (2027)", "GRI 305 / 302 (2026)"], tools: ["ghg", "environment"], points: ["scope1", "scope2", "scope3", "intensity", "energy"] },
      { id: "water_waste", refs: ["GRI 303", "GRI 306"], tools: ["environment"], points: ["water", "waste"] },
      { id: "biodiversity", refs: ["GRI 101 (2026)"] },
      { id: "people_gri", refs: ["GRI 401, 403, 404, 405"], tools: ["workforce"] },
      { id: "content_index", refs: ["GRI 1 Req. 7"] },
    ],
  },
  {
    id: "esrs_2026",
    kind: "sustainability",
    family: "reporting",
    crosswalk: "esrs",
    sources: ["esrs_2026", "csrd_omnibus", "taxonomy_2026_73"],
    status: "review",
    sections: [
      { id: "exec_summary", refs: ["ESRS 1 (2026) ¶ 110"] },
      { id: "general", refs: ["ESRS 2"], tools: ["materiality"] },
      { id: "environment_esrs", refs: ["ESRS E1–E5"], tools: ["ghg", "pathway", "environment"] },
      { id: "taxonomy_annex", refs: ["ESRS 1 (2026) ¶ 106", "Del. Reg. 2026/73"], tools: ["taxonomy"] },
      { id: "social_esrs", refs: ["ESRS S1–S4"], tools: ["workforce"] },
      { id: "governance_esrs", refs: ["ESRS G1"] },
      { id: "version_statement", refs: ["FY2026 geçiş seçenekleri"] },
    ],
  },
  {
    id: "vss",
    kind: "sustainability",
    family: "people",
    crosswalk: "vss",
    sources: ["vss_2026"],
    status: "review",
    sections: [
      { id: "b1", refs: ["B1"] },
      { id: "b2", refs: ["B2"] },
      { id: "b3", refs: ["B3"], tools: ["ghg", "environment"], points: ["scope1", "scope2", "intensity", "energy"] },
      { id: "b4_b7", refs: ["B4–B7"], tools: ["environment"], points: ["water", "waste"] },
      { id: "b8_b10", refs: ["B8–B10"], tools: ["workforce"] },
      { id: "b11", refs: ["B11"] },
      { id: "c1_c4", refs: ["C1–C4"], tools: ["pathway"] },
      { id: "c5_c9", refs: ["C5–C9"] },
    ],
  },
  {
    id: "cbam_operator_pack",
    kind: "carbon",
    family: "climate",
    sources: ["cbam_reg", "cbam_defaults", "cbam_guidance3"],
    status: "review",
    sections: [
      { id: "installation", refs: ["Impl. Reg. 2025/2547"] },
      { id: "goods_routes", refs: ["Reg. 2023/956 Annex I"] },
      { id: "attributed", refs: ["Guidance No. 3, Eq. 55–58"], tools: ["ghg"], points: ["scope1", "scope2"] },
      { id: "precursors", refs: ["Guidance No. 3, Eq. 59–62"] },
      { id: "see", refs: ["Guidance No. 3, Eq. 59–63"], tools: ["cbam"] },
      { id: "electricity_cbam", refs: ["Reg. 2023/956 Annex IV"] },
      { id: "carbon_price_paid", refs: ["Reg. 2023/956 Art. 9"], tools: ["ets"] },
      { id: "verification", refs: ["Impl. Reg. 2025/2546", "Del. Reg. 2025/2551"] },
    ],
  },
  {
    id: "tr_ets_mp",
    kind: "carbon",
    family: "climate",
    sources: ["tr_ets_reg", "kpk_2026_1"],
    status: "review",
    sections: [
      { id: "mp_installation", refs: ["TR ETS Yön. (RG 33353)"] },
      { id: "mp_sources", refs: ["TR ETS Yön."], tools: ["ghg"], points: ["scope1"] },
      { id: "mp_tiers", refs: ["TR ETS Yön."] },
      { id: "mp_dataflow", refs: ["TR ETS Yön."] },
      { id: "mp_allocation", refs: ["TR ETS Yön. md. 13/7"], tools: ["ets"] },
      { id: "mp_calendar", refs: ["GM3 · md. 30 Nisan · Kasım son iş günü"] },
    ],
  },
  {
    id: "ar_ttk",
    kind: "annual",
    family: "reporting",
    sources: ["ar_min_content", "ttk"],
    status: "verified",
    sections: [
      { id: "ar_general", refs: ["Yön. md. 8"] },
      { id: "ar_rights", refs: ["Yön. md. 9"] },
      { id: "ar_rnd", refs: ["Yön. md. 10"] },
      { id: "ar_activities", refs: ["Yön. md. 11"] },
      { id: "ar_financial", refs: ["Yön. md. 12"], tools: ["trialBalance"] },
      { id: "ar_risks", refs: ["Yön. md. 13"] },
      { id: "ar_other", refs: ["Yön. md. 14–15"] },
      { id: "ar_sustainability_summary", refs: ["TSRS / GRI özeti"], tools: ["ghg", "workforce", "environment"] },
    ],
  },
  {
    id: "ar_listed",
    kind: "annual",
    family: "reporting",
    sources: ["ar_min_content", "spk_ii_14_1", "spk_cg_forms", "spk_sust_template"],
    status: "review",
    sections: [
      { id: "ar_highlights", refs: ["SPK II-14.1"], tools: ["ghg", "cbam"] },
      { id: "ar_chair_ceo", refs: ["—"] },
      { id: "ar_general", refs: ["Yön. md. 8"] },
      { id: "ar_activities", refs: ["Yön. md. 11"] },
      { id: "ar_financial", refs: ["Yön. md. 12"], tools: ["trialBalance"] },
      { id: "ar_risks", refs: ["Yön. md. 13 · RESK"] },
      { id: "ar_cg", refs: ["SPK II-17.1 · URF / KYBF"] },
      { id: "ar_sust_compliance", refs: ["SPK Sürdürülebilirlik İlkeleri Uyum Çerçevesi"] },
      { id: "ar_investor", refs: ["SPK II-17.1"] },
      { id: "ar_statements", refs: ["SPK II-14.1"] },
    ],
  },
  {
    id: "cdp_climate",
    kind: "sustainability",
    family: "climate",
    crosswalk: "cdp",
    sources: ["cdp_2026"],
    status: "review",
    sections: [
      { id: "cdp_m1", refs: ["M1"] },
      { id: "cdp_m2_m3", refs: ["M2–M3"], tools: ["materiality"] },
      { id: "cdp_m4", refs: ["M4"] },
      { id: "cdp_m5", refs: ["M5"], tools: ["pathway"] },
      { id: "cdp_m6_m7", refs: ["M6–M7"], tools: ["ghg"] },
      { id: "cdp_m13", refs: ["M13"] },
    ],
  },
  {
    id: "green_bond",
    kind: "finance",
    family: "environment",
    sources: ["spk_green_guides"],
    status: "review",
    sections: [
      { id: "gb_use", refs: ["ICMA GBP 1"], tools: ["taxonomy"] },
      { id: "gb_selection", refs: ["ICMA GBP 2"] },
      { id: "gb_management", refs: ["ICMA GBP 3"] },
      { id: "gb_reporting", refs: ["ICMA GBP 4"], tools: ["ghg"] },
      { id: "gb_review", refs: ["SPK Rehberi (13.08.2026)"] },
    ],
  },
];
