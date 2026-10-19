import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // self-contained server bundle for the container image (web/Dockerfile)
  output: "standalone",
  async redirects() {
    // the platform is the front door; the v1 toolkit keeps its routes under /tr (ADR-008)
    return [{ source: "/", destination: "/tr/app", permanent: false }];
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
