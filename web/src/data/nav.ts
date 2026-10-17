export type Family = "report" | "carbon" | "hydro" | "forest";

export type NavItem = { id: string; href: string; family: Family };
export type NavGroup = { id: string; family: Family; items: NavItem[] };

/** Tool families take their map-layer colour; the rail shows each family's size. */
export const NAV: NavGroup[] = [
  {
    id: "compass",
    family: "report",
    items: [
      { id: "overview", href: "", family: "report" },
      { id: "journey", href: "/journey", family: "report" },
      { id: "applicability", href: "/applicability", family: "report" },
      { id: "regulations", href: "/regulations", family: "report" },
      { id: "factors", href: "/factors", family: "report" },
    ],
  },
  {
    id: "carbon",
    family: "carbon",
    items: [
      { id: "ghg", href: "/tools/ghg", family: "carbon" },
      { id: "cbam", href: "/tools/cbam", family: "carbon" },
      { id: "ets", href: "/tools/ets", family: "carbon" },
      { id: "pathway", href: "/tools/pathway", family: "carbon" },
    ],
  },
  {
    id: "environment",
    family: "hydro",
    items: [
      { id: "environment", href: "/tools/environment", family: "hydro" },
      { id: "taxonomy", href: "/tools/taxonomy", family: "hydro" },
    ],
  },
  {
    id: "people",
    family: "forest",
    items: [
      { id: "materiality", href: "/tools/materiality", family: "forest" },
      { id: "workforce", href: "/tools/workforce", family: "forest" },
    ],
  },
  {
    id: "reporting",
    family: "report",
    items: [
      { id: "annualReport", href: "/annual-report", family: "report" },
      { id: "templates", href: "/templates", family: "report" },
      { id: "claims", href: "/claims", family: "report" },
      { id: "crosswalk", href: "/crosswalk", family: "report" },
    ],
  },
];

export const FAMILY_COLOR: Record<Family, string> = {
  report: "var(--report)",
  carbon: "var(--carbon)",
  hydro: "var(--hydro)",
  forest: "var(--forest)",
};
