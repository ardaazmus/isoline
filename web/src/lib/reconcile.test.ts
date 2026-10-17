import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { emptyClient, SAMPLE_CLIENT, type ClientData } from "@/data/sample";
import { applyNote, reconcile, reconcileRecords, relDiff, RULES, worstStatus, type Check, type CheckStatus, type RuleId } from "./reconcile";

const clone = () => structuredClone(SAMPLE_CLIENT);
const rule = (c: ClientData, id: RuleId) => reconcile(c).rules.find((r) => r.id === id)!;
const check = (c: ClientData, id: string) => reconcile(c).rules.flatMap((r) => r.checks).find((k) => k.id === id)!;

describe("reconciliation on the sample client", () => {
  it("passes the consistent rules and flags the demo findings", () => {
    const r = reconcile(SAMPLE_CLIENT);
    expect(Object.fromEntries(r.rules.map((x) => [x.id, x.status]))).toEqual({ U1: "pass", U2: "pass", U3: "pass", U4: "pass", U5: "pass", U8: "warn", U9: "warn", U10: "fail" });
    expect(r.counts).toEqual({ pass: 5, explained: 0, warn: 2, fail: 1, na: 0 });
  });
  it("explains one year-over-year jump and leaves the unexplained one as a warning", () => {
    expect(check(SAMPLE_CLIENT, "U8.scope3").status).toBe("explained");
    expect(check(SAMPLE_CLIENT, "U8.water").status).toBe("warn");
    expect(check(SAMPLE_CLIENT, "U8.water").diff).toBeCloseTo(9_800_000 / 7_900_000 - 1, 10);
  });
  it("lists the green-claim phrases behind U10", () => {
    const high = check(SAMPLE_CLIENT, "U10.claimsHigh");
    expect(high.a.value).toBeGreaterThan(0);
    expect(high.items!.join(" ").toLowerCase()).toContain("karbon nötr");
  });
  it("runs every catalogued rule, U6–U7 excluded", () => {
    expect(reconcile(SAMPLE_CLIENT).rules.map((r) => r.id)).toEqual(RULES.map((r) => r.id));
    expect(RULES.map((r) => r.id)).not.toContain("U6");
  });
});

describe("rules", () => {
  it("U1 fails when the taxonomy turnover differs from the financial statements", () => {
    const c = clone();
    c.taxonomy.totals.turnover = 40_000;
    const k = check(c, "U1.taxTurnover");
    expect(k.status).toBe("fail");
    expect(k.b).toEqual({ src: "anchorSales", value: 42_000 });
    expect(k.diff).toBeCloseTo(-2 / 42, 10);
  });
  it("U1 uses the inventory as reference without an anchor and needs two figures", () => {
    const c = clone();
    c.reconciliation.anchors.netSalesMillionTry = null;
    expect(rule(c, "U1").checks.map((k) => k.b?.src)).toEqual(["ghgRevenue", "ghgRevenue"]);
    c.indicators.env.revenueMillionTry = 0;
    c.taxonomy.totals.turnover = 0;
    expect(rule(c, "U1").status).toBe("na");
  });
  it("U1 tolerates rounding within the match tolerance", () => {
    const c = clone();
    c.indicators.env.revenueMillionTry = 42_150; // +0.36 %
    expect(check(c, "U1.envRevenue").status).toBe("pass");
    c.indicators.env.revenueMillionTry = 42_300; // +0.71 %
    expect(check(c, "U1.envRevenue").status).toBe("fail");
  });
  it("U2 fails when the energy indicator misses fuel and electricity energy, and an explanation does not clear it", () => {
    const c = clone();
    c.indicators.env.energyGj = 20_000_000;
    expect(check(c, "U2.envEnergy").status).toBe("fail");
    c.reconciliation.notes["U2.envEnergy"] = "Kömür verisi ayrı raporlanıyor";
    const k = check(c, "U2.envEnergy");
    expect(k.status).toBe("fail");
    expect(k.note).toBe("Kömür verisi ayrı raporlanıyor");
  });
  it("U2 warns when renewable energy is below the certified renewable electricity", () => {
    const c = clone();
    c.indicators.env.renewableGj = 100_000;
    expect(check(c, "U2.envRenewable").status).toBe("warn");
  });
  it("U3 warns on a headcount gap and an explanation resolves it", () => {
    const c = clone();
    c.reconciliation.anchors.headcount = 2_700;
    expect(check(c, "U3.hrEnd").status).toBe("warn");
    c.reconciliation.notes["U3.hrEnd"] = "Faaliyet raporu taşeron çalışanları da sayıyor.";
    expect(check(c, "U3.hrEnd").status).toBe("explained");
    expect(rule(c, "U3").status).toBe("explained");
  });
  it("U3 warns when the group headcount is below the entity headcount", () => {
    const c = clone();
    c.profile.employeesGroup = 2_000;
    expect(check(c, "U3.profileEmployeesGroup").status).toBe("warn");
  });
  it("U4 fails when CBAM exports exceed production and has nothing to check without exports", () => {
    const c = clone();
    c.ghg.productionTonnes = 50_000;
    expect(check(c, "U4.ghgProduction").status).toBe("fail");
    expect(check(c, "U4.etsActivity").status).toBe("pass");
    c.cbam.products = [];
    expect(rule(c, "U4").status).toBe("na");
  });
  it("U5 fails when the ETS facility emits more than the company's scope 1", () => {
    const c = clone();
    c.ets.emissions = 2_200_000;
    expect(check(c, "U5.etsEmissions").status).toBe("fail");
    expect(check(c, "U5.profileEmissions").status).toBe("warn");
  });
  it("U8 takes revenue and headcount priors from the app and needs a prior for the rest", () => {
    const c = clone();
    c.reconciliation.prior = {};
    expect(check(c, "U8.revenue").b).toEqual({ src: "prior", value: 42_000 });
    expect(check(c, "U8.headcount").b).toEqual({ src: "prior", value: 2_350 });
    expect(check(c, "U8.scope1").status).toBe("na");
  });
  it("U8 compares against the tolerance set by the user", () => {
    const c = clone();
    c.reconciliation.tolerances.yoy = 0.3;
    expect(check(c, "U8.water").status).toBe("pass");
  });
  it("U9 follows the estimated-data threshold", () => {
    const c = clone();
    expect(check(c, "U9.estimated3").status).toBe("warn");
    c.reconciliation.tolerances.estimated = 0.8;
    expect(check(c, "U9.estimated3").status).toBe("pass");
  });
  it("U10 has nothing to check without text and passes clean text", () => {
    const c = clone();
    c.claims.text = "";
    expect(rule(c, "U10").status).toBe("na");
    c.claims.text = "2026 yılında Kapsam 1 emisyonlarımız 1,9 milyon tCO₂e oldu.";
    expect(rule(c, "U10").status).toBe("pass");
  });
  it("finds nothing to check on an empty client", () => {
    const r = reconcile(emptyClient("c-1", "Yeni"));
    expect(r.counts).toEqual({ pass: 0, explained: 0, warn: 0, fail: 0, na: 8 });
  });
});

describe("records for the auditor file", () => {
  it("writes one row per check with its explanation", () => {
    const r = reconcile(SAMPLE_CLIENT);
    const rows = reconcileRecords(r);
    expect(rows).toHaveLength(r.rules.reduce((n, x) => n + x.checks.length, 0));
    expect(rows.find((x) => x.check === "U8.scope3")).toMatchObject({ rule: "U8", status: "explained", note: SAMPLE_CLIENT.reconciliation.notes["U8.scope3"] });
  });
});

const STATUSES: CheckStatus[] = ["pass", "explained", "warn", "fail", "na"];
const RANK: Record<CheckStatus, number> = { na: 0, pass: 1, explained: 2, warn: 3, fail: 4 };

describe("properties", () => {
  it("the rule status is the worst check status, and 'na' only when every check is 'na'", () => {
    fc.assert(
      fc.property(fc.array(fc.constantFrom(...STATUSES), { minLength: 1, maxLength: 12 }), (xs) => {
        const w = worstStatus(xs);
        expect(xs).toContain(w);
        xs.forEach((s) => expect(RANK[w]).toBeGreaterThanOrEqual(RANK[s]));
        expect(w === "na").toBe(xs.every((s) => s === "na"));
      }),
    );
  });
  it("an explanation turns only a warning into 'explained' and never changes anything else", () => {
    fc.assert(
      fc.property(fc.constantFrom(...STATUSES), fc.string(), (status, note) => {
        const k: Check = { id: "U9.x", rule: "U9", rel: "lte", unit: "share", a: { src: "estimated3", value: 0.5 }, status };
        const out = applyNote(k, note).status;
        expect(out).toBe(status === "warn" && note.trim() ? "explained" : status);
      }),
    );
  });
  it("U1 does not depend on the unit the revenue figures are written in", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 200_000 }), fc.integer({ min: 1, max: 200_000 }), fc.integer({ min: 1, max: 1000 }), (x, y, k) => {
        const a = clone();
        a.reconciliation.anchors.netSalesMillionTry = x;
        a.ghg.revenueMillionTry = y;
        a.indicators.env.revenueMillionTry = 0;
        a.taxonomy.totals.turnover = 0;
        const b = structuredClone(a);
        b.reconciliation.anchors.netSalesMillionTry = x * k;
        b.ghg.revenueMillionTry = y * k;
        expect(rule(b, "U1").status).toBe(rule(a, "U1").status);
      }),
    );
  });
  it("U4 never fails while exports stay within production and activity", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 1_000_000 }), fc.integer({ min: 0, max: 1_000_000 }), (production, extra) => {
        const c = clone();
        c.ghg.productionTonnes = production + extra;
        c.ets.activity = production + extra;
        c.cbam.products = c.cbam.products.map((p, i) => ({ ...p, tonnes: i === 0 ? production : 0 }));
        expect(check(c, "U4.ghgProduction").status).toBe("pass");
        expect(check(c, "U4.etsActivity").status).toBe("pass");
      }),
    );
  });
  it("relative difference is antisymmetric in sign and zero only for equal values", () => {
    fc.assert(
      fc.property(fc.double({ min: 0.001, max: 1e9, noNaN: true }), fc.double({ min: 0.001, max: 1e9, noNaN: true }), (a, b) => {
        expect(Math.sign(relDiff(a, b))).toBe(-Math.sign(relDiff(b, a)) || 0);
        expect(relDiff(a, a)).toBe(0);
      }),
    );
  });
});
