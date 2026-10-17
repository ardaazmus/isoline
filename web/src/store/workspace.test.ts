import { describe, expect, it } from "vitest";
import { SAMPLE_CLIENT } from "@/data/sample";
import { unlinkV2GridPicks } from "./workspace";

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
