/**
 * Layout for the two diagrams of G8-04/05 (plan 11 §4), pure and testable:
 *   - an isometric (2.5D) site map: one block per facility, grouped by legal entity; the block height is the data
 *     collection progress of the current cycle — a fact about the work, never a picture of "environmental success";
 *   - a three-column Sankey: facilities → scopes → total, in one unit (tCO₂e); every node's inflow equals its
 *     outflow, so the drawing cannot invent or lose emissions.
 */

export type SiteIn = { id: string; name: string; entity: string; accepted: number; total: number; blockers: number };
export type Block = SiteIn & { x: number; y: number; progress: number; height: number; top: string; left: string; right: string; labelX: number; labelY: number };

const TILE_W = 120;
const TILE_H = 60;
const MAX_H = 56;
/** Grid spacing as a multiple of the tile, so blocks and their labels never touch. */
const GAP = 1.9;

/** Facilities on an isometric grid: one row per legal entity, blocks raised by the share of requests done. */
export function isometric(sites: SiteIn[]): { blocks: Block[]; width: number; height: number } {
  const entities = [...new Set(sites.map((s) => s.entity))];
  const blocks: Block[] = [];
  const perRow = Math.max(1, ...entities.map((e) => sites.filter((s) => s.entity === e).length));
  const originX = (entities.length * TILE_W * GAP) / 2 + 60;
  const originY = MAX_H + 40;
  entities.forEach((e, row) =>
    sites
      .filter((s) => s.entity === e)
      .forEach((s, col) => {
        const x = originX + ((col - row) * TILE_W * GAP) / 2;
        const y = originY + ((col + row) * TILE_H * GAP) / 2;
        const progress = s.total > 0 ? s.accepted / s.total : 0;
        const h = 8 + progress * (MAX_H - 8);
        const pt = (dx: number, dy: number) => `${(x + dx).toFixed(1)},${(y + dy).toFixed(1)}`;
        // top face lifted by h; left and right faces drop to the ground
        const top = [pt(0, -h), pt(TILE_W / 2, TILE_H / 2 - h), pt(0, TILE_H - h), pt(-TILE_W / 2, TILE_H / 2 - h)].join(" ");
        const left = [pt(-TILE_W / 2, TILE_H / 2 - h), pt(0, TILE_H - h), pt(0, TILE_H), pt(-TILE_W / 2, TILE_H / 2)].join(" ");
        const right = [pt(TILE_W / 2, TILE_H / 2 - h), pt(0, TILE_H - h), pt(0, TILE_H), pt(TILE_W / 2, TILE_H / 2)].join(" ");
        blocks.push({ ...s, x, y, progress, height: h, top, left, right, labelX: x, labelY: y + TILE_H + 18 });
      }),
  );
  const width = Math.max(320, ((entities.length + perRow) * TILE_W * GAP) / 2 + 200);
  const height = originY + ((entities.length + perRow) * TILE_H * GAP) / 2 + 80;
  return { blocks, width, height };
}

export type FlowIn = { source: string; target: string; value: number };
export type SankeyNode = { id: string; column: number; value: number; x: number; y: number; h: number };
export type SankeyLink = FlowIn & { path: string; width: number };

/** A layered Sankey for a DAG of flows (columns from the graph depth); values must be ≥ 0. */
export function sankey(flows: FlowIn[], size = { width: 760, height: 360 }, nodeWidth = 14, gap = 14): { nodes: SankeyNode[]; links: SankeyLink[] } {
  const live = flows.filter((f) => f.value > 0);
  const ids = [...new Set(live.flatMap((f) => [f.source, f.target]))];
  // column = longest path from a source
  const column = new Map<string, number>(ids.map((id) => [id, 0]));
  for (let pass = 0; pass < ids.length; pass++) for (const f of live) column.set(f.target, Math.max(column.get(f.target)!, column.get(f.source)! + 1));
  const cols = Math.max(0, ...column.values()) + 1;
  const inflow = (id: string) => live.filter((f) => f.target === id).reduce((s, f) => s + f.value, 0);
  const outflow = (id: string) => live.filter((f) => f.source === id).reduce((s, f) => s + f.value, 0);
  const value = (id: string) => Math.max(inflow(id), outflow(id));
  const byCol = Array.from({ length: cols }, (_, c) => ids.filter((id) => column.get(id) === c));
  const maxTotal = Math.max(1, ...byCol.map((list) => list.reduce((s, id) => s + value(id), 0)));
  const maxCount = Math.max(1, ...byCol.map((l) => l.length));
  const scale = (size.height - gap * (maxCount - 1)) / maxTotal;
  const nodes: SankeyNode[] = [];
  byCol.forEach((list, c) => {
    let y = 0;
    for (const id of list) {
      const h = Math.max(1, value(id) * scale);
      nodes.push({ id, column: c, value: value(id), x: cols === 1 ? 0 : (c * (size.width - nodeWidth)) / (cols - 1), y, h });
      y += h + gap;
    }
  });
  const node = new Map(nodes.map((n) => [n.id, n]));
  const outY = new Map(nodes.map((n) => [n.id, n.y]));
  const inY = new Map(nodes.map((n) => [n.id, n.y]));
  const links: SankeyLink[] = live.map((f) => {
    const s = node.get(f.source)!;
    const t = node.get(f.target)!;
    const w = f.value * scale;
    const y0 = outY.get(s.id)!;
    const y1 = inY.get(t.id)!;
    outY.set(s.id, y0 + w);
    inY.set(t.id, y1 + w);
    const x0 = s.x + nodeWidth;
    const x1 = t.x;
    const xm = (x0 + x1) / 2;
    const path = `M${x0.toFixed(1)},${y0.toFixed(1)} C${xm.toFixed(1)},${y0.toFixed(1)} ${xm.toFixed(1)},${y1.toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)} L${x1.toFixed(1)},${(y1 + w).toFixed(1)} C${xm.toFixed(1)},${(y1 + w).toFixed(1)} ${xm.toFixed(1)},${(y0 + w).toFixed(1)} ${x0.toFixed(1)},${(y0 + w).toFixed(1)} Z`;
    return { ...f, path, width: w };
  });
  return { nodes, links };
}

export type FlowFact = { metric_key: string; facility_id: string | null; facility_name: string | null; boundary_kind: string | null; revision: number; status: string; value_num: string | number | null };

/**
 * What ghgFlows draws, from a cycle's fact list: under operational control, the newest revision per metric and
 * facility that is neither superseded nor rejected — facility scope 1 and scope 2 (location), organisation-level
 * scope 1 (mobile) and scope 3. Facilities in name order.
 */
export function ghgFlowInput(facts: FlowFact[]): { facilities: { name: string; scope1: number; scope2: number }[]; orgScope1: number; scope3: number } {
  const keys = ["ghg.scope1", "ghg.scope2.location", "ghg.scope1.mobile", "ghg.scope3"];
  const cur = new Map<string, FlowFact>();
  for (const f of facts) {
    if (!keys.includes(f.metric_key) || f.boundary_kind !== "ghg_operational_control" || f.status === "superseded" || f.status === "rejected") continue;
    const k = `${f.metric_key}|${f.facility_id ?? ""}`;
    const seen = cur.get(k);
    if (!seen || f.revision > seen.revision) cur.set(k, f);
  }
  const v = (metric: string, facility: string | null) => Number(cur.get(`${metric}|${facility ?? ""}`)?.value_num ?? 0);
  const names = new Map<string, string>();
  for (const f of cur.values()) if (f.facility_id) names.set(f.facility_id, f.facility_name ?? f.facility_id);
  const facilities = [...names.entries()].sort((a, b) => a[1].localeCompare(b[1]) || a[0].localeCompare(b[0])).map(([id, name]) => ({ name, scope1: v("ghg.scope1", id), scope2: v("ghg.scope2.location", id) }));
  return { facilities, orgScope1: v("ghg.scope1.mobile", null), scope3: v("ghg.scope3", null) };
}

/** Flows of a cycle's GHG facts: facility → scope, organisation-level items → scope, scopes → total. */
export function ghgFlows(input: { facilities: { name: string; scope1: number; scope2: number }[]; orgScope1: number; scope3: number; labels: { scope1: string; scope2: string; scope3: string; total: string; org: string } }): FlowIn[] {
  const L = input.labels;
  const flows: FlowIn[] = [];
  for (const f of input.facilities) {
    flows.push({ source: f.name, target: L.scope1, value: f.scope1 });
    flows.push({ source: f.name, target: L.scope2, value: f.scope2 });
  }
  if (input.orgScope1 > 0) flows.push({ source: L.org, target: L.scope1, value: input.orgScope1 });
  if (input.scope3 > 0) flows.push({ source: L.org, target: L.scope3, value: input.scope3 });
  const scope1 = input.facilities.reduce((s, f) => s + f.scope1, 0) + input.orgScope1;
  const scope2 = input.facilities.reduce((s, f) => s + f.scope2, 0);
  flows.push({ source: L.scope1, target: L.total, value: scope1 }, { source: L.scope2, target: L.total, value: scope2 }, { source: L.scope3, target: L.total, value: input.scope3 });
  return flows;
}
