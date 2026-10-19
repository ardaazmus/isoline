/** G5-02/03: revenue consolidation (exact, IFRS 10) and the U1–U5 cross-checks. */
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { consolidateRevenue, fromKurus, toKurus } from "./consolidation";
import { reconcile, type FactIn } from "./reconcile";

const members = [
  { entityId: "P", pct: 100, reason: "reporting_parent" },
  { entityId: "S1", pct: 100, reason: "subsidiary" },
  { entityId: "S2", pct: 100, reason: "subsidiary" },
  { entityId: "JV", pct: 0, reason: "equity_method" },
];
const fin = (entityId: string, netSales: string, status = "approved") => ({ id: `f-${entityId}`, entityId, netSales, status });
const elim = (id: string, seller: string, buyer: string, amount: string, status = "approved") => ({ id, seller, buyer, amount, status });

describe("revenue consolidation", () => {
  it("sums consolidated entities at 100 %, leaves equity-method entities out and eliminates group sales", () => {
    const r = consolidateRevenue(members, [fin("P", "1000000.00"), fin("S1", "500000.10"), fin("S2", "250000.20"), fin("JV", "999999.99")], [elim("e1", "S1", "P", "120000.05"), elim("e2", "P", "JV", "50000.00")]);
    expect(r.grossRevenue).toBe("1750000.30");
    expect(r.eliminations).toBe("120000.05");
    expect(r.consolidatedRevenue).toBe("1630000.25");
    expect(r.equityMethod).toEqual(["JV"]);
    // a sale to the joint venture is external revenue for the group
    expect(r.warnings.map((w) => w.code)).toEqual(["elimination_outside_group"]);
  });

  it("missing or unapproved inputs block; eliminations above the seller's revenue block", () => {
    const r = consolidateRevenue(members, [fin("P", "100.00"), fin("S1", "50.00", "submitted")], [elim("e1", "P", "S2", "150.00")]);
    expect(r.warnings.filter((w) => w.severity === "blocker").map((w) => `${w.code}:${w.target}`).sort()).toEqual(["elimination_exceeds_sales:P", "entity_financials_missing:S2", "entity_financials_not_approved:S1"]);
  });

  it("property: exact — consolidated = Σ revenue − Σ internal eliminations, to the kuruş", () => {
    const amount = fc.bigInt({ min: 0n, max: 10n ** 15n }).map(fromKurus);
    fc.assert(
      fc.property(amount, amount, amount, fc.bigInt({ min: 1n, max: 10n ** 9n }), (a, b, c, e) => {
        const r = consolidateRevenue(members, [fin("P", a), fin("S1", b), fin("S2", c)], [elim("x", "S1", "S2", fromKurus(e))]);
        expect(toKurus(r.consolidatedRevenue)).toBe(toKurus(a) + toKurus(b) + toKurus(c) - (r.usedEliminations.length ? e : 0n));
      }),
    );
  });

  it("kuruş conversion round-trips", () => {
    fc.assert(
      fc.property(fc.bigInt({ min: -(10n ** 20n), max: 10n ** 20n }), (k) => {
        expect(toKurus(fromKurus(k))).toBe(k);
      }),
    );
    expect(toKurus("12.5")).toBe(1250n);
    expect(() => toKurus("1e5")).toThrow();
  });
});

const f = (metricKey: string, value: number, facilityId: string | null = null, boundaryKind: string | null = null): FactIn => ({ id: `${metricKey}:${facilityId}`, metricKey, facilityId, boundaryKind, value });
const status = (checks: ReturnType<typeof reconcile>, code: string) => checks.filter((c) => c.code === code).map((c) => c.status);

describe("U1–U5 cross-checks", () => {
  const base = { reportedRevenue: null, profileEmployees: null, production: {}, cbamExports: {} };
  it("U1: the revenue used by intensities must equal the anchor within rounding; the consolidated figure wins", () => {
    const facts = [f("finance.net_sales", 1_000_000), f("finance.consolidated_net_sales", 1_630_000)];
    expect(status(reconcile({ ...base, facts, reportedRevenue: 1_630_000 }), "u1_revenue")).toEqual(["pass"]);
    const fail = reconcile({ ...base, facts, reportedRevenue: 1_000_000 }).find((c) => c.code === "u1_revenue")!;
    expect([fail.status, fail.severity]).toEqual(["fail", "blocker"]);
  });

  it("U2: total energy below the GHG inventory's energy is a contradiction", () => {
    expect(status(reconcile({ ...base, facts: [f("env.energy_gj", 900), f("ghg.energy_gj", 1000, null, "ghg_operational_control")] }), "u2_energy")).toEqual(["fail"]);
    expect(status(reconcile({ ...base, facts: [f("env.energy_gj", 1200), f("ghg.energy_gj", 1000, null, "ghg_operational_control")] }), "u2_energy")).toEqual(["pass"]);
  });

  it("U3 warns, U4 and U5 block per facility", () => {
    const c = reconcile({ facts: [f("workforce.headcount", 130), f("ets.verified_emissions", 60_000, "a"), f("ghg.scope1", 50_000, "a", "ghg_operational_control")], reportedRevenue: null, profileEmployees: 100, production: { a: 1000 }, cbamExports: { a: 1200 } });
    const by = (code: string) => c.find((x) => x.code === code)!;
    expect([by("u3_headcount").status, by("u3_headcount").severity]).toEqual(["fail", "warning"]);
    expect([by("u4_cbam_exports").status, by("u4_cbam_exports").severity]).toEqual(["fail", "blocker"]);
    expect([by("u5_ets_scope1").status, by("u5_ets_scope1").severity]).toEqual(["fail", "blocker"]);
  });

  it("without data every rule is 'na', never a silent pass", () => {
    expect(reconcile({ ...base, facts: [] }).every((c) => c.status === "na")).toBe(true);
  });
});
