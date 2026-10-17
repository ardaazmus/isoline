import { describe, expect, it } from "vitest";
import { SAMPLE_CLIENT } from "@/data/sample";
import { addV4Fields, addV5Fields, unlinkV2GridPicks } from "./workspace";

describe("workspace v3 migration", () => {
  it("drops v2 grid picks from the supplier factor but keeps the typed value", () => {
    const c = structuredClone(SAMPLE_CLIENT);
    c.ghg.electricity = [{ ...c.ghg.electricity[0], supplierFactor: 0.469, factorRef: "etkb_2023/etkb_2023:distribution" }];
    const [out] = unlinkV2GridPicks([c]);
    expect(out.ghg.electricity[0].factorRef).toBeUndefined();
    expect(out.ghg.electricity[0].supplierFactor).toBe(0.469);
    expect(out.ghg.electricity[0].gridFactor).toBeUndefined();
  });
  it("leaves clients without grid picks untouched", () => {
    const c = structuredClone(SAMPLE_CLIENT);
    expect(unlinkV2GridPicks([c])[0]).toBe(c);
  });
});

describe("workspace v4 migration", () => {
  it("gives the sample client its reconciliation demo and other clients empty defaults", () => {
    const sample = structuredClone(SAMPLE_CLIENT) as Partial<typeof SAMPLE_CLIENT>;
    delete sample.reconciliation;
    delete sample.claims;
    const other = { ...structuredClone(sample), id: "c-x", name: "Müşteri", sample: false };
    const [s, o] = addV4Fields([sample as typeof SAMPLE_CLIENT, other as typeof SAMPLE_CLIENT]);
    expect(s.reconciliation).toEqual(SAMPLE_CLIENT.reconciliation);
    expect(s.claims).toEqual(SAMPLE_CLIENT.claims);
    expect(o.reconciliation.anchors).toEqual({ netSalesMillionTry: null, headcount: null });
    expect(o.claims.text).toBe("");
  });
  it("keeps existing reconciliation data", () => {
    const c = structuredClone(SAMPLE_CLIENT);
    c.reconciliation.notes = { "U8.water": "Yeni soğutma kulesi" };
    expect(addV4Fields([c])[0].reconciliation.notes).toEqual({ "U8.water": "Yeni soğutma kulesi" });
  });
});

describe("workspace v5 migration", () => {
  it("gives the sample client its trial balance and other clients none", () => {
    const s = structuredClone(SAMPLE_CLIENT) as Partial<typeof SAMPLE_CLIENT>;
    delete s.trialBalance;
    const o = { ...structuredClone(s), id: "c-y", sample: false };
    const [a, b] = addV5Fields([s as typeof SAMPLE_CLIENT, o as typeof SAMPLE_CLIENT]);
    expect(a.trialBalance).toEqual(SAMPLE_CLIENT.trialBalance);
    expect(b.trialBalance).toBeNull();
  });
});
