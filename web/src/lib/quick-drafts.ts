/**
 * "Döngüye kaydet" (UX Faz 3): what a quick calculation hands to the cycle. Only inputs travel — consumption,
 * leaks, volumes — never a calculated result: the platform recalculates from accepted data with its own factor
 * registry, and the person still attaches evidence and submits for review. One draft per data point the
 * platform collects (server/data/catalog.ts); line keys and units follow that catalogue.
 */
import { FUELS, type Inventory } from "./calc/ghg";
import type { EnvInput } from "./calc/indicators";

export type QuickDraft = { metric: string; value?: number; unit?: string; lines?: { key: string; value: number; unit: string }[] };

/** Fuel units as the catalogue accepts them (standard cubic metres are stored as m³). */
const fuelUnit = (fuel: keyof typeof FUELS) => (FUELS[fuel].unit === "Sm3" ? "m3" : FUELS[fuel].unit);
const MOBILE_KEYS = ["diesel", "gasoline", "lpg"];

function fuelLines(fuels: Inventory["fuels"], mobile: boolean) {
  const sum = new Map<string, number>();
  for (const f of fuels) {
    if (f.mobile !== mobile || !(f.amount > 0)) continue;
    if (mobile && !MOBILE_KEYS.includes(f.fuel)) continue;
    sum.set(f.fuel, (sum.get(f.fuel) ?? 0) + f.amount);
  }
  return [...sum].map(([key, value]) => ({ key, value, unit: fuelUnit(key as keyof typeof FUELS) }));
}

/** Drafts from the GHG calculator: stationary and mobile fuels, purchased electricity, refrigerant leaks. */
export function ghgDrafts(inv: Inventory): QuickDraft[] {
  const out: QuickDraft[] = [];
  const stationary = fuelLines(inv.fuels, false);
  if (stationary.length) out.push({ metric: "ghg_stationary", lines: stationary });
  const mobile = fuelLines(inv.fuels, true);
  if (mobile.length) out.push({ metric: "ghg_mobile", lines: mobile });
  const mwh = inv.electricity.reduce((s, e) => s + Math.max(0, e.mwh), 0);
  if (mwh > 0) out.push({ metric: "ghg_electricity", value: mwh, unit: "MWh" });
  const gases = new Map<string, number>();
  for (const r of inv.refrigerants) if (r.leakedKg > 0) gases.set(r.gas, (gases.get(r.gas) ?? 0) + r.leakedKg);
  if (gases.size) out.push({ metric: "ghg_refrigerants", lines: [...gases].map(([key, value]) => ({ key, value, unit: "kg" })) });
  return out;
}

/** Drafts from the energy, water and waste calculator. */
export function environmentDrafts(e: EnvInput): QuickDraft[] {
  const pairs: [string, number, string][] = [
    ["env_energy", e.energyGj, "GJ"],
    ["env_renewable", e.renewableGj, "GJ"],
    ["env_water_withdrawal", e.waterWithdrawalM3, "m3"],
    ["env_water_discharge", e.waterDischargeM3, "m3"],
    ["env_waste", e.wasteTotalT, "t"],
  ];
  return pairs.filter(([, v]) => v > 0).map(([metric, value, unit]) => ({ metric, value, unit }));
}

export const QUICK_SAVE_TOOLS = ["ghg", "environment"] as const;
export type QuickSaveTool = (typeof QUICK_SAVE_TOOLS)[number];
