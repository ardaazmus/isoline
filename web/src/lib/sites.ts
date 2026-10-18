/**
 * Site registry and consolidation (Gemini Faz 1 hiyerarşi dilimi, browser-local).
 * A client registers its sites (factory, office, warehouse, subsidiary) with an
 * ownership share and a GHG Protocol consolidation approach. Company totals are
 * attributed per site two ways: operational/financial control takes 100 % of a
 * controlled site, the equity-share view takes the ownership percentage.
 * Meter-level allocation per site arrives with row tagging (server phase); until
 * then the table is labelled as attribution, never as measurement. Pure.
 */

export type SiteKind = "factory" | "office" | "warehouse" | "subsidiary";
export const SITE_KINDS: SiteKind[] = ["factory", "office", "warehouse", "subsidiary"];

export type ConsolidationMethod = "operational" | "financial" | "equity";
export const CONSOLIDATION_METHODS: ConsolidationMethod[] = ["operational", "financial", "equity"];

export type Site = {
  id: string;
  name: string;
  kind: SiteKind;
  /** Ownership share in percent, 0–100. */
  share: number;
  /** How the site enters the consolidated total (GHG Protocol, Ch. 3). */
  control: ConsolidationMethod;
};

export const emptySites = (): Site[] => [];

export const newSiteId = () =>
  `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null;

/** Repair a stored/hand-edited site list field by field. */
export function asSites(x: unknown): Site[] {
  if (!Array.isArray(x)) return [];
  return x.flatMap((s) => {
    if (!isRecord(s) || typeof s.id !== "string" || !String(s.name ?? "").trim()) return [];
    const share = Number(s.share);
    return [
      {
        id: s.id,
        name: String(s.name).replace(/\s+/g, " ").trim().slice(0, 120),
        kind: SITE_KINDS.includes(s.kind as SiteKind) ? (s.kind as SiteKind) : "factory",
        share: Number.isFinite(share) ? Math.min(100, Math.max(0, share)) : 100,
        control: CONSOLIDATION_METHODS.includes(s.control as ConsolidationMethod) ? (s.control as ConsolidationMethod) : "operational",
      },
    ];
  });
}

export type SiteInput = { name: string; kind: SiteKind; share: number; control: ConsolidationMethod };

/** Adds a site; empty names and out-of-range shares are refused. */
export function addSite(sites: Site[], input: SiteInput, id?: string): { next: Site[] } | { error: "needName" | "badShare" } {
  if (!input.name.trim()) return { error: "needName" };
  if (!Number.isFinite(input.share) || input.share <= 0 || input.share > 100) return { error: "badShare" };
  return { next: [...sites, { id: id ?? newSiteId(), name: input.name.replace(/\s+/g, " ").trim().slice(0, 120), kind: input.kind, share: input.share, control: input.control }] };
}

export function removeSite(sites: Site[], id: string): Site[] {
  return sites.filter((s) => s.id !== id);
}

/** Effective consolidation weight of one site: control takes all, equity takes the share. */
export function siteWeight(site: Site): number {
  return site.control === "equity" ? site.share / 100 : 1;
}

export type SiteAttribution = {
  siteId: string;
  name: string;
  kind: SiteKind;
  control: ConsolidationMethod;
  share: number;
  weight: number;
  scope1: number;
  scope2: number;
  attributed: number;
};

/**
 * Attributes company Scope 1 + 2 (location-based) across registered sites.
 * With no meter-level site tagging yet this is an ownership attribution used for
 * planning (which site moves the total), not a measurement. Returns rows plus
 * the check total: equity weights must not exceed the company total.
 */
export function consolidate(sites: Site[], scope1: number, scope2: number): { rows: SiteAttribution[]; companyTotal: number; attributedTotal: number } {
  const companyTotal = scope1 + scope2;
  const rows = sites.map((s) => {
    const w = siteWeight(s);
    return { siteId: s.id, name: s.name, kind: s.kind, control: s.control, share: s.share, weight: w, scope1: scope1 * w, scope2: scope2 * w, attributed: companyTotal * w };
  });
  return { rows, companyTotal, attributedTotal: rows.reduce((n, r) => n + r.attributed, 0) };
}

/** Canonical site names for CSV site columns (indicator/inventory imports lowercase them). */
export function canonicalSiteNames(sites: Site[]): string[] {
  return sites.map((s) => s.name.toLocaleLowerCase("tr"));
}
