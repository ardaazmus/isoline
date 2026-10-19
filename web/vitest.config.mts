import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    include: ["src/**/*.test.ts"],
    // database integration tests need PostgreSQL: npm run test:db
    exclude: ["src/**/*.db.test.ts", "node_modules/**"],
    environment: "node",
  },
});
