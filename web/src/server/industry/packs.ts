/**
 * Industry packs (G7-04..06; plan 08). Declarative, versioned data modules on top of the common engine: which
 * activities they apply to (NACE Rev. 2 codes on the facility), the data items to collect (with "mandatory" only
 * where a published standard or regulation requires it, "recommended" for ISOLINE's methodology), the pack
 * formulas, the material topics and the report blocks. A holding may switch on several packs, each for the
 * facilities (activities) it covers. These are ISOLINE methodology templates — none is sold as an official GRI
 * sector standard (GRI 11–14 are the only published ones, and none of these four is among them).
 */
import type { MetricDef } from "../data/catalog";

export type PackMetric = { code: string; status: "mandatory" | "recommended"; basis: string };
export type IndustryPack = {
  id: string;
  version: string;
  code: string;
  /** NACE Rev. 2 prefixes the pack suggests itself for (facility.nace_code). */
  nace: string[];
  standardStatus: "methodology" | "official" | "under_development";
  standardRefs: string[];
  metrics: PackMetric[];
  topics: string[];
  reportBlocks: string[];
  verifiedAt: string;
};

export const PACKS: IndustryPack[] = [
  {
    id: "steel",
    version: "2026.10",
    code: "IND-01",
    nace: ["24.1", "24.2", "24.3", "24.51", "24.52"],
    standardStatus: "methodology",
    standardRefs: ["worldsteel CO₂ data collection methodology v11 (crude steel basis)", "EU 2023/956 CBAM Annex I (iron and steel)", "SASB EM-IS (Iron & Steel Producers)"],
    metrics: [
      { code: "ind_steel_crude_production", status: "recommended", basis: "worldsteel: intensity per tonne of crude steel" },
      { code: "ind_steel_scrap_input", status: "recommended", basis: "SASB EM-IS-130a.1 (raw material sourcing), worldsteel" },
      { code: "ghg_process", status: "recommended", basis: "GHG Protocol process emissions" },
      { code: "cbam_goods", status: "mandatory", basis: "EU 2023/956 Art. 35: operator data for goods exported to the EU" },
      { code: "cbam_see", status: "mandatory", basis: "EU 2023/956 Annex IV: specific embedded emissions" },
    ],
    topics: ["climate_transition", "energy", "air_emissions", "ohs", "circularity_scrap"],
    reportBlocks: ["ind.steel.ghg_intensity", "ind.steel.scrap_share"],
    verifiedAt: "2026-10-19",
  },
  {
    id: "cement",
    version: "2026.10",
    code: "IND-02",
    nace: ["23.51", "23.52"],
    standardStatus: "methodology",
    standardRefs: ["IPCC 2006 Vol. 3 ch. 2.2 (cement: Tier 1 clinker EF 0.52 tCO₂/t, CKD correction 1.02)", "GCCA Sustainability Guidelines for CO₂ (clinker ratio)", "EU 2023/956 CBAM Annex I (cement)"],
    metrics: [
      { code: "ind_clinker_production", status: "recommended", basis: "IPCC 2006 Vol. 3 eq. 2.2 activity data" },
      { code: "ind_cement_production", status: "recommended", basis: "GCCA clinker-to-cement ratio" },
      { code: "ghg_process", status: "recommended", basis: "Tier 2/3 calcination measured at the plant" },
      { code: "cbam_goods", status: "mandatory", basis: "EU 2023/956 Art. 35" },
    ],
    topics: ["climate_transition", "air_emissions", "quarry_biodiversity", "ohs"],
    reportBlocks: ["ind.cement.clinker_ratio", "ind.cement.calcination_tco2"],
    verifiedAt: "2026-10-19",
  },
  {
    id: "logistics",
    version: "2026.10",
    code: "IND-13",
    nace: ["49.3", "49.4", "50.2", "51.2", "52.1", "52.2", "53"],
    standardStatus: "methodology",
    standardRefs: ["ISO 14083:2023 (transport chain emissions)", "GLEC Framework v3 (gCO₂e per tkm)", "SASB TR-RO (Road Transportation)"],
    metrics: [
      { code: "ind_transport_tkm", status: "recommended", basis: "ISO 14083 transport activity (tonne-km by mode)" },
      { code: "ind_fleet_distance", status: "recommended", basis: "GLEC: distance per vehicle class" },
      { code: "ghg_mobile", status: "recommended", basis: "GHG Protocol scope 1 mobile combustion" },
    ],
    topics: ["climate_transition", "air_quality", "road_safety", "driver_working_conditions"],
    reportBlocks: ["ind.logistics.intensity", "ind.logistics.tkm"],
    verifiedAt: "2026-10-19",
  },
  {
    id: "services",
    version: "2026.10",
    code: "IND-16",
    nace: ["47", "55", "56", "68", "82"],
    standardStatus: "methodology",
    standardRefs: ["CRREM / GRESB energy intensity (kWh/m²)", "GHG Protocol scope 1 fugitive (F-gas)", "SASB CG-MR (Multiline and Specialty Retailers)"],
    metrics: [
      { code: "ind_floor_area", status: "recommended", basis: "Energy intensity denominator (kWh/m²)" },
      { code: "ghg_electricity", status: "recommended", basis: "GHG Protocol scope 2" },
      { code: "ghg_refrigerants", status: "recommended", basis: "Refrigerant leaks in cooling and cold chain" },
    ],
    topics: ["energy", "refrigerants", "customer_privacy", "labour_practices"],
    reportBlocks: ["ind.services.electricity_intensity"],
    verifiedAt: "2026-10-19",
  },
];

export const PACK = new Map(PACKS.map((p) => [p.id, p]));

/** Pack-only data items, appended to the metric catalogue (the toolkit's data points stay as they are). */
export const PACK_METRICS: MetricDef[] = [
  { code: "ind_steel_crude_production", unitKey: "t", dimensions: ["mass"], grain: "facility", aggregation: "sum" },
  { code: "ind_steel_scrap_input", unitKey: "t", dimensions: ["mass"], grain: "facility", aggregation: "sum" },
  { code: "ind_clinker_production", unitKey: "t", dimensions: ["mass"], grain: "facility", aggregation: "sum" },
  { code: "ind_cement_production", unitKey: "t", dimensions: ["mass"], grain: "facility", aggregation: "sum" },
  { code: "ind_transport_tkm", unitKey: "tkm", dimensions: ["distance_mass"], grain: "organization", aggregation: "sum", multiline: true, lineKeys: ["road", "rail", "sea", "inland_waterway", "air"] },
  { code: "ind_fleet_distance", unitKey: "km", dimensions: ["distance"], grain: "organization", aggregation: "sum", multiline: true, lineKeys: ["light_commercial", "rigid_truck", "articulated_truck", "bus", "car"] },
  { code: "ind_floor_area", unitKey: "m2", dimensions: ["area"], grain: "facility", aggregation: "last" },
].map((m) => ({ version: 1, section: "industry", role: "production", periodKind: "year" as const, crosswalk: null, sensitive: false, evidenceRequired: true, multiline: false, lineKeys: [], ...m }) as MetricDef);

/** Packs whose NACE prefixes match a facility's activity code ("24.10" → steel). */
export function suggestPacks(naceCodes: (string | null)[]): string[] {
  const codes = naceCodes.filter(Boolean).map((c) => c!.replace(/^[A-Z]/, "").trim());
  return PACKS.filter((p) => codes.some((c) => p.nace.some((n) => c === n || c.startsWith(`${n}`)))).map((p) => p.id);
}
