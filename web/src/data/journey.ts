/**
 * Report production journeys. Each stage links to the tools that feed it and names its outputs;
 * text lives in messages under journey.<track>.<stage>. Progress is derived from the client's data
 * where the product can measure it; otherwise the user sets the stage status by hand.
 */
import type { ClientData } from "./sample";
import { computeInventory } from "@/lib/calc/ghg";
import { AR_ITEMS } from "./annual-report";

export type StageStatus = "todo" | "doing" | "done";
export type Track = "sustainability" | "annual" | "cbam";

export type Stage = {
  id: string;
  tools: string[];
  /** Typical timing relative to the reporting year end (months; negative = before). */
  when: number;
  derive?: (c: ClientData) => number | null;
  /** Key date when a fixed legal deadline applies. */
  deadline?: (c: ClientData) => string | undefined;
};

const share = (n: number, d: number) => (d > 0 ? Math.min(1, n / d) : 0);

export const JOURNEYS: Record<Track, Stage[]> = {
  sustainability: [
    { id: "scope", tools: ["applicability", "regulations"], when: -6, derive: (c) => (c.profile.history[1].totalAssetsTry > 0 ? 1 : 0) },
    { id: "materiality", tools: ["materiality"], when: -5, derive: (c) => share(c.materiality.topics.filter((t) => t.scale > 1 || t.magnitude > 1).length, c.materiality.topics.length) },
    {
      id: "data",
      tools: ["ghg", "environment", "workforce"],
      when: 1,
      derive: (c) => share([c.ghg.fuels.length + c.ghg.electricity.length > 0, c.indicators.env.energyGj > 0, c.indicators.safety.hoursWorked > 0].filter(Boolean).length, 3),
    },
    { id: "calculate", tools: ["ghg", "taxonomy"], when: 2, derive: (c) => (computeInventory(c.ghg).totalLocation > 0 ? (c.ghg.scope3.length > 0 ? 1 : 0.6) : 0) },
    { id: "targets", tools: ["pathway", "cbam", "ets"], when: 3, derive: (c) => (c.pathway.baseScope12 > 0 ? share(c.pathway.measures.length, 3) : 0) },
    { id: "write", tools: ["templates", "crosswalk"], when: 4 },
    { id: "assurance", tools: ["templates"], when: 5 },
    { id: "publish", tools: ["regulations"], when: 6 },
  ],
  annual: [
    { id: "plan", tools: ["applicability", "regulations"], when: -2 },
    { id: "financials", tools: [], when: 1 },
    {
      id: "content",
      tools: ["annualReport"],
      when: 1.5,
      derive: (c) => {
        const items = AR_ITEMS.filter((i) => i.profiles.includes(c.annualReport.profile) && c.annualReport.status[i.id] !== "na");
        return share(items.filter((i) => ["draft", "review", "approved"].includes(c.annualReport.status[i.id] ?? "")).length, items.length);
      },
    },
    { id: "governance", tools: ["annualReport", "templates"], when: 2 },
    { id: "sustainability_summary", tools: ["ghg", "workforce", "environment"], when: 2, derive: (c) => (computeInventory(c.ghg).totalLocation > 0 ? 1 : 0) },
    {
      id: "board",
      tools: ["annualReport"],
      when: 2.5,
      derive: (c) => {
        const items = AR_ITEMS.filter((i) => i.profiles.includes(c.annualReport.profile) && c.annualReport.status[i.id] !== "na");
        return share(items.filter((i) => c.annualReport.status[i.id] === "approved").length, items.length);
      },
    },
    { id: "kap", tools: ["regulations"], when: 3 },
  ],
  cbam: [
    { id: "goods", tools: ["applicability", "cbam"], when: -9, derive: (c) => (c.cbam.products.length > 0 ? (c.cbam.products.every((p) => p.cn) ? 1 : 0.5) : 0) },
    { id: "monitoring", tools: ["ghg", "ets"], when: -3, derive: (c) => (c.ghg.fuels.length > 0 ? 1 : 0), deadline: () => "2026-10-27" },
    { id: "embedded", tools: ["cbam"], when: 1, derive: (c) => share(c.cbam.products.filter((p) => !p.useDefault && p.seeDirect > 0).length, c.cbam.products.length) },
    { id: "verify", tools: ["templates"], when: 4 },
    { id: "pack", tools: ["templates"], when: 5 },
    { id: "cost", tools: ["cbam", "pathway"], when: 6, derive: (c) => (c.cbam.products.length && c.cbam.scenario.startPrice > 0 ? 1 : 0) },
    { id: "declare", tools: ["regulations"], when: 9, deadline: () => "2027-09-30" },
  ],
};

export function stageStatus(c: ClientData, track: Track, s: Stage): { status: StageStatus; progress: number | null; manual: boolean } {
  const manual = c.journey?.[`${track}.${s.id}`];
  const progress = s.derive ? s.derive(c) : null;
  if (manual) return { status: manual, progress: manual === "done" ? 1 : progress, manual: true };
  if (progress === null) return { status: "todo", progress: null, manual: false };
  return { status: progress >= 1 ? "done" : progress > 0 ? "doing" : "todo", progress, manual: false };
}
