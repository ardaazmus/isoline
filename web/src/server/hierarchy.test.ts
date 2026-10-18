import { describe, expect, it } from "vitest";
import { canTransition, consolidateFacilities, needsJustification, reviewGate } from "./hierarchy";

describe("consolidateFacilities", () => {
  it("takes 100% under control methods and the share under equity", () => {
    const { rows, total } = consolidateFacilities([
      { id: "a", name: "Gebze", control: "OPERATIONAL", equityShare: 60, emissions: 1000 },
      { id: "b", name: "İştirak", control: "EQUITY", equityShare: 50, emissions: 1000 },
    ]);
    expect(rows[0].attributed).toBe(1000);
    expect(rows[1].attributed).toBe(500);
    expect(total).toBe(1500);
  });
});

describe("workflow gates", () => {
  it("blocks review without evidence and flags >30% YoY jumps", () => {
    expect(reviewGate(0)).toEqual({ ok: false, reason: "missingEvidence" });
    expect(reviewGate(1)).toEqual({ ok: true });
    expect(canTransition("IN_PROGRESS", "IN_REVIEW")).toBe(true);
    expect(canTransition("TODO", "IN_REVIEW")).toBe(false);
    expect(needsJustification(140, 100)).toBe(true);
    expect(needsJustification(110, 100)).toBe(false);
  });
});
