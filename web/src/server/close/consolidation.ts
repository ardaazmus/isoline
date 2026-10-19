/**
 * Financial consolidation of revenue (G5-02; IFRS 10 / TFRS 10), kept apart from the GHG code on purpose:
 *   - the parent and its subsidiaries (financial reporting boundary above 0 %) are consolidated line by line, at
 *     100 % of their revenue whatever the ownership share (non-controlling interests do not reduce revenue); one
 *     controlled for part of the year counts for that part only (its entered revenue must cover only that part);
 *   - joint ventures and associates use the equity method (IAS 28): their revenue stays outside;
 *   - sales between consolidated entities are eliminated in full (IFRS 10 B86(c)); a sale to or from an entity
 *     outside the consolidation is external revenue and is not eliminated.
 * Amounts are exact: kuruş as BigInt, never floating point (plan 09 §4).
 */

export type MemberIn = { entityId: string; pct: number; reason: string };
export type FinancialIn = { id: string; entityId: string; netSales: string; status: string };
export type EliminationIn = { id: string; seller: string; buyer: string; amount: string; status: string };
export type ConsolidationWarning = { code: string; target: string; severity: "blocker" | "warning"; detail?: Record<string, unknown> };

export type ConsolidationResult = {
  included: { entityId: string; netSales: string }[];
  equityMethod: string[];
  eliminated: { id: string; seller: string; buyer: string; amount: string }[];
  grossRevenue: string;
  eliminations: string;
  consolidatedRevenue: string;
  usedFinancials: string[];
  usedEliminations: string[];
  warnings: ConsolidationWarning[];
};

/** "1234.5" / "1234.50" / "-3" → kuruş. Throws on anything else (the database gives numeric(38,2) strings). */
export function toKurus(v: string): bigint {
  const m = /^(-)?(\d+)(?:\.(\d{1,2}))?$/.exec(v.trim());
  if (!m) throw new Error(`not a decimal amount: ${v}`);
  const k = BigInt(m[2]) * 100n + BigInt((m[3] ?? "").padEnd(2, "0") || "0");
  return m[1] ? -k : k;
}

export function fromKurus(k: bigint): string {
  const neg = k < 0n;
  const a = neg ? -k : k;
  return `${neg ? "-" : ""}${a / 100n}.${String(a % 100n).padStart(2, "0")}`;
}

export function consolidateRevenue(members: MemberIn[], financials: FinancialIn[], eliminations: EliminationIn[]): ConsolidationResult {
  const warnings: ConsolidationWarning[] = [];
  // controlled for at least part of the period (the boundary share is day-weighted): consolidated from the date
  // control was obtained until it was lost, so the entered revenue must cover only that part of the year
  const consolidated = new Set(members.filter((m) => m.pct > 0).map((m) => m.entityId));
  for (const m of members.filter((x) => x.pct > 0 && x.pct < 100)) warnings.push({ code: "consolidation_partial_period", target: m.entityId, severity: "warning", detail: { pct: m.pct } });
  const equityMethod = members.filter((m) => m.pct === 0 && (m.reason === "equity_method" || m.reason === "joint_venture_share" || m.reason === "associate_excluded")).map((m) => m.entityId);

  const approved = financials.filter((f) => f.status === "approved");
  const included: ConsolidationResult["included"] = [];
  let gross = 0n;
  for (const id of [...consolidated].sort()) {
    const f = approved.find((x) => x.entityId === id);
    if (!f) {
      const pending = financials.some((x) => x.entityId === id && x.status === "submitted");
      warnings.push({ code: pending ? "entity_financials_not_approved" : "entity_financials_missing", target: id, severity: "blocker" });
      continue;
    }
    included.push({ entityId: id, netSales: fromKurus(toKurus(f.netSales)) });
    gross += toKurus(f.netSales);
  }

  const sold = new Map<string, bigint>();
  const eliminated: ConsolidationResult["eliminated"] = [];
  let elim = 0n;
  for (const e of eliminations.filter((x) => x.status === "approved")) {
    if (!consolidated.has(e.seller) || !consolidated.has(e.buyer)) {
      warnings.push({ code: "elimination_outside_group", target: e.id, severity: "warning", detail: { seller: e.seller, buyer: e.buyer } });
      continue;
    }
    const k = toKurus(e.amount);
    elim += k;
    sold.set(e.seller, (sold.get(e.seller) ?? 0n) + k);
    eliminated.push({ id: e.id, seller: e.seller, buyer: e.buyer, amount: fromKurus(k) });
  }
  for (const e of eliminations.filter((x) => x.status === "submitted")) warnings.push({ code: "elimination_not_approved", target: e.id, severity: "blocker" });
  // a seller cannot have sold more inside the group than its whole revenue
  for (const [seller, k] of sold) {
    const f = included.find((x) => x.entityId === seller);
    if (f && k > toKurus(f.netSales)) warnings.push({ code: "elimination_exceeds_sales", target: seller, severity: "blocker", detail: { eliminated: fromKurus(k), netSales: f.netSales } });
  }
  return {
    included,
    equityMethod,
    eliminated,
    grossRevenue: fromKurus(gross),
    eliminations: fromKurus(elim),
    consolidatedRevenue: fromKurus(gross - elim),
    usedFinancials: approved.filter((f) => consolidated.has(f.entityId)).map((f) => f.id),
    usedEliminations: eliminated.map((e) => e.id),
    warnings,
  };
}
