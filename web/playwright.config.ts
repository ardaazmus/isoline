import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end journeys per role (UX Faz 4) against the demo data: `npm run db:seed -- --reset`, then
 * `npm run test:e2e`. The dev server on :3210 is reused when it runs, else started. The tests only read, so the
 * demo stays as seeded.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3210", locale: "tr-TR", trace: "retain-on-failure" },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/, use: { ...devices["Desktop Chrome"] } },
    { name: "chromium", testMatch: /.*\.spec\.ts/, dependencies: ["setup"], use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: process.env.E2E_BASE_URL ? undefined : { command: "npm run dev -- --port 3210", url: "http://localhost:3210/tr/auth/login", reuseExistingServer: true, timeout: 180_000 },
});
