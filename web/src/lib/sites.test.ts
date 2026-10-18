import { describe, expect, it } from "vitest";
import { addSite, asSites, canonicalSiteNames, consolidate, emptySites, siteWeight, type Site } from "./sites";

const s = (over: Partial<Site> = {}): Site => ({ id: "s1", name: "Gebze", kind: "factory", share: 100, control: "operational", ...over });

describe("site registry", () => {
  it("adds and removes sites, refusing empty names and bad shares", () => {
    const added = addSite(emptySites(), { name: " Gebze ", kind: "factory", share: 60, control: "equity" });
    expect("next" in added && added.next[0].name).toBe("Gebze");
    expect(addSite([], { name: " ", kind: "factory", share: 50, control: "operational" })).toEqual({ error: "needName" });
    expect(addSite([], { name: "X", kind: "factory", share: 0, control: "operational" })).toEqual({ error: "badShare" });
    expect(addSite([], { name: "X", kind: "factory", share: 101, control: "operational" })).toEqual({ error: "badShare" });
    if ("next" in added) expect(added.next).toHaveLength(1);
  });

  it("repairs hand-edited lists", () => {
    expect(asSites(null)).toEqual([]);
    expect(asSites([{ id: "a", name: "  İzmir  ", kind: "nope", share: 1000, control: "nope" }])).toEqual([
      { id: "a", name: "İzmir", kind: "factory", share: 100, control: "operational" },
    ]);
    expect(asSites([{ id: "a", name: " " }])).toEqual([]);
  });
});

describe("consolidation", () => {
  it("control takes all, equity takes the share", () => {
    expect(siteWeight(s({ control: "operational" }))).toBe(1);
    expect(siteWeight(s({ control: "financial" }))).toBe(1);
    expect(siteWeight(s({ control: "equity", share: 60 }))).toBe(0.6);
  });

  it("attributes scope 1+2 across sites without exceeding the total on equity", () => {
    const sites = [s({ id: "a", name: "A", control: "operational" }), s({ id: "b", name: "B", control: "equity", share: 50 })];
    const r = consolidate(sites, 100, 50);
    expect(r.companyTotal).toBe(150);
    expect(r.rows[0].attributed).toBe(150);
    expect(r.rows[1].attributed).toBe(75);
  });

  it("canonicalises names the way imports lowercase them", () => {
    expect(canonicalSiteNames([s({ name: "GEBZE Fabrika" })])).toEqual(["gebze fabrika"]);
  });
});
