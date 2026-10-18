import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { SAMPLE_CLIENT } from "@/data/sample";
import { act, APPROVAL_STATUSES, availableActions, emptyApproval, isLocked, lockedBy, MOVES, type Approval, type ApprovalAction } from "./approval";

const T = "2026-10-18T10:00:00.000Z";

describe("approval moves", () => {
  it("runs the normal cycle draft → review → approved → published and records each step", () => {
    let a = emptyApproval();
    for (const [action, by] of [
      ["submit", "Ayşe Kaya"],
      ["approve", "Mehmet Demir"],
      ["publish", "Mehmet Demir"],
    ] as [ApprovalAction, string][]) {
      const r = act(a, action, by, T);
      if (!r.ok) throw new Error(r.error);
      a = r.next;
    }
    expect(a).toMatchObject({ status: "published", preparedBy: "Ayşe Kaya", approvedBy: "Mehmet Demir", approvedAt: T });
    expect(a.log.map((e) => `${e.from}>${e.to}`)).toEqual(["draft>review", "review>approved", "approved>published"]);
  });
  it("refuses self-approval, whatever the spacing or case of the name", () => {
    const r = act(emptyApproval(), "submit", "Ayşe Kaya", T);
    if (!r.ok) throw new Error(r.error);
    expect(act(r.next, "approve", "  ayşe KAYA ", T)).toEqual({ ok: false, error: "samePerson" });
    expect(act(r.next, "approve", "İlker", T).ok).toBe(true);
  });
  it("needs a name, and a reason to send back or reopen", () => {
    expect(act(emptyApproval(), "submit", "  ", T)).toEqual({ ok: false, error: "needName" });
    const sub = act(emptyApproval(), "submit", "A", T);
    if (!sub.ok) throw new Error(sub.error);
    expect(act(sub.next, "sendBack", "B", T)).toEqual({ ok: false, error: "needReason" });
    const back = act(sub.next, "sendBack", "B", T, "Kapsam 3 eksik");
    expect(back.ok && back.next.log.at(-1)).toMatchObject({ from: "review", to: "draft", reason: "Kapsam 3 eksik" });
  });
  it("reopening unlocks, clears the current approval and keeps it in the log", () => {
    let a = emptyApproval();
    for (const [action, by] of [
      ["submit", "A"],
      ["approve", "B"],
    ] as [ApprovalAction, string][]) {
      const r = act(a, action, by, T);
      if (!r.ok) throw new Error(r.error);
      a = r.next;
    }
    expect(isLocked(a)).toBe(true);
    const r = act(a, "reopen", "B", T, "Tedarikçi faturası düzeltildi");
    if (!r.ok) throw new Error(r.error);
    expect(r.next).toMatchObject({ status: "draft", approvedBy: "", approvedAt: null });
    expect(isLocked(r.next)).toBe(false);
    expect(r.next.log.map((e) => e.to)).toEqual(["review", "approved", "draft"]);
  });
  it("offers only the moves that are open from a status", () => {
    expect(availableActions("draft")).toEqual(["submit"]);
    expect(availableActions("review")).toEqual(["sendBack", "approve"]);
    expect(availableActions("approved")).toEqual(["publish", "reopen"]);
    expect(availableActions("published")).toEqual(["reopen"]);
  });

  const actions = Object.keys(MOVES) as ApprovalAction[];
  const step = fc.record({
    action: fc.constantFrom(...actions),
    by: fc.constantFrom("", "A", "a ", "B", "C"),
    reason: fc.constantFrom("", "gerekçe"),
  });

  it("property: every recorded move is an allowed edge, the log only grows and the status is its last target", () => {
    fc.assert(
      fc.property(fc.array(step, { maxLength: 40 }), (steps) => {
        let a: Approval = emptyApproval();
        for (const s of steps) {
          const before = a;
          const r = act(a, s.action, s.by, T, s.reason);
          if (!r.ok) continue;
          a = r.next;
          expect(a.log.length).toBe(before.log.length + 1);
          expect(a.log.slice(0, -1)).toEqual(before.log);
        }
        for (const e of a.log) {
          const edge = Object.values(MOVES).some(([from, to]) => from.includes(e.from) && to === e.to);
          expect(edge).toBe(true);
        }
        expect(a.status).toBe(a.log.at(-1)?.to ?? "draft");
        expect(APPROVAL_STATUSES).toContain(a.status);
      }),
    );
  });
  it("property: an approval is never recorded by the person who submitted it", () => {
    fc.assert(
      fc.property(fc.array(step, { maxLength: 40 }), (steps) => {
        let a: Approval = emptyApproval();
        for (const s of steps) {
          const r = act(a, s.action, s.by, T, s.reason);
          if (r.ok) a = r.next;
          if (r.ok && s.action === "approve") expect(r.next.approvedBy.trim().toLocaleLowerCase("tr")).not.toBe(r.next.preparedBy.trim().toLocaleLowerCase("tr"));
        }
      }),
    );
  });
});

describe("period lock", () => {
  const approved = (): Approval => ({ status: "approved", preparedBy: "A", approvedBy: "B", approvedAt: T, log: [] });

  it("refuses a change to a locked section and allows it when the section is open", () => {
    const c = structuredClone(SAMPLE_CLIENT);
    const nextGhg = { ...c.ghg, fuels: [] };
    expect(lockedBy(c, "ghg", nextGhg)).toBeNull();
    c.approvals = { ghg: approved() };
    expect(lockedBy(c, "ghg", nextGhg)).toBe("ghg");
    expect(lockedBy(c, "ghg", structuredClone(c.ghg))).toBeNull(); // same content is not a change
    expect(lockedBy(c, "cbam", { ...c.cbam, products: [] })).toBeNull();
  });
  it("locks only the section's own parts of a shared key", () => {
    const c = structuredClone(SAMPLE_CLIENT);
    c.approvals = { environment: approved() };
    const envChange = { ...c.indicators, env: { ...c.indicators.env, waterWithdrawalM3: 1 } };
    const safetyChange = { ...c.indicators, safety: { ...c.indicators.safety, hoursWorked: 1 } };
    expect(lockedBy(c, "indicators", envChange)).toBe("environment");
    expect(lockedBy(c, "indicators", safetyChange)).toBeNull();
  });
  it("never locks approvals themselves, so a locked section can be reopened", () => {
    const c = structuredClone(SAMPLE_CLIENT);
    c.approvals = { ghg: approved() };
    expect(lockedBy(c, "approvals", {})).toBeNull();
  });
});
