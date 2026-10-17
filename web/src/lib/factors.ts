/**
 * Emission factor library. Built-in sets carry only open-licence or official public-sector data with their
 * publisher, licence, URL and as-of date. Customers add their own sets ("bring your own data"), for example
 * licensed IEA factors; such a set can only be used after the user confirms they hold the right to use it,
 * which keeps the licence responsibility with the user. Custom sets live in the workspace, not in the product.
 */
import { FUELS, GRID_FACTORS, GWP_AR6, type FuelId } from "./calc/ghg";
import cbamTr from "@/data/factors/eu-cbam-defaults-tr.json";
import eeaGrid from "@/data/factors/eea-grid-intensity.json";

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
  /**
   * CBAM defaults: direct and indirect parts, tCO₂e/t, kept for information. `value` is the total column, the
   * figure Implementing Regulation (EU) 2026/1740 applies (with the mark-up) when default values are used.
   */
  direct?: number;
  indirect?: number;
  /** CBAM defaults: the country table shows "–", so the "Other Countries and Territories" value applies. */
  otherCountries?: boolean;
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
  {
    id: "etkb_2023",
    name: "ETKB — Türkiye electricity emission factors, 2023",
    publisher: "T.C. Enerji ve Tabii Kaynaklar Bakanlığı",
    licence: "public_sector",
    licenceNote: "Official public-sector data, cited with attribution.",
    url: "https://enerji.gov.tr/evced-cevre-ve-iklim-elektrik-uretim-tuketim-emisyon-faktorleri",
    asOf: AS_OF,
    origin: "builtin",
    rightsConfirmed: true,
    factors: [
      { id: "etkb_2023:generation", kind: "grid", key: "TR-generation", label: "Türkiye geneli üretim", value: 0.434, year: 2023 },
      { id: "etkb_2023:transmission", kind: "grid", key: "TR-transmission", label: "İletim hattına bağlı tüketim noktası", value: GRID_FACTORS.transmission, year: 2023 },
      { id: "etkb_2023:distribution", kind: "grid", key: "TR-distribution", label: "Dağıtım hattına bağlı tüketim noktası", value: GRID_FACTORS.distribution, year: 2023 },
    ],
  },
  {
    id: "ipcc_ar6_gwp",
    name: "IPCC AR6 WG1 — GWP100 (Table 7.SM.7)",
    publisher: "IPCC Working Group I",
    licence: "open",
    licenceNote: "Published assessment values, cited with attribution.",
    url: "https://www.ipcc.ch/report/ar6/wg1/downloads/report/IPCC_AR6_WGI_Chapter07_SM.pdf",
    asOf: AS_OF,
    origin: "builtin",
    rightsConfirmed: true,
    factors: Object.keys(GWP_AR6).map((g) => ({ id: `ipcc_ar6_gwp:${g}`, kind: "gwp" as const, key: g, label: g, value: GWP_AR6[g] })),
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
    origin: "builtin",
    rightsConfirmed: true,
    usageNote: "factors.notes.eu_cbam_dv_tr",
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

export const FACTOR_CSV_COLUMNS = ["kind", "key", "label", "value", "unit", "ncv", "direct", "indirect", "year"] as const;

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
    const direct = parseNumber(col(r, "direct"));
    const indirect = parseNumber(col(r, "indirect"));
    const year = parseNumber(col(r, "year"));
    factors.push({
      id,
      kind,
      key,
      label: col(r, "label") || key,
      value,
      unit: col(r, "unit") || undefined,
      ncv: kind === "fuel_co2" ? ncv : undefined,
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
      "fuel_co2;natural_gas;Doğal gaz (tedarikçi analizi);56,4;Sm3;0,0346;;;2025",
      "grid;DE;Almanya şebekesi (lisanslı veri);0,38;MWh;;;;2024",
      "scope3;steel_purchased;Satın alınan çelik (tedarikçi beyanı);1,85;t;;;;2025",
      "cbam_default;72083900;Sıcak haddelenmiş yassı (örnek satır, toplam sütunu);2,10;t;;2,10;;2026",
    ].join("\r\n")
  );
}

export function factorSetCsv(set: FactorSet): string {
  const esc = (v: unknown) => {
    const s = v === undefined || v === null ? "" : String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return (
    "﻿" +
    [FACTOR_CSV_COLUMNS.join(";"), ...set.factors.map((f) => [f.kind, f.key, f.label, f.value, f.unit, f.ncv, f.direct, f.indirect, f.year].map(esc).join(";"))].join("\r\n")
  );
}
