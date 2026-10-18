/**
 * CBAM benchmarks for the free allocation adjustment, Implementing Regulation (EU) 2025/2620, Annex:
 *   default values (Eq. 6):  SEFA = CBAM_y × CSCF_y × BM_g          BM_g  = point 5.3 Column B
 *   actual data (Eq. 2–4):   SEFA = CBAM_y × CSCF_y × BM*_g + Σ mᵢ × SEFAᵢ   BM*_g = Column A
 * With default values the production route is the one the default-value table gives for the country of origin
 * (point 5.1; Annex I of 2025/2621 as corrected by 2026/1740, Türkiye, else 'Other Countries and Territories');
 * where several steel alloy grades apply, the highest value for the production year is used. Indicators (1) and
 * (2) mark values for production years 2026–27 and 2028–30. Electricity (CN 2716) has no free allocation.
 * Data: docs/kaynak-veri/cbam-bm.
 */
import cbamBm from "@/data/factors/cbam-benchmarks.json";

export type BmEntry = { value: number; route: string | null; period: 1 | 2 | null };
export type BmRow = { cn: string; description: string; a: BmEntry[]; b: BmEntry[] };

type JsonEntry = [value: number, route: string | null, period: number | null];
const entry = ([value, route, period]: JsonEntry): BmEntry => ({ value, route, period: period === 1 || period === 2 ? period : null });

export const CBAM_BENCHMARKS: BmRow[] = (cbamBm.rows as unknown as [string, string, JsonEntry[], JsonEntry[]][]).map(([cn, description, a, b]) => ({
  cn,
  description,
  a: a.map(entry),
  b: b.map(entry),
}));

/** Route letters of point 5.3 with their meaning (i18n keys cbam.bm.route.<letter>). */
export const ROUTE_LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H", "J", "K", "L"] as const;

type RouteRow = { cn: string; routes: string[]; otherCountries: boolean };
const ROUTES_TR: RouteRow[] = (cbamBm.routesTR as unknown as [string, string, number][]).map(([cn, r, o]) => ({ cn, routes: r ? r.split("/") : [], otherCountries: o === 1 }));

const digits = (cn: string) => cn.replace(/\D/g, "");

/**
 * The row for a code: itself or the closest enclosing row; else, for a heading, the rows under it when they
 * all agree. Rows under a heading that disagree need a more specific code.
 */
function closest<T extends { cn: string }>(rows: T[], cn: string, same: (a: T, b: T) => boolean): { row: T | null; status: "ok" | "ambiguous" | "none" } {
  const k = digits(cn);
  if (k.length < 4) return { row: null, status: "none" };
  const up = rows.filter((r) => k.startsWith(r.cn)).sort((a, b) => b.cn.length - a.cn.length)[0];
  if (up) return { row: up, status: "ok" };
  const down = rows.filter((r) => r.cn.startsWith(k));
  if (!down.length) return { row: null, status: "none" };
  return down.every((r) => same(r, down[0])) ? { row: down[0], status: "ok" } : { row: null, status: "ambiguous" };
}

export function benchmarkRowFor(cn: string) {
  return closest(CBAM_BENCHMARKS, cn, (a, b) => JSON.stringify([a.a, a.b]) === JSON.stringify([b.a, b.b]));
}

/** Production route of the Türkiye default-value table for a code (null when the table does not settle it). */
export function defaultRouteTR(cn: string): RouteRow | null {
  const r = closest(ROUTES_TR, cn, (a, b) => a.routes.join("/") === b.routes.join("/"));
  return r.row;
}

/** Value for the production year and routes; null when the row is route-specific and no route applies. */
export function pickBenchmark(entries: BmEntry[], routes: string[], year: number): number | null {
  const period = year <= 2027 ? 1 : 2;
  const inPeriod = entries.filter((e) => e.period === null || e.period === period);
  if (!inPeriod.some((e) => e.route)) return inPeriod.length ? Math.max(...inPeriod.map((e) => e.value)) : null;
  const hit = inPeriod.filter((e) => e.route && routes.includes(e.route));
  return hit.length ? Math.max(...hit.map((e) => e.value)) : null;
}

/** Route letters a row distinguishes (empty when it has a single value). */
export function rowRoutes(row: BmRow): string[] {
  return [...new Set([...row.a, ...row.b].map((e) => e.route).filter((r): r is string => !!r))].sort();
}

export type BenchmarkInput = { cn: string; benchmark: number; bmMode?: "official" | "manual"; bmRoute?: string; precursorBm?: number | null };

export type BenchmarkResolution = {
  /** Benchmark used in the free allocation adjustment, tCO₂e/t (0 when unresolved). */
  value: number;
  source: "default" | "actual" | "manual";
  /** ok; ambiguous = a heading whose codes differ; none = no benchmark for the code; route = a route is needed. */
  status: "ok" | "ambiguous" | "none" | "route";
  routes: string[];
  /** The route came from the default-value table (not chosen by the user). */
  routeFromTable: boolean;
  row?: BmRow;
  a?: number;
  b?: number;
  /** Actual data: precursors' share, Σ mᵢ × BMᵢ per tonne of good; defaults to Column B − Column A. */
  precursor?: number;
  precursorDefault?: boolean;
};

export function resolveBenchmark(p: BenchmarkInput, year: number, mode: "default" | "actual"): BenchmarkResolution {
  if (p.bmMode === "manual") return { value: Math.max(0, p.benchmark), source: "manual", status: "ok", routes: [], routeFromTable: false };
  const base = { source: mode, routes: [] as string[], routeFromTable: false };
  if (digits(p.cn).startsWith("2716")) return { ...base, value: 0, status: "none" };
  const { row, status } = benchmarkRowFor(p.cn);
  if (!row) return { ...base, value: 0, status };
  const table = defaultRouteTR(p.cn);
  // Default values: the table's route, always (point 5.1). Actual data: the route chosen, else the table's.
  const chosen = mode === "actual" && p.bmRoute ? p.bmRoute.split("/") : null;
  const routes = chosen ?? table?.routes ?? [];
  const b = pickBenchmark(row.b, routes, year);
  if (mode === "default") {
    return b === null ? { ...base, value: 0, status: "route", routes, routeFromTable: !!table, row } : { ...base, value: b, status: "ok", routes, routeFromTable: !!table, row, b };
  }
  const a = pickBenchmark(row.a, routes, year);
  if (a === null) return { ...base, value: 0, status: "route", routes, routeFromTable: !chosen, row };
  const precursorDefault = p.precursorBm === null || p.precursorBm === undefined;
  const precursor = precursorDefault ? Math.max(0, (b ?? a) - a) : Math.max(0, p.precursorBm!);
  return { ...base, value: a + precursor, status: "ok", routes, routeFromTable: !chosen, row, a, b: b ?? undefined, precursor, precursorDefault };
}
