/**
 * Factor editions and retroactive recalculation. Official factor sets come in editions (ETKB per
 * calculation year, national inventory NCVs per inventory year, DESNZ per publication year). An inventory
 * uses the edition for its year, or the latest one published before it. When a newer edition becomes
 * available, the inventory is recalculated: every line linked to the library moves to the new edition's
 * factor with the same key, the default grid factors move with it, and the change is recorded with the
 * totals before and after (GHG Protocol Corporate Standard ch. 5: base-year recalculation when the
 * change is significant).
 */
import { computeInventory, ETKB_EDITIONS, fuelEmissions, electricityLocation, scope3Emissions, GRID_FACTORS, type GridFactors, type Inventory, type InventoryResult } from "./calc/ghg";
import { factorRef, resolveRef, type FactorSet } from "./factors";

/** GHG Protocol practice: a base-year recalculation is needed above a significance threshold, commonly 5 %. */
export const SIGNIFICANCE = 0.05;

/** Editions of a family, oldest first. */
export function familyEditions(sets: FactorSet[], family: string): FactorSet[] {
  return sets.filter((s) => s.family === family && s.year !== undefined).sort((a, b) => a.year! - b.year!);
}

export type EditionPick = { set: FactorSet; exact: boolean };

/** The edition for a year: that year's, else the latest published before it, else the earliest. */
export function pickEdition(sets: FactorSet[], family: string, year: number): EditionPick | null {
  const eds = familyEditions(sets, family);
  if (!eds.length) return null;
  const exact = eds.find((s) => s.year === year);
  if (exact) return { set: exact, exact: true };
  const before = eds.filter((s) => s.year! < year).at(-1);
  return { set: before ?? eds[0], exact: false };
}

/** The sets to offer for a year: one edition per family (and per country), plus every set outside a family. */
export function setsForYear(sets: FactorSet[], year: number): FactorSet[] {
  const groups = new Map<string, FactorSet[]>();
  for (const s of sets) if (s.family) groups.set(`${s.family}:${s.country ?? ""}`, [...(groups.get(`${s.family}:${s.country ?? ""}`) ?? []), s]);
  const keep = new Set([...groups.values()].map((g) => pickEdition(g, g[0].family!, year)!.set.id));
  return sets.filter((s) => !s.family || keep.has(s.id));
}

/** Consumption-point factors of an ETKB edition set. */
export function gridOf(set: FactorSet): GridFactors & { edition: string } {
  const v = (key: string) => set.factors.find((f) => f.key === key)!.value;
  return { edition: set.id, transmission: v("TR-transmission"), distribution: v("TR-distribution") };
}

/** Edition id the inventory's default grid factors come from. */
export function gridEdition(inv: Inventory): string {
  return inv.grid?.edition ?? `etkb_${ETKB_EDITIONS.at(-1)!.year}`;
}

export type LineChange = {
  kind: "fuel" | "electricity" | "scope3";
  id: string;
  label: string;
  from: string;
  to: string;
  before: number;
  after: number;
};

export type Missing = { kind: LineChange["kind"]; id: string; label: string; ref: string; edition: string };

export type RecalcPlan = {
  year: number;
  /** Edition chosen per family. */
  targets: Record<string, string>;
  grid: { from: string; to: string } | null;
  changes: LineChange[];
  missing: Missing[];
  before: InventoryResult;
  after: InventoryResult;
  next: Inventory;
  /** Relative change of scope 1 + location-based scope 2. */
  scope12Change: number;
};

type Totals = { scope1: number; scope2Location: number; scope2Market: number; scope3: number };

export type RecalcRecord = {
  at: string;
  year: number;
  editions: Record<string, string>;
  grid: { from: string; to: string } | null;
  lines: number;
  before: Totals;
  after: Totals;
};

const totals = (r: InventoryResult): Totals => ({ scope1: r.scope1, scope2Location: r.scope2Location, scope2Market: r.scope2Market, scope3: r.scope3 });

/**
 * Plans moving an inventory to the editions for `year` (or the editions in `choose`, by family). Nothing is
 * changed until `applyRecalc`; lines whose factor key is missing from the new edition keep their values.
 */
export function planRecalc(inv: Inventory, sets: FactorSet[], year: number, choose: Record<string, string> = {}): RecalcPlan {
  const families = [...new Set(sets.map((s) => s.family).filter((f): f is string => !!f))];
  const targets: Record<string, string> = {};
  for (const f of families) targets[f] = choose[f] ?? pickEdition(sets, f, year)!.set.id;
  const target = (set: FactorSet | undefined) => (set?.family ? sets.find((s) => s.id === targets[set.family!]) : undefined);

  const changes: LineChange[] = [];
  const missing: Missing[] = [];
  /** The factor of the target edition with the same key and kind, or null if the line stays. */
  const move = (ref: string | undefined, kind: LineChange["kind"], id: string, label: string) => {
    const cur = resolveRef(sets, ref);
    const to = target(cur?.set);
    if (!cur || !to || to.id === cur.set.id) return null;
    const f = to.factors.find((x) => x.key === cur.factor.key && x.kind === cur.factor.kind);
    if (!f) {
      missing.push({ kind, id, label, ref: ref!, edition: to.id });
      return null;
    }
    return { from: ref!, to: factorRef({ set: to, factor: f }), factor: f };
  };

  const etkb = sets.find((s) => s.id === targets.etkb);
  const grid = etkb ? gridOf(etkb) : null;
  const gridFrom = gridEdition(inv);
  const nextGrid: GridFactors = grid ?? inv.grid ?? GRID_FACTORS;

  const fuels = inv.fuels.map((l) => {
    const m = move(l.factorRef, "fuel", l.id, l.label);
    if (!m) return l;
    const next = { ...l, ef: m.factor.value, ncv: m.factor.ncv ?? l.ncv, ch4: m.factor.ch4 ?? l.ch4, n2o: m.factor.n2o ?? l.n2o, factorRef: m.to };
    changes.push({ kind: "fuel", id: l.id, label: l.label, from: m.from, to: m.to, before: fuelEmissions(l), after: fuelEmissions(next) });
    return next;
  });
  const electricity = inv.electricity.map((l) => {
    const m = move(l.factorRef, "electricity", l.id, l.label);
    const next = m ? { ...l, gridFactor: m.factor.value, factorRef: m.to } : l;
    const before = electricityLocation(l, inv.grid ?? GRID_FACTORS);
    const after = electricityLocation(next, nextGrid);
    if (m || Math.abs(after - before) > 1e-9) changes.push({ kind: "electricity", id: l.id, label: l.label, from: m?.from ?? gridFrom, to: m?.to ?? grid?.edition ?? gridFrom, before, after });
    return next;
  });
  const scope3 = inv.scope3.map((l) => {
    const m = move(l.factorRef, "scope3", l.id, l.label);
    if (!m) return l;
    if (m.factor.unit && m.factor.unit !== l.unit) {
      missing.push({ kind: "scope3", id: l.id, label: l.label, ref: m.from, edition: m.to.split("/")[0] });
      return l;
    }
    const next = { ...l, factor: m.factor.value, factorRef: m.to, factorSource: `${sets.find((s) => s.id === m.to.split("/")[0])!.name} — ${m.factor.label}` };
    changes.push({ kind: "scope3", id: l.id, label: l.label, from: m.from, to: m.to, before: scope3Emissions(l), after: scope3Emissions(next) });
    return next;
  });

  const next: Inventory = { ...inv, year, fuels, electricity, scope3, ...(grid ? { grid } : {}) };
  const before = computeInventory(inv);
  const after = computeInventory(next);
  const b12 = before.scope1 + before.scope2Location;
  return {
    year,
    targets,
    grid: grid && grid.edition !== gridFrom ? { from: gridFrom, to: grid.edition } : null,
    changes,
    missing,
    before,
    after,
    next,
    scope12Change: b12 > 0 ? (after.scope1 + after.scope2Location - b12) / b12 : 0,
  };
}

/** The recalculated inventory, with the recalculation recorded (newest first, last 20 kept). */
export function applyRecalc(inv: Inventory, plan: RecalcPlan, at = new Date()): Inventory {
  const rec: RecalcRecord = { at: at.toISOString(), year: plan.year, editions: plan.targets, grid: plan.grid, lines: plan.changes.length, before: totals(plan.before), after: totals(plan.after) };
  return { ...plan.next, recalcs: [rec, ...(inv.recalcs ?? [])].slice(0, 20) };
}

/** A recalculation is significant when scope 1 + 2 moves by at least the threshold. */
export const isSignificant = (plan: Pick<RecalcPlan, "scope12Change">, threshold = SIGNIFICANCE) => Math.abs(plan.scope12Change) >= threshold;
