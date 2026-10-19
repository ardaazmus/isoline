/** Library pages and quick calculators (plain data, so server pages and the client view share it). */
export const QUICK_TOOLS = ["ghg", "environment", "workforce", "taxonomy", "materiality", "cbam", "ets", "pathway", "applicability", "claims"] as const;
export type QuickTool = (typeof QUICK_TOOLS)[number];
export const LIBRARY_PAGES = ["regulations", "crosswalk", "themes"] as const;
export type LibraryPage = (typeof LIBRARY_PAGES)[number];
