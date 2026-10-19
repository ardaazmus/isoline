/**
 * UX Faz 4 acceptance (review 19.10.2026): each role lands on its own work, the menu stays short, the cycle reads as
 * seven derived steps, and the old toolkit addresses lead into the platform. Demo data (db:seed --reset) required.
 */
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { stateOf, type Role } from "./roles";

/** Opens "Today" as a role whose session the setup step saved. */
async function signIn(page: Page, who: Role) {
  await page.context().addCookies(JSON.parse(readFileSync(stateOf(who), "utf8")).cookies);
  await page.goto("/tr/app/home");
  await expect(page).toHaveURL(/\/tr\/app\/home$/);
}

const topMenu = (page: Page) => page.locator("nav[aria-label='Platform menüsü'] > ul > li > a");
const waiting = (page: Page) => page.locator("section", { has: page.getByRole("heading", { name: "Sizden beklenen" }) });

test("company owner: Today first, six menu entries, the first piece of work one click away", async ({ page }) => {
  await signIn(page, "ayse");
  await expect(topMenu(page)).toHaveText(["Bugün", "Raporlama dönemleri", /^İşlerim/, "Kuruluş", "Kütüphane", "Ayarlar"]);
  const badge = topMenu(page).filter({ hasText: "İşlerim" }).locator("span").last();
  await expect(badge).toHaveText(/^\d+$/);
  const first = waiting(page).getByRole("link").first();
  await expect(first).toBeVisible();
  await first.click();
  await expect(page).toHaveURL(/\/tr\/app\/(projects\/[0-9a-f-]+\/[a-z]+|tasks\/[0-9a-f-]+)/);
});

test("project: seven derived steps with the current one marked; what stops the close leads to its step", async ({ page }) => {
  await signIn(page, "ayse");
  await page.getByRole("link", { name: "2026 TSRS + Faaliyet Raporu" }).first().click();
  const steps = page.locator("nav[aria-label='Döngü adımları'] ol > li > a");
  await expect(steps).toHaveCount(7);
  await expect(page.locator("nav[aria-label='Döngü adımları'] ol a[aria-label*='Şu anki adım']")).toHaveCount(1);
  const blockers = page.locator("section", { has: page.getByRole("heading", { name: "Kapanışı ne engelliyor" }) });
  const fix = blockers.getByRole("link").first();
  await expect(fix).toBeVisible();
  await fix.click();
  await expect(page).toHaveURL(/\/projects\/[0-9a-f-]+\/(scope|data|calculations|consolidation|controls|close)/);
});

test("contributor: only their own work — no cycles table, four menu entries", async ({ page }) => {
  await signIn(page, "zeynep");
  await expect(topMenu(page)).toHaveText(["Bugün", /^İşlerim/, "Kütüphane", "Ayarlar"]);
  await expect(page.getByRole("heading", { name: "Raporlama dönemleri" })).toHaveCount(0);
  await expect(waiting(page)).toBeVisible();
});

test("consultant: clients with the step each cycle is at, no scores", async ({ page }) => {
  await signIn(page, "can");
  const clients = page.locator("section", { has: page.getByRole("heading", { name: "Müşteriler", exact: true }) });
  await expect(clients.getByRole("row")).toHaveCount(3); // header + two client projects
  await expect(clients).toContainText("Hesaplama ve onay");
  await expect(clients.getByRole("columnheader")).toHaveText(["Kurum", "Proje", "Bulunulan adım", "Durum", "Adımın son tarihi"]);
});

test("project lead: a submitted worksheet waits in My work and opens on its approval screen", async ({ page }) => {
  await signIn(page, "selin");
  await topMenu(page).filter({ hasText: "İşlerim" }).click();
  const sheets = page.locator("section", { has: page.getByRole("heading", { name: /Onayınızı bekleyen çalışma sayfaları/ }) });
  await sheets.getByRole("link", { name: "Taksonomi göstergeleri" }).click();
  await expect(page).toHaveURL(/\/taxonomy\?cycle=/);
  await expect(page.getByRole("button", { name: "Onayla" })).toBeVisible();
});

test("management signer: a short menu and the cycles to follow", async ({ page }) => {
  await signIn(page, "elif");
  expect(await topMenu(page).count()).toBeLessThanOrEqual(6);
  await expect(page.getByRole("heading", { name: "Raporlama dönemleri" })).toBeVisible();
});

test("old toolkit addresses lead into the platform", async ({ page }) => {
  await signIn(page, "ayse");
  await page.goto("/tr/tools/ghg");
  await expect(page).toHaveURL(/\/tr\/app\/quick\/ghg$/);
  await expect(page.getByText(/Hızlı hesap: bu tarayıcıda/)).toBeVisible();
  await page.goto("/tr/journey");
  await expect(page).toHaveURL(/\/tr\/app\/projects$/);
  await page.goto("/tr");
  await expect(page).toHaveURL(/\/tr\/app\/home$/);
});
