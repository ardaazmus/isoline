import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // self-contained server bundle for the container image (web/Dockerfile)
  output: "standalone",
  async redirects() {
    // The platform is the only app (ADR-008 update, UX Faz 3): the v1 toolkit's addresses lead to their platform
    // counterparts — calculators to Library → quick calculation, workflow screens to the cycle steps.
    const L = "/:lang(tr|en)";
    const to = (source: string, destination: string) => ({ source, destination, permanent: false });
    return [
      to("/", "/tr/app"),
      to(L, "/:lang/app"),
      to(`${L}/tools/:tool(ghg|environment|workforce|taxonomy|materiality|cbam|ets|pathway)`, "/:lang/app/quick/:tool"),
      to(`${L}/:tool(applicability|claims)`, "/:lang/app/quick/:tool"),
      to(`${L}/:page(regulations|crosswalk|themes)`, "/:lang/app/library/:page"),
      to(`${L}/factors`, "/:lang/app/factors"),
      to(`${L}/requests`, "/:lang/app/tasks"),
      to(`${L}/sites`, "/:lang/app/organization"),
      to(`${L}/clients`, "/:lang/app/home"),
      to(`${L}/:page(journey|reconciliation|trial-balance|auditor|annual-report|templates)`, "/:lang/app/projects"),
      to(`${L}/templates/:id`, "/:lang/app/projects"),
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
