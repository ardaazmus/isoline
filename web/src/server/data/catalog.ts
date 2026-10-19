/**
 * Metric definition catalogue (G3-01): what each data point means for collection — dimension and units, how it
 * aggregates over facilities and months (a flow is summed, a year-end balance takes the last value, an average
 * stays an average), whether it is collected per facility or for the organisation, whether evidence is
 * required, and whether it is personal data (totals only, KVKK md. 6). Built on the toolkit's DATA_POINTS so the
 * template traces stay the same. A change of meaning is a new version, never an edit (rows are append-only).
 */
import { DATA_POINTS, type DataPoint } from "@/lib/requests";
import { FUELS } from "@/lib/calc/ghg";
import type { Dimension } from "./units";

export type Aggregation = "sum" | "last" | "average" | "none";
export type Grain = "facility" | "organization";

export type MetricDef = {
  code: string;
  version: number;
  section: string;
  role: string;
  /** Unit key of the toolkit (labels: req.units.<key>). */
  unitKey: string;
  dimensions: Dimension[];
  aggregation: Aggregation;
  grain: Grain;
  periodKind: DataPoint["when"];
  crosswalk: string | null;
  sensitive: boolean;
  evidenceRequired: boolean;
  /** Several lines per submission (e.g. one per fuel); `lineKeys` lists the allowed line keys, empty = free text. */
  multiline: boolean;
  lineKeys: string[];
};

export const CATALOG_VERSION = "2026.10.19";

const FUEL_KEYS = Object.keys(FUELS);

/** Collection details per data point; anything not listed takes the defaults in `define`. */
const DETAILS: Record<string, Partial<MetricDef>> = {
  ghg_stationary: { dimensions: ["volume", "mass", "energy"], grain: "facility", multiline: true, lineKeys: FUEL_KEYS },
  ghg_mobile: { dimensions: ["volume"], grain: "organization", multiline: true, lineKeys: ["diesel", "gasoline", "lpg"] },
  ghg_process: { dimensions: ["emissions"], grain: "facility" },
  ghg_refrigerants: { dimensions: ["mass"], grain: "facility", multiline: true },
  ghg_electricity: { dimensions: ["energy"], grain: "facility" },
  ghg_certificates: { dimensions: ["energy"], grain: "organization" },
  ghg_purchases: { dimensions: ["mass", "money"], grain: "organization", multiline: true },
  ghg_transport: { dimensions: ["distance_mass"], grain: "organization" },
  ghg_travel: { dimensions: ["distance_people"], grain: "organization" },
  ghg_production: { dimensions: ["mass"], grain: "facility" },
  net_sales: { dimensions: ["money"], grain: "organization" },
  cbam_goods: { dimensions: ["mass"], grain: "facility", multiline: true },
  cbam_see: { dimensions: ["intensity"], grain: "facility", aggregation: "none", multiline: true },
  cbam_price_paid: { dimensions: ["intensity"], grain: "organization", aggregation: "none" },
  ets_emissions: { dimensions: ["emissions"], grain: "facility" },
  ets_activity: { dimensions: ["mass"], grain: "facility" },
  pathway_base: { dimensions: ["emissions"], grain: "organization", aggregation: "none" },
  pathway_actuals: { dimensions: ["emissions"], grain: "organization", aggregation: "none", multiline: true },
  pathway_measures: { dimensions: ["none"], grain: "organization", aggregation: "none", evidenceRequired: false },
  pathway_target: { dimensions: ["none"], grain: "organization", aggregation: "none", evidenceRequired: false },
  mat_stakeholders: { dimensions: ["none"], grain: "organization", aggregation: "none" },
  mat_risks: { dimensions: ["none"], grain: "organization", aggregation: "none" },
  env_energy: { dimensions: ["energy"], grain: "facility" },
  env_renewable: { dimensions: ["energy"], grain: "facility" },
  env_water_withdrawal: { dimensions: ["volume"], grain: "facility" },
  env_water_discharge: { dimensions: ["volume"], grain: "facility" },
  env_water_stress: { dimensions: ["percent"], grain: "facility", aggregation: "none" },
  env_waste: { dimensions: ["mass"], grain: "facility" },
  work_headcount: { dimensions: ["people"], grain: "organization", aggregation: "last" },
  work_diversity: { dimensions: ["people"], grain: "organization", aggregation: "last" },
  work_pay: { dimensions: ["money"], grain: "organization", aggregation: "average" },
  work_training: { dimensions: ["hours"], grain: "organization" },
  ohs_hours: { dimensions: ["hours"], grain: "facility" },
  ohs_incidents: { dimensions: ["count"], grain: "facility" },
  tax_totals: { dimensions: ["money"], grain: "organization", multiline: true, lineKeys: ["turnover", "capex", "opex"] },
  tax_activities: { dimensions: ["money"], grain: "organization", multiline: true },
  tax_screening: { dimensions: ["none"], grain: "organization", aggregation: "none" },
  tb_export: { dimensions: ["none"], grain: "organization", aggregation: "none" },
  rec_prior: { dimensions: ["none"], grain: "organization", aggregation: "none", evidenceRequired: false },
};

function define(dp: DataPoint): MetricDef {
  const d = DETAILS[dp.id] ?? {};
  return {
    code: dp.id,
    version: 1,
    section: dp.section,
    role: dp.role,
    unitKey: dp.unit,
    dimensions: d.dimensions ?? ["none"],
    aggregation: d.aggregation ?? "sum",
    grain: d.grain ?? "organization",
    periodKind: dp.when,
    crosswalk: dp.cw ?? null,
    sensitive: dp.sensitive ?? false,
    evidenceRequired: d.evidenceRequired ?? true,
    multiline: d.multiline ?? false,
    lineKeys: d.lineKeys ?? [],
  };
}

export const METRICS: MetricDef[] = DATA_POINTS.map(define);
export const METRIC = new Map(METRICS.map((m) => [m.code, m]));
