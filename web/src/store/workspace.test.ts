import { describe, expect, it } from "vitest";
import { SAMPLE_CLIENT } from "@/data/sample";
import { computeInventory } from "@/lib/calc/ghg";
import { addV4Fields, addV5Fields, addV6Fields, addV7Fields, isClientShape, migrateClients, unlinkV2GridPicks, useWorkspace } from "./workspace";
import { JOURNEYS } from "@/data/journey";
import { EVENTS, eventDate } from "@/data/regulations";

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

describe("workspace v6 migration", () => {
  it("adds an empty import log, and the sample's trial balance record when its sample file is in place", () => {
    const s = structuredClone(SAMPLE_CLIENT) as Partial<typeof SAMPLE_CLIENT>;
    delete s.importLog;
    const o = { ...structuredClone(s), id: "c-z", sample: false };
    const [a, b] = addV6Fields([s as typeof SAMPLE_CLIENT, o as typeof SAMPLE_CLIENT]);
    expect(a.importLog).toEqual(SAMPLE_CLIENT.importLog);
    expect(b.importLog).toEqual([]);
  });
});

describe("workspace v7 migration", () => {
  it("writes the IPCC CH₄ and N₂O defaults into fuel lines that lack them and keeps typed values", () => {
    const c = structuredClone(SAMPLE_CLIENT);
    c.ghg.fuels = [
      { id: "a", fuel: "natural_gas", label: "", amount: 1, ncv: 0.0345, ef: 56.1, mobile: false, quality: "measured" },
      { id: "b", fuel: "diesel", label: "", amount: 1, ncv: 0.036, ef: 74.1, mobile: true, quality: "measured" },
      { id: "c", fuel: "coal", label: "", amount: 1, ncv: 25.8, ef: 94.6, mobile: false, quality: "measured", ch4: 0, n2o: 2 },
    ];
    const before = computeInventory(c.ghg).scope1;
    const [out] = addV7Fields([c]);
    expect(out.ghg.fuels.map((l) => [l.ch4, l.n2o])).toEqual([
      [1, 0.1],
      [3.9, 3.9],
      [0, 2],
    ]);
    // the stored values are the ones the engine used before, so totals do not move
    expect(computeInventory(out.ghg).scope1).toBe(before);
  });
  it("runs every step for an old workspace file", () => {
    const c = structuredClone(SAMPLE_CLIENT) as Partial<typeof SAMPLE_CLIENT>;
    delete c.importLog;
    c.ghg = {
      ...c.ghg!,
      fuels: c.ghg!.fuels.map((l) => {
        const old = { ...l };
        delete old.ch4;
        delete old.n2o;
        return old;
      }),
    };
    const [out] = migrateClients([c as typeof SAMPLE_CLIENT], 5);
    expect(out.importLog).toBeDefined();
    expect(out.ghg.fuels.every((l) => l.ch4 !== undefined && l.n2o !== undefined)).toBe(true);
  });
});

describe("workspace import", () => {
  it("accepts the sample and refuses clients the screens would crash on", () => {
    expect(isClientShape(structuredClone(SAMPLE_CLIENT))).toBe(true);
    const noHistory = { ...structuredClone(SAMPLE_CLIENT), profile: { ...SAMPLE_CLIENT.profile, history: undefined } };
    const noFuels = { ...structuredClone(SAMPLE_CLIENT), ghg: { ...SAMPLE_CLIENT.ghg, fuels: null } };
    expect(isClientShape(noHistory)).toBe(false);
    expect(isClientShape(noFuels)).toBe(false);
    expect(isClientShape(null)).toBe(false);
  });
  it("journey stages survive a short history and take deadlines from the sourced calendar", () => {
    const c = { ...structuredClone(SAMPLE_CLIENT), profile: { ...SAMPLE_CLIENT.profile, history: [SAMPLE_CLIENT.profile.history[0]] } };
    expect(JOURNEYS.sustainability[0].derive!(c as typeof SAMPLE_CLIENT)).toBe(0);
    const deadlines = Object.values(JOURNEYS).flatMap((st) => st.map((s) => s.deadline?.(c as typeof SAMPLE_CLIENT)).filter(Boolean));
    expect(deadlines.length).toBeGreaterThan(0);
    for (const d of deadlines) expect(EVENTS.some((e) => e.date === d)).toBe(true);
    expect(() => eventDate("no_such_event")).toThrow();
  });
});

describe("workspace v8: approvals and the period lock", () => {
  it("adds an empty approvals record to clients that lack one", () => {
    const c = structuredClone(SAMPLE_CLIENT) as Partial<typeof SAMPLE_CLIENT>;
    delete c.approvals;
    const [out] = migrateClients([c as typeof SAMPLE_CLIENT], 7);
    expect(out.approvals).toEqual({});
  });
  it("the store refuses a change to a locked section and accepts it after reopening", () => {
    const st = useWorkspace.getState();
    st.restoreSample();
    const id = useWorkspace.getState().activeId;
    const ghg = () => useWorkspace.getState().clients.find((x) => x.id === id)!.ghg;
    const fuels = ghg().fuels.length;
    useWorkspace.getState().update("approvals", { ghg: { status: "approved", preparedBy: "A", approvedBy: "B", approvedAt: "2026-10-18T10:00:00.000Z", log: [] } });
    useWorkspace.getState().update("ghg", { ...ghg(), fuels: [] });
    expect(ghg().fuels.length).toBe(fuels);
    useWorkspace.getState().update("approvals", {});
    useWorkspace.getState().update("ghg", { ...ghg(), fuels: [] });
    expect(ghg().fuels.length).toBe(0);
    useWorkspace.getState().restoreSample();
  });
});
