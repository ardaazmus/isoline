import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { closeChecklistFrom, deriveSteps, STEP_GATES, STEP_IDS, stepOfGate, type Signals } from "./steps";
import { GATE_TEMPLATE } from "../projects/plan";

const base = (): Signals => ({
  cycleStatus: "calculation",
  boundaries: { ghgApproved: true, any: 2, financialMembers: 2 },
  applicability: { total: 0, undecided: 0, unconfirmed: 0 },
  requests: { total: 14, accepted: 7, closed: 7, open: 0, inReview: 0, returned: 0, overdue: 0 },
  facts: { current: 17, notApproved: 17, readyForReview: 17, consolidatedRevenue: false },
  issues: { calcBlockers: 0, calcWarnings: 3, controlBlockers: 0, controlWarnings: 0 },
  runs: { lastCalcAt: "2026-10-19T08:00:00.000Z", lastReconciliationAt: null },
  consolidation: { pendingInputs: 2 },
  close: { snapshots: 0 },
  reports: { total: 1, sections: 7, approvedSections: 0, inChain: 0, released: 0 },
  assurance: { status: null, openQuestions: 0, answeredQuestions: 0 },
});

const at = (s: Signals, id: string) => deriveSteps(s).steps.find((x) => x.id === id)!;

describe("deriveSteps on the demo company's state (19.10.2026)", () => {
  it("puts the cycle at calculation and approval, with scope and collection done", () => {
    const d = deriveSteps(base());
    expect(d.current).toBe("calculate");
    expect(d.steps.map((s) => s.state)).toEqual(["done", "done", "active", "active", "waiting", "active", "optional"]);
    expect(at(base(), "calculate").vars).toMatchObject({ waiting: 17, warnings: 3 });
    expect(at(base(), "controls").summary).toBe("todo_inputs");
  });

  it("lists the close conditions the close screen showed: approvals, warnings, reconciliation, consolidation", () => {
    const c = closeChecklistFrom(base());
    expect(c.canFreeze).toBe(false);
    expect(c.items.filter((i) => i.required && !i.ok).map((i) => i.id)).toEqual(["facts_approved", "warnings_dispositioned", "reconciliation_current", "consolidation_done"]);
  });

  it("is ready to freeze once everything is approved, reconciled after the last run and consolidated", () => {
    const s = base();
    s.facts = { current: 18, notApproved: 0, readyForReview: 0, consolidatedRevenue: true };
    s.issues.calcWarnings = 0;
    s.consolidation.pendingInputs = 0;
    s.runs.lastReconciliationAt = "2026-10-19T09:00:00.000Z";
    expect(closeChecklistFrom(s).canFreeze).toBe(true);
    expect(at(s, "close").state).toBe("ready");
    expect(deriveSteps(s).current).toBe("close");
    s.cycleStatus = "frozen";
    expect(at(s, "close").state).toBe("done");
    expect(deriveSteps(s).current).toBe("report");
  });

  it("asks for reconciliation again when a calculation ran after it", () => {
    const s = base();
    s.runs = { lastCalcAt: "2026-10-19T10:00:00.000Z", lastReconciliationAt: "2026-10-19T09:00:00.000Z" };
    expect(closeChecklistFrom(s).items.find((i) => i.id === "reconciliation_current")!.ok).toBe(false);
  });

  it("does not ask for consolidation with a single legal entity", () => {
    const s = base();
    s.boundaries.financialMembers = 1;
    expect(closeChecklistFrom(s).items.some((i) => i.id === "consolidation_done")).toBe(false);
  });

  it("starts from nothing: scope not started, collection and reports wait for the boundary", () => {
    const s = base();
    s.boundaries = { ghgApproved: false, any: 0, financialMembers: 0 };
    s.requests = { total: 0, accepted: 0, closed: 0, open: 0, inReview: 0, returned: 0, overdue: 0 };
    s.facts = { current: 0, notApproved: 0, readyForReview: 0, consolidatedRevenue: false };
    s.issues.calcWarnings = 0;
    s.reports = { total: 0, sections: 0, approvedSections: 0, inChain: 0, released: 0 };
    s.runs = { lastCalcAt: null, lastReconciliationAt: null };
    const d = deriveSteps(s);
    expect(d.current).toBe("scope");
    expect(d.steps.map((x) => x.state)).toEqual(["not_started", "not_started", "waiting", "waiting", "waiting", "not_started", "optional"]);
  });

  it("finishes with the release, and assurance stays optional unless set up", () => {
    const s = base();
    s.cycleStatus = "released";
    s.facts = { current: 18, notApproved: 0, readyForReview: 0, consolidatedRevenue: true };
    s.issues.calcWarnings = 0;
    s.runs.lastReconciliationAt = "2026-10-20T09:00:00.000Z";
    s.reports = { total: 1, sections: 7, approvedSections: 7, inChain: 0, released: 1 };
    expect(deriveSteps(s).current).toBe("complete");
    s.assurance = { status: "in_progress", openQuestions: 2, answeredQuestions: 0 };
    expect(deriveSteps(s).current).toBe("assurance");
    expect(at(s, "assurance").summary).toBe("open_questions");
  });
});

const nat = fc.nat({ max: 40 });
const iso = fc.option(fc.integer({ min: 0, max: 5 }).map((h) => `2026-10-19T0${h}:00:00.000Z`), { nil: null });
const signals: fc.Arbitrary<Signals> = fc
  .record({
    cycleStatus: fc.constantFrom("planning", "collection", "calculation", "close_review", "frozen", "reopened", "released"),
    boundaries: fc.record({ ghgApproved: fc.boolean(), any: nat, financialMembers: nat }),
    applicability: fc.record({ total: nat, undecided: nat, unconfirmed: nat }),
    req: fc.record({ accepted: nat, closed: nat, open: nat, inReview: nat, returned: nat, overdue: nat }),
    facts: fc.record({ current: nat, notApproved: nat, readyForReview: nat, consolidatedRevenue: fc.boolean() }),
    issues: fc.record({ calcBlockers: nat, calcWarnings: nat, controlBlockers: nat, controlWarnings: nat }),
    runs: fc.record({ lastCalcAt: iso, lastReconciliationAt: iso }),
    consolidation: fc.record({ pendingInputs: nat }),
    close: fc.record({ snapshots: nat }),
    reports: fc.record({ total: nat, sections: nat, approvedSections: nat, inChain: nat, released: nat }),
    assurance: fc.record({ status: fc.constantFrom(null, "preparing", "ready", "in_progress", "opinion_received", "withdrawn"), openQuestions: nat, answeredQuestions: nat }),
  })
  .map(({ req, facts, ...rest }) => ({
    ...rest,
    requests: { ...req, total: req.accepted + req.closed + req.open },
    facts: { ...facts, notApproved: Math.min(facts.notApproved, facts.current) },
  }));

describe("deriveSteps properties", () => {
  it("always returns the seven steps in order, and the current step is the first one not done", () => {
    fc.assert(
      fc.property(signals, (s) => {
        const d = deriveSteps(s);
        expect(d.steps.map((x) => x.id)).toEqual([...STEP_IDS]);
        const first = d.steps.filter((x) => x.id !== "assurance").find((x) => x.state !== "done");
        if (first) expect(d.current).toBe(first.id);
        else expect(["assurance", "complete"]).toContain(d.current);
      }),
    );
  });

  it("never calls a step done while its own record shows work left", () => {
    fc.assert(
      fc.property(signals, (s) => {
        const st = Object.fromEntries(deriveSteps(s).steps.map((x) => [x.id, x.state]));
        if (st.scope === "done") expect(s.boundaries.ghgApproved).toBe(true);
        if (st.collect === "done") expect(s.requests.open === 0 && s.requests.total > 0).toBe(true);
        if (st.calculate === "done") expect(s.facts.current > 0 && s.facts.notApproved === 0 && s.issues.calcBlockers === 0 && s.issues.calcWarnings === 0).toBe(true);
        if (st.controls === "done") expect(s.issues.controlBlockers === 0 && s.issues.controlWarnings === 0 && s.runs.lastReconciliationAt !== null).toBe(true);
        if (st.close === "done") expect(["frozen", "released"]).toContain(s.cycleStatus);
        if (st.report === "done") expect(s.reports.total > 0 && s.reports.released >= s.reports.total).toBe(true);
      }),
    );
  });

  it("only offers the freeze when every required close condition holds, and the close step agrees", () => {
    fc.assert(
      fc.property(signals, (s) => {
        const c = closeChecklistFrom(s);
        expect(c.canFreeze).toBe(c.items.filter((i) => i.required).every((i) => i.ok));
        const close = deriveSteps(s).steps.find((x) => x.id === "close")!;
        if (close.state === "ready") expect(c.canFreeze).toBe(true);
        if (c.canFreeze && !["frozen", "released"].includes(s.cycleStatus)) expect(close.state).toBe("ready");
      }),
    );
  });
});

describe("plan gates and steps", () => {
  it("assigns every plan gate to exactly one step", () => {
    for (const g of GATE_TEMPLATE) expect(stepOfGate(g.gate)).not.toBeNull();
    const all = Object.values(STEP_GATES).flat();
    expect(new Set(all).size).toBe(all.length);
    expect(all.length).toBe(GATE_TEMPLATE.length);
  });
});
