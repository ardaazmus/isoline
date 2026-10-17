import type { ThemeId } from "./themes";

/**
 * Framework crosswalk at datapoint-group level. References use the IFRS S2 (TSRS 2) paragraphs,
 * GRI disclosure numbers valid for 2026 reports (GRI 102/103 replace 305/302 from 2027),
 * ESRS 2023 numbering (the revised 2026 set may renumber) and the VSME module codes.
 * "—" means no direct counterpart.
 */
export type CrossRow = { id: string; theme: ThemeId; tool?: string; tsrs: string; gri: string; esrs: string; vss: string; cdp: string };

export const CROSSWALK: CrossRow[] = [
  { id: "governance", theme: "governance", tsrs: "TSRS 2 ¶ 6", gri: "2-9, 2-12, 2-13", esrs: "ESRS 2 GOV-1, GOV-2", vss: "—", cdp: "M4" },
  { id: "risks_opps", theme: "climate", tool: "materiality", tsrs: "TSRS 2 ¶ 10–12", gri: "201-2", esrs: "ESRS 2 IRO-1, SBM-3", vss: "C4", cdp: "M2, M3" },
  { id: "transition_plan", theme: "climate", tool: "pathway", tsrs: "TSRS 2 ¶ 14(a)(iv)", gri: "GRI 102 (2027)", esrs: "E1-1", vss: "C3", cdp: "M5" },
  { id: "resilience", theme: "climate", tsrs: "TSRS 2 ¶ 22", gri: "201-2", esrs: "E1 SBM-3", vss: "—", cdp: "M5" },
  { id: "scope1", theme: "climate", tool: "ghg", tsrs: "TSRS 2 ¶ 29(a)(i)(1)", gri: "305-1", esrs: "E1-6", vss: "B3", cdp: "M7" },
  { id: "scope2", theme: "climate", tool: "ghg", tsrs: "TSRS 2 ¶ 29(a)(i)(2), (v)", gri: "305-2", esrs: "E1-6", vss: "B3", cdp: "M7" },
  { id: "scope3", theme: "valuechain", tool: "ghg", tsrs: "TSRS 2 ¶ 29(a)(i)(3), (vi)", gri: "305-3", esrs: "E1-6", vss: "—", cdp: "M7" },
  { id: "intensity", theme: "climate", tool: "ghg", tsrs: "TSRS 2 ¶ 29(a)", gri: "305-4", esrs: "E1-6", vss: "B3", cdp: "M7" },
  { id: "energy", theme: "energy", tool: "environment", tsrs: "Sektör metrikleri (TSRS 2 ¶ 32)", gri: "302-1", esrs: "E1-5", vss: "B3", cdp: "M7" },
  { id: "carbon_price", theme: "climate", tool: "cbam", tsrs: "TSRS 2 ¶ 29(f)", gri: "—", esrs: "E1-8", vss: "—", cdp: "M5" },
  { id: "transition_risk_amounts", theme: "economy", tool: "cbam", tsrs: "TSRS 2 ¶ 29(b)", gri: "201-2", esrs: "E1-9", vss: "—", cdp: "M3" },
  { id: "targets", theme: "climate", tool: "pathway", tsrs: "TSRS 2 ¶ 33–36", gri: "305-5", esrs: "E1-4", vss: "C3", cdp: "M7" },
  { id: "water", theme: "water", tool: "environment", tsrs: "—", gri: "303-3, 303-5", esrs: "E3-4", vss: "B6", cdp: "M9" },
  { id: "waste", theme: "circularity", tool: "environment", tsrs: "—", gri: "306-3, 306-4", esrs: "E5-5", vss: "B7", cdp: "—" },
  { id: "biodiversity", theme: "nature", tsrs: "—", gri: "GRI 101", esrs: "E4", vss: "B5", cdp: "M11" },
  { id: "taxonomy", theme: "economy", tool: "taxonomy", tsrs: "—", gri: "—", esrs: "Taksonomi eki (2026/73)", vss: "—", cdp: "M5" },
  { id: "health_safety", theme: "people", tool: "workforce", tsrs: "—", gri: "403-9", esrs: "S1-14", vss: "B9", cdp: "—" },
  { id: "training", theme: "people", tool: "workforce", tsrs: "—", gri: "404-1", esrs: "S1-13", vss: "B10", cdp: "—" },
  { id: "pay_gap", theme: "people", tool: "workforce", tsrs: "—", gri: "405-2", esrs: "S1-16", vss: "B10", cdp: "—" },
  { id: "corruption", theme: "governance", tsrs: "—", gri: "205-3", esrs: "G1-4", vss: "B11", cdp: "—" },
];
