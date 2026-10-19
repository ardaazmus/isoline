/**
 * Units (plan 09 §3): every metric has a dimension and a canonical unit; an entered value keeps its unit and is
 * converted exactly for comparison and aggregation. Conversions use decimal strings scaled by powers of ten and
 * exact rational factors, so 1 kWh is 0.0036 GJ exactly and never 0.0035999999.
 * Money is not converted here (currency, FX type and date belong to the finance layer).
 */
export type Dimension = "energy" | "volume" | "mass" | "emissions" | "distance_mass" | "distance_people" | "distance" | "area" | "money" | "people" | "hours" | "count" | "percent" | "score" | "fuel" | "intensity" | "none";

type UnitDef = { dimension: Dimension; /** canonical = value × num / den */ num: bigint; den: bigint };

// factors as exact fractions towards the canonical unit of the dimension
const U: Record<string, UnitDef> = {
  // energy → GJ
  GJ: { dimension: "energy", num: 1n, den: 1n },
  MJ: { dimension: "energy", num: 1n, den: 1000n },
  TJ: { dimension: "energy", num: 1000n, den: 1n },
  kWh: { dimension: "energy", num: 36n, den: 10000n },
  MWh: { dimension: "energy", num: 36n, den: 10n },
  GWh: { dimension: "energy", num: 3600n, den: 1n },
  toe: { dimension: "energy", num: 41868n, den: 1000n }, // IEA: 1 toe = 41.868 GJ
  Mcal: { dimension: "energy", num: 41868n, den: 10000000n }, // 1 Mcal = 4.1868 MJ
  // volume → m3
  m3: { dimension: "volume", num: 1n, den: 1n },
  L: { dimension: "volume", num: 1n, den: 1000n },
  ML: { dimension: "volume", num: 1000n, den: 1n }, // megalitre
  // mass → t
  t: { dimension: "mass", num: 1n, den: 1n },
  kg: { dimension: "mass", num: 1n, den: 1000n },
  kt: { dimension: "mass", num: 1000n, den: 1n },
  // emissions → tCO2e
  tCO2e: { dimension: "emissions", num: 1n, den: 1n },
  kgCO2e: { dimension: "emissions", num: 1n, den: 1000n },
  ktCO2e: { dimension: "emissions", num: 1000n, den: 1n },
  // transport
  tkm: { dimension: "distance_mass", num: 1n, den: 1n },
  pkm: { dimension: "distance_people", num: 1n, den: 1n },
  // distance → km, floor area → m²
  km: { dimension: "distance", num: 1n, den: 1n },
  m: { dimension: "distance", num: 1n, den: 1000n },
  m2: { dimension: "area", num: 1n, den: 1n },
  ha: { dimension: "area", num: 10000n, den: 1n },
  // others (single unit each)
  TRY: { dimension: "money", num: 1n, den: 1n },
  "mTRY": { dimension: "money", num: 1000000n, den: 1n },
  EUR: { dimension: "money", num: 1n, den: 1n },
  persons: { dimension: "people", num: 1n, den: 1n },
  h: { dimension: "hours", num: 1n, den: 1n },
  cases: { dimension: "count", num: 1n, den: 1n },
  "%": { dimension: "percent", num: 1n, den: 1n },
  score: { dimension: "score", num: 1n, den: 1n },
  "fuel-unit": { dimension: "fuel", num: 1n, den: 1n },
  "tCO2e/t": { dimension: "intensity", num: 1n, den: 1n },
  "EUR/t": { dimension: "intensity", num: 1n, den: 1n },
};

/** Units a person may type, per dimension (aliases are matched case-insensitively). */
const ALIASES: Record<string, string> = {
  gj: "GJ", mj: "MJ", tj: "TJ", kwh: "kWh", mwh: "MWh", gwh: "GWh", toe: "toe", tep: "toe", mcal: "Mcal",
  m3: "m3", "m³": "m3", l: "L", lt: "L", litre: "L", liter: "L", ml: "ML",
  t: "t", ton: "t", tonne: "t", tonnes: "t", kg: "kg", kt: "kt",
  tco2e: "tCO2e", "tco₂e": "tCO2e", kgco2e: "kgCO2e", ktco2e: "ktCO2e",
  tkm: "tkm", "t-km": "tkm", "ton-km": "tkm", pkm: "pkm", "kişi-km": "pkm",
  km: "km", m: "m", m2: "m2", "m²": "m2", ha: "ha", hektar: "ha",
  try: "TRY", tl: "TRY", "₺": "TRY", mtry: "mTRY", "milyon tl": "mTRY", eur: "EUR", "€": "EUR",
  persons: "persons", kişi: "persons", people: "persons", h: "h", saat: "h", hours: "h", cases: "cases", vaka: "cases", "%": "%", percent: "%", score: "score", puan: "score",
};

export const CANONICAL: Record<Dimension, string> = {
  energy: "GJ", volume: "m3", mass: "t", emissions: "tCO2e", distance_mass: "tkm", distance_people: "pkm", distance: "km", area: "m2", money: "TRY", people: "persons", hours: "h", count: "cases", percent: "%", score: "score", fuel: "fuel-unit", intensity: "tCO2e/t", none: "",
};

export function normalizeUnit(raw: string): string | null {
  const t = raw.trim();
  if (U[t]) return t;
  return ALIASES[t.toLowerCase()] ?? null;
}

export function dimensionOf(unit: string): Dimension | null {
  return U[unit]?.dimension ?? null;
}

export function unitsFor(dimension: Dimension): string[] {
  return Object.entries(U)
    .filter(([, d]) => d.dimension === dimension)
    .map(([k]) => k);
}

const DEC = /^-?\d+(\.\d+)?$/;

/** Parses a plain decimal string to (integer, scale). */
function toScaled(v: string): { n: bigint; scale: number } {
  if (!DEC.test(v)) throw new Error(`not a decimal: ${v}`);
  const neg = v.startsWith("-");
  const [i, f = ""] = (neg ? v.slice(1) : v).split(".");
  const n = BigInt(i + f) * (neg ? -1n : 1n);
  return { n, scale: f.length };
}

/** Exact decimal string of num / den, rounded half-up to `places` decimals (default 18; storage keeps 12). */
function fromRational(num: bigint, den: bigint, places = 18): string {
  const neg = num < 0n !== den < 0n && num !== 0n;
  let a = num < 0n ? -num : num;
  const b = den < 0n ? -den : den;
  const scale = 10n ** BigInt(places);
  a = a * scale;
  let q = a / b;
  if ((a % b) * 2n >= b) q += 1n;
  const s = q.toString().padStart(places + 1, "0");
  const int = s.slice(0, s.length - places);
  const frac = s.slice(s.length - places).replace(/0+$/, "");
  return `${neg ? "-" : ""}${int}${frac ? `.${frac}` : ""}`;
}

/** Converts a decimal string between two units of one dimension, exactly (18 decimals, half-up). */
export function convert(value: string, from: string, to: string): string {
  const a = U[from];
  const b = U[to];
  if (!a || !b) throw new Error(`unknown unit ${!a ? from : to}`);
  if (a.dimension !== b.dimension) throw new Error(`incompatible units ${from} → ${to}`);
  const { n, scale } = toScaled(value);
  // value × a.num/a.den × b.den/b.num
  return fromRational(n * a.num * b.den, 10n ** BigInt(scale) * a.den * b.num);
}

export function toCanonical(value: string, unit: string): { value: string; unit: string } {
  const d = dimensionOf(unit);
  if (!d) throw new Error(`unknown unit ${unit}`);
  return { value: convert(value, unit, CANONICAL[d]), unit: CANONICAL[d] };
}

/** Normalises a typed number (Turkish "1.234,5" or "1,234.5" or plain) to a plain decimal string, or null. */
export function plainDecimal(raw: string | number): string | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? (/e/i.test(String(raw)) ? raw.toLocaleString("en-US", { useGrouping: false, maximumFractionDigits: 20 }) : String(raw)) : null;
  let s = raw.trim().replace(/\s/g, "");
  if (!s) return null;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > -1 && lastDot > -1) {
    // the later separator is the decimal one
    s = lastComma > lastDot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (lastComma > -1) {
    // same rule as the toolkit's parser: one comma is the decimal mark; only "1,234,567" groups are thousands
    s = /^-?\d{1,3}(,\d{3}){2,}$/.test(s) ? s.replace(/,/g, "") : s.replace(",", ".");
  } else if (/^-?\d{1,3}(\.\d{3}){2,}$/.test(s)) s = s.replace(/\./g, "");
  return DEC.test(s) ? s.replace(/^(-?)0+(\d)/, "$1$2") : null;
}
