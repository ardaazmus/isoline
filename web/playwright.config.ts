/**
 * Browser suite (G8-07): axe-core WCAG 2.2 AA scans of the main screens and the keyboard-only journey
 * (sign-in → task submission → reviewer acceptance). Run with `npm run test:e2e`: it rebuilds the e2e database,
 * starts the production server on port 3211 and runs the specs in e2e/. Needs a `npm run build` of the current code.
 *
 * Browser: the Playwright Chromium (`npx playwright install chromium`, CI) or an installed channel via PW_CHANNEL
 * (e.g. PW_CHANNEL=chrome or msedge on a workstation without the download).
 */
import { defineConfig, devices } from "@playwright/test";
import { E2E_ORIGIN } from "./scripts/e2e/env";

const CI = !!process.env.CI;

export default defineConfig({
  testDir: "e2e",
  outputDir: "test-results",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  workers: CI ? 2 : 4,
  reporter: CI ? [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]] : [["list"]],
  use: {
    baseURL: E2E_ORIGIN,
    locale: "tr-TR",
    timezoneId: "Europe/Istanbul",
    trace: "retain-on-failure",
    channel: process.env.PW_CHANNEL || undefined,
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    { name: "chromium", use: { ...devices["Desktop Chrome"], channel: process.env.PW_CHANNEL || undefined }, dependencies: ["setup"] },
  ],
  webServer: {
    command: "npx tsx scripts/e2e/server.ts",
    url: `${E2E_ORIGIN}/api/v1/health`,
    reuseExistingServer: !CI,
    timeout: 120_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
