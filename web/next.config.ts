import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // self-contained server bundle for the container image (web/Dockerfile)
  output: "standalone",
  async redirects() {
    return [{ source: "/", destination: "/tr", permanent: false }];
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
