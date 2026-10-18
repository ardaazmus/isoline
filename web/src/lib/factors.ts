/**
 * Emission factor library. Built-in sets carry only open-licence or official public-sector data with their
 * publisher, licence, URL and as-of date. Customers add their own sets ("bring your own data"), for example
 * licensed IEA factors; such a set can only be used after the user confirms they hold the right to use it,
 * which keeps the licence responsibility with the user. Custom sets live in the workspace, not in the product.
 */
import { ETKB_EDITIONS, FUELS, GWP_AR6, GWP_AR6_COMBUSTION, type FuelId } from "./calc/ghg";
import cbamTr from "@/data/factors/eu-cbam-defaults-tr.json";
import eeaGrid from "@/data/factors/eea-grid-intensity.json";
import desnz2026 from "@/data/factors/desnz-2026.json";
import cbamCountries from "@/data/factors/eu-cbam-defaults-countries.json";
import tuikNir2026 from "@/data/factors/tuik-nir-2026.json";

export type FactorKind = "fuel_co2" | "grid" | "gwp" | "scope3" | "cbam_default";

export const FACTOR_KINDS: FactorKind[] = ["fuel_co2", "grid", "gwp", "scope3", "cbam_default"];

/** Canonical unit of `value` per kind. */
export const KIND_UNIT: Record<FactorKind, string> = {
  fuel_co2: "tCO₂/TJ",
  grid: "tCO₂e/MWh",
  gwp: "GWP100",
  scope3: "tCO₂e/unit",
  cbam_default: "tCO₂e/t",
};

export type Factor = {
  id: string;
  kind: FactorKind;
  /** What the factor applies to: fuel id, grid area, gas, CN code or a free scope 3 key. */
  key: string;
  label: string;
  value: number;
  /** Activity unit for scope 3 (t, km, TRY…); fuel unit for fuels. */
  unit?: string;
  /** Fuels: net calorific value, GJ per unit. */
  ncv?: number;
  /** Fuels: CH₄ and N₂O, kg/TJ, when the source gives them; picking the factor then sets them on the line. */
  ch4?: number;
  n2o?: number;
  /**
   * CBAM defaults: direct and indirect parts, tCO₂e/t, kept for information. `value` is the total column, the
   * figure Implementing Regulation (EU) 2026/1740 applies (with the mark-up) when default values are used.
   */
  direct?: number;
  indirect?: number;
  /** CBAM defaults: the country table shows "–", so the "Other Countries and Territories" value applies. */
  otherCountries?: boolean;
  /** Scope 3: the GHG Protocol categories the factor suits; the picker offers it on lines of these categories. */
  categories?: number[];
  year?: number;
};

export type LicenceClass = "open" | "public_sector" | "user_licensed";

export type FactorSet = {
  id: string;
  name: string;
  publisher: string;
  licence: LicenceClass;
  licenceNote: string;
  url: string;
  asOf: string;
  origin: "builtin" | "custom";
  /** Custom sets: the user confirmed they may use these factors. Built-in sets are always usable. */
  rightsConfirmed: boolean;
  /** i18n key of a caveat shown wherever this set's factors are picked. */
  usageNote?: string;
  /**
   * Editions: sets of one family (etkb, tuik_ncv, desnz…) differ only by `year`, the data year they cover.
   * An inventory picks the edition for its year; a later edition can replace an earlier one retroactively.
   */
  family?: string;
  year?: number;
  /** Country the set applies to (CBAM default values per country of origin; "OTHER" = other countries). */
  country?: string;
  /** Publication date of the edition. */
  published?: string;
  factors: Factor[];
};

const AS_OF = "2026-10-17";

/** IPCC 2006 Vol. 2 Table 1.4 category names for the fuels the inventory supports. */
const IPCC_FUEL_NAMES: Record<FuelId, string> = {
  natural_gas: "Natural Gas",
  diesel: "Gas/Diesel Oil",
  gasoline: "Motor Gasoline",
  lpg: "Liquefied Petroleum Gases",
  fuel_oil: "Residual Fuel Oil",
  coal: "Other Bituminous Coal",
  lignite: "Lignite",
};

/** Labels of the ETKB factors, as named in the form. */
const ETKB_LABELS: Record<string, string> = {
  "TR-generation": "Türkiye geneli elektrik üretimi",
  "TR-transmission": "İletim hattından bağlı tüketim noktası",
  "TR-distribution": "Dağıtım hattından bağlı tüketim noktası",
  "TR-plant-lignite": "Santral: linyit",
  "TR-plant-hard-coal": "Santral: taş kömürü",
  "TR-plant-asphaltite": "Santral: asfaltit",
  "TR-plant-imported-coal": "Santral: ithal kömür",
  "TR-plant-natural-gas": "Santral: doğal gaz",
  "TR-plant-fuel-oil": "Santral: fuel oil",
  "TR-plant-diesel": "Santral: motorin",
};

/** One ETKB edition; the 2023 edition keeps the id the library used before editions existed. */
function etkbSet(e: (typeof ETKB_EDITIONS)[number]): FactorSet {
  const id = `etkb_${e.year}`;
  return {
    id,
    name: `ETKB — Türkiye electricity emission factors, ${e.year}`,
    publisher: "T.C. Enerji ve Tabii Kaynaklar Bakanlığı (EVÇED)",
    licence: "public_sector",
    licenceNote: "Official public-sector data, cited with attribution.",
    url: "https://enerji.gov.tr/evced-cevre-ve-iklim-elektrik-uretim-tuketim-emisyon-faktorleri",
    asOf: e.published,
    published: e.published,
    family: "etkb",
    year: e.year,
    origin: "builtin",
    rightsConfirmed: true,
    usageNote: "factors.notes.etkb",
    factors: Object.entries(e.factors).map(([key, v]) => ({ id: `${id}:${key.replace(/^TR-/, "")}`, kind: "grid" as const, key, label: ETKB_LABELS[key] ?? key, value: v.tco2e, year: e.year })),
  };
}

/** DESNZ groups mapped to the scope 3 categories they serve (GHG Protocol Scope 3 Standard). */
const DESNZ_CATEGORIES: Record<string, number[]> = {
  freight: [4, 9],
  air_travel: [6],
  land_travel: [6, 7],
  hotel: [6],
  wtt_fuel: [3],
  waste: [5, 12],
  material: [1, 2],
};
type DesnzRow = [id: string, group: string, activity: string, type: string, sizeOrClass: string, unit: string, kgCo2e: number, sheet: string, row: number];
type TuikRow = [fuel: FuelId, nidFuel: string, unit: string, ncv: number | null, ef: number];

/** Countries of origin with their own CBAM default-value table in the library, in display order. */
export const CBAM_ORIGINS = ["TR", "CN", "IN", "UA", "EG", "OTHER"] as const;
export type CbamOrigin = (typeof CBAM_ORIGINS)[number];

/** Table names as the Annex calls them. */
const CBAM_COUNTRY_NAMES: Record<Exclude<CbamOrigin, "TR">, string> = { CN: "China", IN: "India", UA: "Ukraine", EG: "Egypt", OTHER: "Other Countries and Territories" };

type CountryRow = [cn: string, direct: number | null, indirect: number | null, total: number, otherCountries: 0 | 1, xlsxRow: string, route: string];

/** CBAM default values of one further country of origin (2026/1740 Annex I, "Other Countries" fallback applied). */
function cbamCountrySet(cc: Exclude<CbamOrigin, "TR">): FactorSet {
  const id = `eu_cbam_dv_${cc.toLowerCase()}`;
  const rows = (cbamCountries.countries as unknown as Record<string, CountryRow[]>)[cc];
  const desc = cbamCountries.descriptions as Record<string, string>;
  return {
    id,
    name: `European Commission — CBAM default values, ${CBAM_COUNTRY_NAMES[cc]} (EU 2026/1740)`,
    publisher: "European Commission (DG TAXUD)",
    licence: "open",
    licenceNote: "© European Union, CC BY 4.0 (Commission Decision 2011/833/EU).",
    url: cbamCountries.legal,
    asOf: "2026-08-06",
    published: "2026-08-06",
    family: "eu_cbam_dv",
    country: cc,
    year: 2026,
    origin: "builtin",
    rightsConfirmed: true,
    usageNote: "factors.notes.eu_cbam_dv",
    factors: rows.map(([cn, direct, indirect, total, other]) => ({
      id: `${id}:${cn}`,
      kind: "cbam_default" as const,
      key: cn,
      label: desc[cn] ?? cn,
      value: total,
      direct: direct ?? undefined,
      indirect: indirect ?? undefined,
      otherCountries: (other === 1 && cc !== "OTHER") || undefined,
    })),
  };
}

type CbamRow = [cn: string, description: string, direct: number | null, indirect: number | null, total: number, otherCountries: 0 | 1, xlsxRow: string];
type EeaRow = [code: string, country: string, year: number, gPerKwh: number];

export const BUILTIN_SETS: FactorSet[] = [
  {
    id: "ipcc_2006",
    name: "IPCC 2006 Guidelines — Vol. 2, Tables 1.2 & 1.4",
    publisher: "IPCC Task Force on National GHG Inventories",
    licence: "open",
    licenceNote: "Published guidance values, cited with attribution.",
    url: "https://www.ipcc-nggip.iges.or.jp/public/2006gl/pdf/2_Volume2/V2_1_Ch1_Introduction.pdf",
    asOf: AS_OF,
    origin: "builtin",
    rightsConfirmed: true,
    factors: (Object.keys(FUELS) as FuelId[]).map((k) => ({
      id: `ipcc_2006:${k}`,
      kind: "fuel_co2" as const,
      key: k,
      label: IPCC_FUEL_NAMES[k],
      value: FUELS[k].ef,
      unit: FUELS[k].unit,
      ncv: FUELS[k].ncv,
    })),
  },
  ...ETKB_EDITIONS.map(etkbSet),
  {
    id: "ipcc_ar6_gwp",
    name: "IPCC AR6 WG1 — GWP100 (Tables 7.15 and 7.SM.7)",
    publisher: "IPCC Working Group I",
    licence: "open",
    licenceNote: "Published assessment values, cited with attribution.",
    url: "https://www.ipcc.ch/report/ar6/wg1/downloads/report/IPCC_AR6_WGI_Chapter07_SM.pdf",
    asOf: AS_OF,
    origin: "builtin",
    rightsConfirmed: true,
    factors: [
      { id: "ipcc_ar6_gwp:CH4-fossil", kind: "gwp" as const, key: "CH4-fossil", label: "CH₄, fossil (Table 7.15)", value: GWP_AR6_COMBUSTION.ch4 },
      { id: "ipcc_ar6_gwp:N2O", kind: "gwp" as const, key: "N2O", label: "N₂O (Table 7.15)", value: GWP_AR6_COMBUSTION.n2o },
      ...Object.keys(GWP_AR6).map((g) => ({ id: `ipcc_ar6_gwp:${g}`, kind: "gwp" as const, key: g, label: g, value: GWP_AR6[g] })),
    ],
  },
  {
    // Annex I tables "Türkiye" and, where Türkiye shows "–", "Other Countries and Territories". Rows without a
    // value ("see below" headings and "–" in both tables) are left out. Source file and checksums: docs/kaynak-veri.
    id: "eu_cbam_dv_tr",
    name: "European Commission — CBAM default values, Türkiye (EU 2026/1740)",
    publisher: "European Commission (DG TAXUD)",
    licence: "open",
    licenceNote: "© European Union, CC BY 4.0 (Commission Decision 2011/833/EU).",
    url: cbamTr.url,
    asOf: "2026-08-06",
    published: "2026-08-06",
    family: "eu_cbam_dv",
    country: "TR",
    year: 2026,
    origin: "builtin",
    rightsConfirmed: true,
    usageNote: "factors.notes.eu_cbam_dv",
    factors: (cbamTr.rows as unknown as CbamRow[]).map(([cn, description, direct, indirect, total, other]) => ({
      id: `eu_cbam_dv_tr:${cn}`,
      kind: "cbam_default" as const,
      key: cn,
      label: description,
      value: total,
      direct: direct ?? undefined,
      indirect: indirect ?? undefined,
      otherCountries: other === 1 || undefined,
    })),
  },
  ...(["CN", "IN", "UA", "EG", "OTHER"] as const).map(cbamCountrySet),
  {
    // UK DESNZ conversion factors 2026, curated scope 3 subset (docs/kaynak-veri/desnz). Published per unit in
    // kg CO₂e; stored in t CO₂e per unit (÷ 1000). Air travel includes radiative forcing (RF).
    id: "desnz_2026",
    name: "UK DESNZ — GHG conversion factors 2026 (scope 3 selection)",
    publisher: "UK Department for Energy Security and Net Zero",
    licence: "open",
    licenceNote: "Open Government Licence v3.0.",
    url: desnz2026.url,
    asOf: "2026-06-11",
    published: "2026-06-11",
    family: "desnz",
    year: 2026,
    origin: "builtin",
    rightsConfirmed: true,
    usageNote: "factors.notes.desnz",
    factors: (desnz2026.rows as unknown as DesnzRow[]).map(([id, group, activity, type, size, unit, kg]) => ({
      id: `desnz_2026:${id.replace(/^desnz2026:/, "")}`,
      kind: "scope3" as const,
      key: id.replace(/^desnz2026:/, ""),
      label: [type, size].filter(Boolean).join(" · ") + ` — ${activity}`,
      value: Math.round(kg * 1e6) / 1e9,
      unit,
      categories: id.startsWith("desnz2026:water_supply") ? [1] : id.startsWith("desnz2026:water_treatment") ? [5] : DESNZ_CATEGORIES[group],
    })),
  },
  {
    // Türkiye national inventory (TÜİK, NID 2026): 2024 NCVs and CO₂ EFs (docs/kaynak-veri/tuik). Diesel and
    // gasoline carry the EF only: their NCV is per mass and the app counts litres.
    id: "tuik_nir_2024",
    name: "TÜİK — Türkiye national GHG inventory 2026 (NCV and CO₂ EF, 2024)",
    publisher: "Türkiye İstatistik Kurumu (TÜİK)",
    licence: "public_sector",
    licenceNote: "Official national inventory submitted to the UNFCCC, cited with attribution.",
    url: tuikNir2026.url,
    asOf: "2026-04-14",
    published: "2026-04-14",
    family: "tuik_ncv",
    year: 2024,
    origin: "builtin",
    rightsConfirmed: true,
    usageNote: "factors.notes.tuik_ncv",
    factors: (tuikNir2026.rows as unknown as TuikRow[]).map(([fuel, nidFuel, unit, ncv, ef]) => ({
      id: `tuik_nir_2024:${fuel}`,
      kind: "fuel_co2" as const,
      key: fuel,
      label: ncv === null ? `${nidFuel} (EF)` : nidFuel,
      value: ef,
      unit,
      ncv: ncv ?? undefined,
      year: 2024,
    })),
  },
  {
    // ENER038 figure 2 (country level) and figure 1 (EU-27), 2024 early estimate. Published in gCO₂e/kWh;
    // stored in tCO₂e/MWh (÷ 1000). Generation intensity: imports and exports are not counted.
    id: "eea_ener038",
    name: "EEA ENER038 — GHG emission intensity of electricity generation, 2024",
    publisher: "European Environment Agency",
    licence: "open",
    licenceNote: "CC BY 4.0 — source: European Environment Agency.",
    url: eeaGrid.url,
    asOf: "2026-07-10",
    published: "2026-07-10",
    family: "eea_ener038",
    year: 2024,
    origin: "builtin",
    rightsConfirmed: true,
    usageNote: "factors.notes.eea_ener038",
    factors: (eeaGrid.rows as unknown as EeaRow[]).map(([code, country, year, g]) => ({
      id: `eea_ener038:${code}`,
      kind: "grid" as const,
      key: code,
      label: country,
      value: Math.round(g * 1000) / 1e6,
      year,
    })),
  },
];

/** Sets that may feed calculations: built-in, or custom with confirmed rights. */
export function usableSets(custom: FactorSet[], extraBuiltin: FactorSet[] = []): FactorSet[] {
  return [...BUILTIN_SETS, ...extraBuiltin, ...custom.filter((s) => s.rightsConfirmed)];
}

export type FactorOption = { set: FactorSet; factor: Factor };

/** Shortest CN code that is matched against the default tables: a four-digit heading. */
export const CN_MIN_DIGITS = 4;

const normKey = (s: string) => s.replace(/[\s.]/g, "").toLowerCase();

/**
 * Factors of one kind, optionally matching a key: exact, or for CBAM defaults by CN code. A CN code matches
 * the table rows it falls under (heading 7208 for 7208 39 00) and, when it is itself a heading, the rows under
 * it; the closest enclosing row comes first. A CN code shorter than a heading matches nothing.
 */
/**
 * The CBAM default-value row for a product of an origin: the row with the same code if the origin's table
 * has it, else the row whose code covers the product's CN (longest such code). Null when the table has neither.
 */
export function cbamDefaultRow(sets: FactorSet[], origin: string, cn: string, key?: string): FactorOption | null {
  const table = sets.find((s) => s.family === "eu_cbam_dv" && (s.country ?? "TR") === origin);
  if (!table) return null;
  const same = key === undefined ? undefined : table.factors.find((f) => f.key === key);
  if (same) return { set: table, factor: same };
  const d = normKey(cn);
  if (d.length < CN_MIN_DIGITS) return null;
  const cover = table.factors.filter((f) => f.kind === "cbam_default" && d.startsWith(normKey(f.key))).sort((a, b) => normKey(b.key).length - normKey(a.key).length)[0];
  return cover ? { set: table, factor: cover } : null;
}

export function findFactors(sets: FactorSet[], kind: FactorKind, key?: string): FactorOption[] {
  const out: { o: FactorOption; rank: number }[] = [];
  const k = key === undefined ? undefined : normKey(key);
  const cn = kind === "cbam_default";
  if (cn && k !== undefined && k.length < CN_MIN_DIGITS) return [];
  for (const set of sets) {
    for (const f of set.factors) {
      if (f.kind !== kind) continue;
      let rank = 0;
      if (k) {
        const fk = normKey(f.key);
        if (cn) {
          if (k.startsWith(fk)) rank = fk.length;
          else if (fk.startsWith(k)) rank = -fk.length;
          else continue;
        } else if (fk !== k) continue;
      }
      out.push({ o: { set, factor: f }, rank });
    }
  }
  return out.sort((a, b) => b.rank - a.rank).map((x) => x.o);
}

/** CN code in the tariff's 4-2-2-2 grouping: 72083900 → "7208 39 00". Other keys come back unchanged. */
export function formatCn(cn: string): string {
  const d = cn.replace(/\s/g, "");
  return /^\d{4}(\d{2}){0,3}$/.test(d) ? (d.match(/^\d{4}|\d{2}/g) ?? [d]).join(" ") : cn;
}

/** Unit of a factor's value as shown to the user. */
export function factorUnit(f: Factor): string {
  return f.kind === "scope3" && f.unit ? `tCO₂e/${f.unit}` : KIND_UNIT[f.kind];
}

export function factorRef(o: FactorOption): string {
  return `${o.set.id}/${o.factor.id}`;
}

export function resolveRef(sets: FactorSet[], ref: string | undefined): FactorOption | null {
  if (!ref) return null;
  const [setId, ...rest] = ref.split("/");
  const fid = rest.join("/");
  const set = sets.find((s) => s.id === setId);
  const factor = set?.factors.find((f) => f.id === fid);
  return set && factor ? { set, factor } : null;
}

// ---------------------------------------------------------------- CSV for custom sets
import { parseCsv, parseNumber } from "./inventory-csv";
import { csvSafe, csvUnsafe } from "./export";

export const FACTOR_CSV_COLUMNS = ["kind", "key", "label", "value", "unit", "ncv", "direct", "indirect", "year", "ch4", "n2o"] as const;

export type FactorCsvIssue = { row: number; key: string; vars?: Record<string, string | number> };

export function importFactorCsv(text: string, setId: string): { factors: Factor[]; issues: FactorCsvIssue[] } {
  const rows = parseCsv(text);
  const factors: Factor[] = [];
  const issues: FactorCsvIssue[] = [];
  if (!rows.length) return { factors, issues: [{ row: 0, key: "empty" }] };
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const missing = ["kind", "key", "value"].filter((c) => !header.includes(c));
  if (missing.length) return { factors, issues: [{ row: 1, key: "missingColumns", vars: { cols: missing.join(", ") } }] };
  const col = (r: string[], name: string) => {
    const i = header.indexOf(name);
    return i >= 0 ? (r[i] ?? "").trim() : "";
  };
  const seen = new Set<string>();
  rows.slice(1).forEach((r, idx) => {
    const n = idx + 2;
    const kind = col(r, "kind").toLowerCase() as FactorKind;
    const key = col(r, "key");
    const value = parseNumber(col(r, "value"));
    if (!FACTOR_KINDS.includes(kind)) return issues.push({ row: n, key: "badKind", vars: { value: col(r, "kind"), allowed: FACTOR_KINDS.join(", ") } });
    if (!key) return issues.push({ row: n, key: "noKey" });
    if (!Number.isFinite(value) || value < 0) return issues.push({ row: n, key: "badValue", vars: { value: col(r, "value") } });
    const ncv = parseNumber(col(r, "ncv"));
    if (kind === "fuel_co2" && !(ncv > 0)) return issues.push({ row: n, key: "needNcv" });
    const id = `${setId}:${kind}:${key}`;
    if (seen.has(id)) return issues.push({ row: n, key: "duplicate", vars: { value: key } });
    seen.add(id);
    // CH₄ and N₂O (kg/TJ) are optional for fuels; an empty cell keeps the line's own or default value.
    const gas = (name: "ch4" | "n2o") => (col(r, name) === "" ? undefined : parseNumber(col(r, name)));
    const ch4 = gas("ch4");
    const n2o = gas("n2o");
    for (const [name, v] of [["ch4", ch4], ["n2o", n2o]] as const) {
      if (kind === "fuel_co2" && v !== undefined && !(Number.isFinite(v) && v >= 0)) return issues.push({ row: n, key: "badValue", vars: { value: col(r, name) } });
    }
    const direct = parseNumber(col(r, "direct"));
    const indirect = parseNumber(col(r, "indirect"));
    const year = parseNumber(col(r, "year"));
    factors.push({
      id,
      kind,
      key,
      label: csvUnsafe(col(r, "label")) || key,
      value,
      unit: col(r, "unit") || undefined,
      ncv: kind === "fuel_co2" ? ncv : undefined,
      ch4: kind === "fuel_co2" ? ch4 : undefined,
      n2o: kind === "fuel_co2" ? n2o : undefined,
      direct: kind === "cbam_default" && Number.isFinite(direct) ? direct : undefined,
      indirect: kind === "cbam_default" && Number.isFinite(indirect) ? indirect : undefined,
      year: Number.isInteger(year) ? year : undefined,
    });
  });
  return { factors, issues };
}

export function factorTemplateCsv(): string {
  return (
    "﻿" +
    [
      FACTOR_CSV_COLUMNS.join(";"),
      "fuel_co2;natural_gas;Doğal gaz (tedarikçi analizi);56,4;Sm3;0,0346;;;2025;1;0,1",
      "grid;DE;Almanya şebekesi (lisanslı veri);0,38;MWh;;;;2024;;",
      "scope3;steel_purchased;Satın alınan çelik (tedarikçi beyanı);1,85;t;;;;2025;;",
      "cbam_default;72083900;Sıcak haddelenmiş yassı (örnek satır, toplam sütunu);2,10;t;;2,10;;2026;;",
    ].join("\r\n")
  );
}

export function factorSetCsv(set: FactorSet): string {
  const esc = (v: unknown) => {
    const raw = v === undefined || v === null ? "" : String(v);
    const s = typeof v === "number" ? raw : csvSafe(raw);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return (
    "﻿" +
    [FACTOR_CSV_COLUMNS.join(";"), ...set.factors.map((f) => [f.kind, f.key, f.label, f.value, f.unit, f.ncv, f.direct, f.indirect, f.year, f.ch4, f.n2o].map(esc).join(";"))].join("\r\n")
  );
}

/** Decimals that show a factor with about three significant digits: 0.00010356 → 6, 0.0321 → 4, 0.469 → 3, 56.1 → 1. */
export function factorDigits(v: number): number {
  const a = Math.abs(v);
  if (!Number.isFinite(a) || a === 0) return 3;
  if (a >= 10) return 1;
  return Math.min(9, Math.max(3, 2 - Math.floor(Math.log10(a))));
}
