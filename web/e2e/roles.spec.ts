/**
 * UX Faz 4 acceptance (review 19.10.2026): each role lands on its own work, the menu stays short, the cycle reads as
 * seven derived steps, and the old toolkit addresses lead into the platform. Runs on the e2e fixture
 * (scripts/e2e/prepare.ts: the demo seed plus scale clients); the journeys only read.
 */
import { expect, test, type Page } from "@playwright/test";
import { fixture, storageFile } from "./support";

const topMenu = (page: Page) => page.locator("nav[aria-label='Platform menüsü'] > ul > li > a");
const waiting = (page: Page) => page.locator("section", { has: page.getByRole("heading", { name: "Sizden beklenen", exact: true }) });

async function today(page: Page) {
  await page.goto("/tr/app/home");
  await expect(page.getByRole("heading", { name: "Bugün", level: 1 })).toBeVisible();
}

test.describe("company owner", () => {
  test.use({ storageState: storageFile("ayse") });

  test("Today first, six menu entries, the first piece of work one click away", async ({ page }) => {
    await today(page);
    await expect(topMenu(page)).toHaveText(["Bugün", "Raporlama dönemleri", /^İşlerim/, "Kuruluş", "Kütüphane", "Ayarlar"]);
    await expect(topMenu(page).filter({ hasText: "İşlerim" }).locator("span").last()).toHaveText(/^\d+$/);
    const first = waiting(page).getByRole("link").first();
    await expect(first).toBeVisible();
    await first.click();
    await expect(page).toHaveURL(/\/tr\/app\/(projects\/[0-9a-f-]+\/[a-z]+|tasks\/[0-9a-f-]+)/);
  });

  test("project: seven derived steps, one current; what stops the close leads to its step", async ({ page }) => {
    await page.goto(`/tr/app/projects/${fixture().ids.companyProject}`);
    await expect(page.locator("nav[aria-label='Döngü adımları'] ol > li > a")).toHaveCount(7);
    await expect(page.getByRole("navigation", { name: "Döngü adımları" }).getByRole("link", { name: /Şu anki adım/ })).toHaveCount(1);
    const blockers = page.locator("section", { has: page.getByRole("heading", { name: "Kapanışı ne engelliyor" }) });
    const fix = blockers.getByRole("link").first();
    await expect(fix).toBeVisible();
    await fix.click();
    await expect(page).toHaveURL(/\/projects\/[0-9a-f-]+\/(scope|data|calculations|consolidation|controls|close)/);
  });

  test("old toolkit addresses lead into the platform", async ({ page }) => {
    await page.goto("/tr/tools/ghg");
    await expect(page).toHaveURL(/\/tr\/app\/quick\/ghg$/);
    await expect(page.getByText(/Hızlı hesap: bu tarayıcıda/)).toBeVisible();
    await page.goto("/tr/journey");
    await expect(page).toHaveURL(/\/tr\/app\/projects$/);
    await page.goto("/tr");
    await expect(page).toHaveURL(/\/tr\/app\/home$/);
  });
});

test.describe("contributor", () => {
  test.use({ storageState: storageFile("zeynep") });
  test("only their own work: no cycles table, four menu entries", async ({ page }) => {
    await today(page);
    await expect(topMenu(page)).toHaveText(["Bugün", /^İşlerim/, "Kütüphane", "Ayarlar"]);
    await expect(page.getByRole("heading", { name: "Raporlama dönemleri" })).toHaveCount(0);
    await expect(waiting(page).getByRole("link").first()).toBeVisible(); // the fixture's open tasks
  });
});

test.describe("consultant", () => {
  test.use({ storageState: storageFile("can") });
  test("clients with the step each cycle is at, and no score column", async ({ page }) => {
    await today(page);
    const clients = page.locator("section", { has: page.getByRole("heading", { name: "Müşteriler", exact: true }) });
    await expect(clients.getByRole("columnheader")).toHaveText(["Kurum", "Proje", "Bulunulan adım", "Durum", "Adımın son tarihi"]);
    expect(await clients.getByRole("row").count()).toBeGreaterThanOrEqual(3);
    // the step comes from the record (the fixture keeps some requests open), so any of the seven may show
    await expect(clients.getByRole("row", { name: /Anadolu Gıda Holding/ })).toContainText(/Kapsam|Veri toplama|Hesaplama ve onay|Kontrol ve konsolidasyon|Dönem kapanışı|Rapor|Güvence/);
  });
});

test.describe("project lead", () => {
  test.use({ storageState: storageFile("selin") });
  test("a submitted worksheet waits in My work and opens on its approval screen", async ({ page }) => {
    await page.goto("/tr/app/tasks");
    const sheets = page.locator("section", { has: page.getByRole("heading", { name: /Onayınızı bekleyen çalışma sayfaları/ }) });
    await sheets.getByRole("link", { name: "Taksonomi göstergeleri" }).click();
    await expect(page).toHaveURL(/\/taxonomy\?cycle=/);
    await expect(page.getByRole("button", { name: "Onayla" })).toBeVisible();
  });
});

test.describe("management signer", () => {
  test.use({ storageState: storageFile("elif") });
  test("a short menu and the cycles to follow", async ({ page }) => {
    await today(page);
    expect(await topMenu(page).count()).toBeLessThanOrEqual(6);
    await expect(page.getByRole("heading", { name: "Raporlama dönemleri" })).toBeVisible();
  });
});
