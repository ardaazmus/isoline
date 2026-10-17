import { Coins, CloudFog, Droplets, Landmark, Recycle, Thermometer, Trees, Truck, Users, Zap, type LucideIcon } from "lucide-react";

/**
 * Thematic data palette. Ten themes cover sustainability, annual-report and carbon-pricing data;
 * each owns a hue, a line icon and a five-tone ramp. The hex values were chosen by optimisation so
 * every pair stays apart (CIEDE2000) under normal vision and simulated protanopia, deuteranopia and
 * tritanopia, and away from the cobalt interface colours. `color.test.ts` guards those limits and
 * checks that globals.css carries the same values.
 *
 * Tones: strong (primary series, icon), mid (secondary series), light (remainder, bands),
 * wash (row and header tints), ink (text and icons on the wash; ≥ 4.5:1).
 */
export type ThemeId = "climate" | "energy" | "water" | "nature" | "circularity" | "pollution" | "people" | "governance" | "economy" | "valuechain";
export type Pillar = "E" | "S" | "G" | "X";
export type Tone = "strong" | "mid" | "light" | "wash" | "ink";

export type Theme = { id: ThemeId; pillar: Pillar; icon: LucideIcon; ramp: Record<Tone, string>; motion: "rise" | "flicker" | "drip" | "sway" | "spin" | "drift" | "nudge" };

export const THEMES: Theme[] = [
  { id: "climate", pillar: "E", icon: Thermometer, motion: "rise", ramp: { strong: "#9b3a0c", mid: "#c26542", light: "#f9cab9", wash: "#fef1ed", ink: "#9b3a0c" } },
  { id: "energy", pillar: "E", icon: Zap, motion: "flicker", ramp: { strong: "#bb8b3f", mid: "#dfb16c", light: "#e8d2b5", wash: "#fbf3e9", ink: "#8b5e00" } },
  { id: "water", pillar: "E", icon: Droplets, motion: "drip", ramp: { strong: "#2e9cbf", mid: "#68c4e6", light: "#b7ddec", wash: "#eaf7fc", ink: "#00718e" } },
  { id: "nature", pillar: "E", icon: Trees, motion: "sway", ramp: { strong: "#1f5a3a", mid: "#4b7f5f", light: "#c5ddcd", wash: "#eef7f1", ink: "#1f5a3a" } },
  { id: "circularity", pillar: "E", icon: Recycle, motion: "spin", ramp: { strong: "#637942", mid: "#8aa06c", light: "#d0dbc2", wash: "#f2f6ee", ink: "#556a34" } },
  { id: "pollution", pillar: "E", icon: CloudFog, motion: "drift", ramp: { strong: "#988778", mid: "#c0afa1", light: "#e5d2c2", wash: "#fbf3ec", ink: "#776658" } },
  { id: "people", pillar: "S", icon: Users, motion: "nudge", ramp: { strong: "#c06092", mid: "#e88bb9", light: "#f4c7dc", wash: "#fef0f6", ink: "#a5487a" } },
  { id: "valuechain", pillar: "S", icon: Truck, motion: "drift", ramp: { strong: "#36786e", mid: "#639e94", light: "#c1ddd7", wash: "#ecf7f5", ink: "#36786e" } },
  { id: "governance", pillar: "G", icon: Landmark, motion: "nudge", ramp: { strong: "#704488", mid: "#956cad", light: "#e1cded", wash: "#f8f1fd", ink: "#704488" } },
  { id: "economy", pillar: "X", icon: Coins, motion: "rise", ramp: { strong: "#293a45", mid: "#4c5d68", light: "#c4d9e8", wash: "#edf6fc", ink: "#293a45" } },
];

export const THEME: Record<ThemeId, Theme> = Object.fromEntries(THEMES.map((t) => [t.id, t])) as Record<ThemeId, Theme>;

/** The colour that stands for each pillar in pillar-level charts (E/S/G rings, materiality). */
export const PILLAR_THEME: Record<Pillar, ThemeId> = { E: "nature", S: "people", G: "governance", X: "economy" };

const SUFFIX: Record<Tone, string> = { strong: "", mid: "-2", light: "-3", wash: "-wash", ink: "-ink" };

/** CSS custom property for a theme tone, e.g. `th("water", "mid")` → `var(--th-water-2)`. */
export function th(id: ThemeId, tone: Tone = "strong") {
  return `var(--th-${id}${SUFFIX[tone]})`;
}

/**
 * Order for categories that are not themes (abatement measures, sites, products): alternates dark
 * and light so neighbours stay apart. Use at most six in one chart and group the rest.
 */
export const CATEGORICAL: string[] = (["water", "climate", "valuechain", "people", "energy", "governance", "nature", "circularity", "economy"] as ThemeId[]).map((id) => `var(--th-${id})`);

/** Interface colours that data must never be mistaken for. */
export const UI_COLORS = { cobalt: "#2f4fe0", accentInk: "#2443c9", navy: "#0e1a46", periwinkle: "#7f9cff", inkMuted: "#5c6894" };

/** ESRS topical standards mapped to themes (materiality topics use these ids). */
export const ESRS_THEME: Record<string, ThemeId> = {
  E1: "climate",
  E2: "pollution",
  E3: "water",
  E4: "nature",
  E5: "circularity",
  S1: "people",
  S2: "valuechain",
  S3: "people",
  S4: "people",
  G1: "governance",
};
