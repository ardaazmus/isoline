/** Tool families: compass is the blue world itself; the others take a theme ramp (see data/themes.ts). */
export type Family = "compass" | "climate" | "environment" | "people" | "reporting";

export type NavItem = { id: string; href: string; family: Family };
export type NavGroup = { id: string; family: Family; items: NavItem[] };

/** Tool families take their map-layer colour; the rail shows each family's size. */
export const NAV: NavGroup[] = [
  {
    id: "compass",
    family: "compass",
    items: [
      { id: "overview", href: "", family: "compass" },
      { id: "journey", href: "/journey", family: "compass" },
      { id: "reconciliation", href: "/reconciliation", family: "reporting" },
      { id: "applicability", href: "/applicability", family: "compass" },
      { id: "regulations", href: "/regulations", family: "compass" },
      { id: "factors", href: "/factors", family: "compass" },
      { id: "themes", href: "/themes", family: "compass" },
    ],
  },
  {
    id: "carbon",
    family: "climate",
    items: [
      { id: "ghg", href: "/tools/ghg", family: "climate" },
      { id: "cbam", href: "/tools/cbam", family: "climate" },
      { id: "ets", href: "/tools/ets", family: "climate" },
      { id: "pathway", href: "/tools/pathway", family: "climate" },
    ],
  },
  {
    id: "environment",
    family: "environment",
    items: [
      { id: "environment", href: "/tools/environment", family: "environment" },
      { id: "taxonomy", href: "/tools/taxonomy", family: "environment" },
    ],
  },
  {
    id: "people",
    family: "people",
    items: [
      { id: "materiality", href: "/tools/materiality", family: "people" },
      { id: "workforce", href: "/tools/workforce", family: "people" },
    ],
  },
  {
    id: "reporting",
    family: "reporting",
    items: [
      { id: "annualReport", href: "/annual-report", family: "reporting" },
      { id: "templates", href: "/templates", family: "reporting" },
      { id: "claims", href: "/claims", family: "reporting" },
      { id: "crosswalk", href: "/crosswalk", family: "reporting" },
    ],
  },
];

/** Strong and wash tones per family, for rail bars and icon chips. */
export const FAMILY_COLOR: Record<Family, { strong: string; wash: string }> = {
  compass: { strong: "var(--b-600)", wash: "var(--b-100)" },
  climate: { strong: "var(--th-climate-ink)", wash: "var(--th-climate-wash)" },
  environment: { strong: "var(--th-nature-ink)", wash: "var(--th-nature-wash)" },
  people: { strong: "var(--th-people-ink)", wash: "var(--th-people-wash)" },
  reporting: { strong: "var(--th-economy-ink)", wash: "var(--th-economy-wash)" },
};
