/**
 * Project plan (G2-08) from the 13 control gates of plan 05 §1, scheduled with the critical path method.
 * Gate durations are working assumptions for a first plan; the project lead moves dates and the critical path is
 * recomputed from the dates people actually set. Data collection cannot finish before the period has ended:
 * a full year's figures need the last month's invoices (constraint "not before period end + 30 days").
 */
export type GateKey = "G0" | "G1" | "G2" | "G3" | "G4" | "G5" | "G6" | "G7" | "G8" | "G9" | "G10" | "G11" | "G12";

export type GateTemplate = { gate: GateKey; days: number; deps: GateKey[]; finishNotBeforePeriodEnd?: number; startStatus: "ready" | "not_ready" };

export const GATE_TEMPLATE: GateTemplate[] = [
  { gate: "G0", days: 7, deps: [], startStatus: "ready" }, // intake: engagement and scope document
  { gate: "G1", days: 10, deps: ["G0"], startStatus: "not_ready" }, // organisation and users
  { gate: "G2", days: 10, deps: ["G0"], startStatus: "not_ready" }, // standards and applicability
  { gate: "G3", days: 7, deps: ["G1", "G2"], startStatus: "not_ready" }, // report plan, period, boundary, RACI
  { gate: "G4", days: 21, deps: ["G3"], startStatus: "not_ready" }, // materiality / IRO where the standard asks
  { gate: "G5", days: 10, deps: ["G3", "G4"], startStatus: "not_ready" }, // data plan
  { gate: "G6", days: 45, deps: ["G5"], finishNotBeforePeriodEnd: 30, startStatus: "not_ready" }, // campaigns
  { gate: "G7", days: 14, deps: ["G6"], startStatus: "not_ready" }, // calculation
  { gate: "G8", days: 10, deps: ["G7"], startStatus: "not_ready" }, // controls
  { gate: "G9", days: 7, deps: ["G8"], startStatus: "not_ready" }, // consolidation and close
  { gate: "G10", days: 30, deps: ["G5"], startStatus: "not_ready" }, // writing (drafts may start early)
  { gate: "G11", days: 10, deps: ["G9", "G10"], startStatus: "not_ready" }, // assurance prep, management review
  { gate: "G12", days: 14, deps: ["G11"], startStatus: "not_ready" }, // design, proof, release
];

const DAY = 864e5;
export const toDate = (iso: string) => new Date(`${iso}T00:00:00Z`);
export const iso = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (isoDate: string, n: number) => iso(new Date(toDate(isoDate).getTime() + n * DAY));
export const daysBetween = (a: string, b: string) => Math.round((toDate(b).getTime() - toDate(a).getTime()) / DAY);

export type Scheduled = { gate: GateKey; startsOn: string; dueOn: string; deps: GateKey[]; critical: boolean; status: "ready" | "not_ready" };

/** Forward pass from `start`; the critical path is the chain with zero float towards the last finish. */
export function schedule(start: string, periodEnd: string, publishDue: string | null): { items: Scheduled[]; finish: string; lateBy: number } {
  const ef = new Map<GateKey, string>();
  const es = new Map<GateKey, string>();
  for (const g of GATE_TEMPLATE) {
    let s = g.deps.length ? g.deps.map((d) => addDays(ef.get(d)!, 1)).sort().at(-1)! : start;
    if (g.finishNotBeforePeriodEnd !== undefined) {
      const earliestStart = addDays(addDays(periodEnd, g.finishNotBeforePeriodEnd), -(g.days - 1));
      if (earliestStart > s) s = earliestStart;
    }
    es.set(g.gate, s);
    ef.set(g.gate, addDays(s, g.days - 1));
  }
  const finish = [...ef.values()].sort().at(-1)!;
  const crit = criticalSet(
    GATE_TEMPLATE.map((g) => ({ id: g.gate, startsOn: es.get(g.gate)!, dueOn: ef.get(g.gate)!, deps: g.deps })),
  );
  return {
    items: GATE_TEMPLATE.map((g) => ({ gate: g.gate, startsOn: es.get(g.gate)!, dueOn: ef.get(g.gate)!, deps: g.deps, critical: crit.has(g.gate), status: g.startStatus })),
    finish,
    lateBy: publishDue && finish > publishDue ? daysBetween(publishDue, finish) : 0,
  };
}

export type PlanNode = { id: string; startsOn: string; dueOn: string; deps: string[] };

/**
 * Critical path on the dates as they stand: walking back from the last finish, a dependency is critical when it
 * finishes right before (or later than) the critical successor could start — i.e. it has no float.
 */
export function criticalSet(nodes: PlanNode[]): Set<string> {
  if (!nodes.length) return new Set();
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const finish = nodes.map((n) => n.dueOn).sort().at(-1)!;
  const crit = new Set<string>();
  const stack = nodes.filter((n) => n.dueOn === finish).map((n) => n.id);
  while (stack.length) {
    const id = stack.pop()!;
    if (crit.has(id)) continue;
    crit.add(id);
    const n = byId.get(id)!;
    const preds = n.deps.map((d) => byId.get(d)).filter((d): d is PlanNode => !!d);
    if (!preds.length) continue;
    const latest = preds.map((p) => p.dueOn).sort().at(-1)!;
    // only predecessors that drive the start (finish on the latest date, within a one-day gap) are critical
    if (daysBetween(latest, n.startsOn) <= 1) for (const p of preds) if (p.dueOn === latest) stack.push(p.id);
  }
  return crit;
}

/** True when following dependencies from `from` reaches `to` (adding to → from would close a loop). */
export function reaches(deps: Map<string, string[]>, from: string, to: string): boolean {
  const seen = new Set<string>();
  const stack = [from];
  while (stack.length) {
    const x = stack.pop()!;
    if (x === to) return true;
    if (seen.has(x)) continue;
    seen.add(x);
    stack.push(...(deps.get(x) ?? []));
  }
  return false;
}

export type WpStatus = "not_ready" | "ready" | "active" | "review" | "done" | "blocked" | "rework";

/** Work package state machine (plan 05 §2). */
export const WP_TRANSITIONS: Record<WpStatus, WpStatus[]> = {
  not_ready: ["ready", "blocked"],
  ready: ["active", "blocked"],
  active: ["review", "blocked"],
  review: ["done", "rework"],
  rework: ["active", "blocked"],
  blocked: ["ready", "active"],
  done: ["rework"],
};
