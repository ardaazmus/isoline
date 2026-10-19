/**
 * Reporting boundary suggestion (G2-03) from the organisation tree as it stood on a date (G2-02).
 *
 * GHG Protocol Corporate Standard, chapter 3, table 1 — how much of an entity's emissions a group reports:
 *
 *   accounting category (our edge.control)     equity share   financial control   operational control
 *   subsidiary / group company ("financial")   equity %       100 %               100 % if the group operates it
 *   joint venture ("joint")                    equity %       equity %            100 % if the group operates it
 *   operated, not financially controlled       equity %       0 %                 100 %
 *   associate ("significant_influence")        equity %       0 %                 0 % (unless operated)
 *   fixed asset investment ("none")            0 %            0 %                 0 %
 *
 * Shares and control multiply along ownership chains and add up over parallel chains (capped at 100 %).
 * Financial reporting (IFRS 10) consolidates subsidiaries line by line; joint ventures and associates use the
 * equity method and stay outside the consolidation boundary. A CBAM boundary lists the installations.
 * The result is a suggestion: people may change a member with a written reason.
 */
export type BoundaryKind = "ghg_operational_control" | "ghg_financial_control" | "ghg_equity_share" | "financial_reporting" | "cbam_facility_product";
export type Control = "operational" | "financial" | "joint" | "significant_influence" | "none";

export type EntityIn = { id: string; isParent: boolean; validFrom: string | null; validTo: string | null };
export type EdgeIn = { parent: string; child: string; sharePct: number; control: Control; validFrom: string; validTo: string | null };
export type FacilityIn = { id: string; entityId: string; operated: boolean; cbamInstallation: boolean; validFrom: string | null; validTo: string | null };

export type MemberReason =
  | "reporting_parent"
  | "subsidiary"
  | "joint_venture_share"
  | "equity_share"
  | "operated"
  | "not_operated"
  | "associate_excluded"
  | "investment_excluded"
  | "equity_method"
  | "not_in_group"
  | "installation"
  | "not_installation";

export type Member = { kind: "entity" | "facility"; id: string; pct: number; reason: MemberReason };
export type Suggestion = { members: Member[]; warnings: string[] };

const live = (from: string | null, to: string | null, d: string) => (!from || from <= d) && (!to || to >= d);
const round4 = (v: number) => Math.round(v * 10_000) / 10_000;
const cap = (v: number) => Math.min(100, Math.max(0, round4(v)));

type Reach = { equity: number; financial: number; operated: number; joint: boolean; associate: boolean; investment: boolean; reached: boolean };

/** Effective equity, financial-control share and operational reach of each entity seen from the reporting parent. */
export function reachFromParent(entities: EntityIn[], edges: EdgeIn[], asOf: string): { reach: Map<string, Reach>; warnings: string[]; parent: string | null } {
  const warnings: string[] = [];
  const alive = entities.filter((e) => live(e.validFrom, e.validTo, asOf));
  const ids = new Set(alive.map((e) => e.id));
  const parents = alive.filter((e) => e.isParent);
  const reach = new Map<string, Reach>(alive.map((e) => [e.id, { equity: 0, financial: 0, operated: 0, joint: false, associate: false, investment: false, reached: false }]));
  if (parents.length !== 1) {
    warnings.push(parents.length === 0 ? "no_reporting_parent" : "several_reporting_parents");
    return { reach, warnings, parent: null };
  }
  const root = parents[0].id;
  const out = new Map<string, EdgeIn[]>();
  for (const e of edges) {
    if (!live(e.validFrom, e.validTo, asOf) || !ids.has(e.parent) || !ids.has(e.child)) continue;
    out.set(e.parent, [...(out.get(e.parent) ?? []), e]);
  }
  // depth-first over every simple path (groups are small; a cycle is reported and its back edge ignored)
  const walk = (node: string, equity: number, financial: number, operated: number, path: Set<string>, joint: boolean, associate: boolean, investment: boolean) => {
    const r = reach.get(node)!;
    r.reached = true;
    r.equity += equity;
    r.financial += financial;
    r.operated = Math.max(r.operated, operated);
    r.joint ||= joint;
    r.associate ||= associate;
    r.investment ||= investment;
    for (const e of out.get(node) ?? []) {
      if (path.has(e.child)) {
        if (!warnings.includes("ownership_cycle")) warnings.push("ownership_cycle");
        continue;
      }
      const s = e.sharePct / 100;
      const eq = e.control === "none" ? 0 : equity * s;
      const fin = e.control === "financial" ? financial : e.control === "joint" ? financial * s : 0;
      const op = e.control === "financial" || e.control === "operational" ? operated : 0;
      walk(e.child, eq, fin, op, new Set([...path, e.child]), joint || e.control === "joint", associate || e.control === "significant_influence", investment || e.control === "none");
    }
  };
  walk(root, 1, 1, 1, new Set([root]), false, false, false);
  // a node reached only through a joint venture keeps its operated reach as "conditional": facilities decide
  return { reach, warnings, parent: root };
}

export function suggestBoundary(kind: BoundaryKind, entities: EntityIn[], edges: EdgeIn[], facilities: FacilityIn[], asOf: string): Suggestion {
  const { reach, warnings, parent } = reachFromParent(entities, edges, asOf);
  const members: Member[] = [];
  const liveFacilities = facilities.filter((f) => live(f.validFrom, f.validTo, asOf) && reach.has(f.entityId));
  if (!parent) return { members, warnings };

  if (kind === "cbam_facility_product") {
    for (const f of liveFacilities) {
      const r = reach.get(f.entityId)!;
      const inGroup = r.reached && (r.financial > 0 || r.operated > 0);
      members.push({ kind: "facility", id: f.id, pct: inGroup && f.cbamInstallation ? 100 : 0, reason: !inGroup ? "not_in_group" : f.cbamInstallation ? "installation" : "not_installation" });
    }
    return { members, warnings };
  }

  for (const [id, r] of reach) {
    if (!r.reached) {
      members.push({ kind: "entity", id, pct: 0, reason: "not_in_group" });
      continue;
    }
    if (id === parent) {
      members.push({ kind: "entity", id, pct: 100, reason: "reporting_parent" });
      continue;
    }
    const financial = cap(r.financial * 100);
    const equity = cap(r.equity * 100);
    if (kind === "ghg_equity_share") members.push({ kind: "entity", id, pct: equity, reason: equity === 0 ? "investment_excluded" : "equity_share" });
    else if (kind === "ghg_financial_control") {
      if (financial >= 100) members.push({ kind: "entity", id, pct: 100, reason: "subsidiary" });
      else if (financial > 0) members.push({ kind: "entity", id, pct: financial, reason: "joint_venture_share" });
      else members.push({ kind: "entity", id, pct: 0, reason: r.investment && !r.associate ? "investment_excluded" : "associate_excluded" });
    } else if (kind === "financial_reporting") {
      if (financial >= 100) members.push({ kind: "entity", id, pct: 100, reason: "subsidiary" });
      else members.push({ kind: "entity", id, pct: 0, reason: r.investment && !r.associate && !r.joint ? "investment_excluded" : "equity_method" });
    } else {
      // operational control: entity-level reach, facilities below decide by who operates them
      members.push({ kind: "entity", id, pct: r.operated > 0 ? 100 : 0, reason: r.operated > 0 ? "operated" : r.joint ? "not_operated" : r.associate ? "associate_excluded" : r.investment ? "investment_excluded" : "not_operated" });
    }
  }

  if (kind === "ghg_operational_control") {
    for (const f of liveFacilities) {
      const r = reach.get(f.entityId)!;
      // inside a subsidiary chain or a joint venture the operator flag on the facility decides
      const can = r.reached && (r.operated > 0 || r.joint || r.financial > 0);
      const pct = can && f.operated ? 100 : 0;
      members.push({ kind: "facility", id: f.id, pct, reason: !r.reached ? "not_in_group" : pct ? "operated" : "not_operated" });
    }
  } else {
    // other approaches: facilities follow their entity's share
    const entityPct = new Map(members.filter((m) => m.kind === "entity").map((m) => [m.id, m]));
    for (const f of liveFacilities) {
      const m = entityPct.get(f.entityId)!;
      members.push({ kind: "facility", id: f.id, pct: m.pct, reason: m.reason });
    }
  }
  return { members, warnings };
}
