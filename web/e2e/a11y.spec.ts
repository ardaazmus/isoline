/**
 * G8-07: axe-core WCAG 2.2 AA scans of the main screens, each as the person who works there. A scan fails on any
 * violation; the axe result of every screen is attached to the Playwright report.
 */
import { expect, test } from "@playwright/test";
import { expectAccessible, fixture, storageFile, type Persona } from "./support";

type Screen = { name: string; persona: Persona; path: (ids: ReturnType<typeof fixture>["ids"]) => string };

const SCREENS: Screen[] = [
  { name: "workspace choice", persona: "can", path: () => "/tr/app/choose" },
  { name: "home", persona: "ayse", path: () => "/tr/app/home" },
  { name: "portfolio", persona: "can", path: () => "/tr/app/portfolio" },
  { name: "project overview (isometric site map)", persona: "ayse", path: (i) => `/tr/app/projects/${i.companyProject}` },
  { name: "data campaign", persona: "ayse", path: (i) => `/tr/app/projects/${i.companyProject}/data/${i.campaignId}` },
  { name: "task inbox", persona: "zeynep", path: () => "/tr/app/tasks" },
  { name: "calculations (Sankey)", persona: "selin", path: (i) => `/tr/app/projects/${i.companyProject}/calculations` },
  { name: "calculation run", persona: "selin", path: (i) => `/tr/app/projects/${i.companyProject}/calculations/${i.runId}` },
  { name: "lineage", persona: "selin", path: (i) => `/tr/app/facts/${i.factId}` },
  { name: "report studio", persona: "selin", path: (i) => `/tr/app/projects/${i.companyProject}/reports/${i.reportId}` },
  { name: "period close", persona: "ayse", path: (i) => `/tr/app/projects/${i.companyProject}/close` },
  { name: "review queue", persona: "mehmet", path: () => "/tr/app/review" },
];

test.describe("sign-in", () => {
  test("login page, empty and with an error", async ({ page }, info) => {
    await page.goto("/tr/auth/login");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectAccessible(page, info, "login");
    await page.getByLabel("E-posta").fill("yok@ornek.test");
    await page.getByLabel("Şifre").fill("yanlis-sifre-123");
    await page.getByRole("button", { name: "Giriş yap" }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await expectAccessible(page, info, "login-error");
  });
});

for (const s of SCREENS) {
  test.describe(s.name, () => {
    test.use({ storageState: storageFile(s.persona) });
    test(`axe: ${s.name}`, async ({ page }, info) => {
      const res = await page.goto(s.path(fixture().ids));
      expect(res?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await page.waitForLoadState("networkidle");
      await expectAccessible(page, info, s.name);
    });
  });
}

test.describe("task form", () => {
  test.use({ storageState: storageFile("zeynep") });
  test("axe: every step of the contributor's form", async ({ page }, info) => {
    await page.goto(`/tr/app/tasks/${fixture().ids.scanTaskId}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectAccessible(page, info, "task-what");
    for (const step of ["Değer", "Kanıt", "Gönder"]) {
      await page.getByRole("list", { name: /adım/i }).getByRole("button", { name: new RegExp(step) }).click();
      await page.waitForLoadState("networkidle");
      await expectAccessible(page, info, `task-${step}`);
    }
  });
});
