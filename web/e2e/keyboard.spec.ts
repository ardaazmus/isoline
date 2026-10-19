/**
 * G8-07 keyboard journey (WCAG 2.1.1 keyboard, 2.4.3 focus order, 2.4.7 focus visible, 4.1.3 status messages):
 * the contributor signs in (a single workspace opens without a chooser), opens the task from "Today", enters the
 * value, links the source document and submits; the reviewer signs in and accepts it from "Today". Only Tab, typing and Enter are used — no mouse and no address-bar
 * navigation after the sign-in page. The Tab count of every step is recorded as a test annotation and documented in
 * docs/erp/G8/01_ERISILEBILIRLIK.md.
 */
import { expect, test, type Locator, type Page } from "@playwright/test";
import { expectVisibleFocus, fixture, tabTo, type Persona } from "./support";

test.describe.configure({ mode: "serial" });

/** Tabs to `target` (checking the focus ring) and records how many presses it took. */
function recorder(page: Page) {
  const steps: string[] = [];
  const reach = async (label: string, target: Locator) => {
    const n = await tabTo(page, target);
    await expectVisibleFocus(page);
    steps.push(`${label}: ${n}×Tab`);
  };
  const done = () => test.info().annotations.push({ type: "keyboard", description: steps.join(" → ") });
  return { reach, done };
}

async function signInByKeyboard(page: Page, p: Persona, reach: ReturnType<typeof recorder>["reach"]) {
  const f = fixture();
  await page.goto("/tr/auth/login");
  await reach("e-posta", page.getByLabel("E-posta"));
  await page.keyboard.type(f.people[p]);
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Şifre")).toBeFocused();
  await page.keyboard.type(f.password);
  await page.keyboard.press("Enter");
  // one workspace: it opens straight away (UX Faz 1), no chooser to tab through
  await page.waitForURL(/\/tr\/app\/home$/);
}

test("contributor: sign-in → task → value → evidence → submit, keyboard only", async ({ page }) => {
  const { keyboardTaskId } = fixture().ids;
  const { reach, done } = recorder(page);
  await signInByKeyboard(page, "zeynep", reach);
  // "Today" lists what waits for this person: the task is one Enter away
  await reach("görev (Bugün)", page.locator(`main a[href$="/tasks/${keyboardTaskId}"]`));
  await page.keyboard.press("Enter");
  await page.waitForURL(new RegExp(`/tasks/${keyboardTaskId}$`));

  // step 1 → 2: focus moves into the step that opened, so the next Tab continues there
  await reach("Sonraki adım", page.getByRole("button", { name: "Sonraki adım" }));
  await page.keyboard.press("Enter");
  await expect(page.getByRole("group", { name: /Değer/ })).toBeFocused();
  await reach("Değer", page.getByLabel("Değer", { exact: true }));
  await page.keyboard.type("125000");
  await reach("Taslağı kaydet", page.getByRole("button", { name: "Taslağı kaydet" }));
  await page.keyboard.press("Enter");

  // step 3: link the source document already in the project (type-ahead on the select)
  await expect(page.getByRole("group", { name: /Kanıt/ })).toBeFocused();
  const pick = page.getByLabel("Projedeki bir dosyayı bağla");
  await reach("dosya seçimi", pick);
  await page.keyboard.type("gebze");
  await expect(pick).not.toHaveValue("");
  await reach("Bağla", page.getByRole("button", { name: "Bağla", exact: true }));
  await page.keyboard.press("Enter");
  await expect(page.getByRole("listitem").filter({ hasText: "gebze-fatura-ozeti-2026.pdf" })).toBeVisible();

  // step 4: submit
  await reach("Sonraki adım", page.getByRole("button", { name: "Sonraki adım" }));
  await page.keyboard.press("Enter");
  const submitStep = page.getByRole("group", { name: /Gönder/ });
  await expect(submitStep).toBeFocused();
  await reach("Gönder", submitStep.getByRole("button", { name: "Gönder", exact: true }));
  await page.keyboard.press("Enter");
  // the form closes; focus lands on the request status, a live region that now reads "waiting for review"
  const status = page.locator("#task-status");
  await expect(status).toHaveText("Gönderim bekliyor");
  await expect(status).toBeFocused();
  await expect(status).toHaveAttribute("role", "status");
  done();
});

test("reviewer: sign-in → Today → accept, keyboard only", async ({ browser }) => {
  const { keyboardTaskId } = fixture().ids;
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const { reach, done } = recorder(page);
  await signInByKeyboard(page, "mehmet", reach);
  await reach("talep (Bugün)", page.locator(`main a[href$="/tasks/${keyboardTaskId}"]`));
  await page.keyboard.press("Enter");
  await page.waitForURL(new RegExp(`/tasks/${keyboardTaskId}$`));
  await reach("Kabul et", page.getByRole("button", { name: "Kabul et" }));
  await page.keyboard.press("Enter");
  const status = page.locator("#task-status");
  await expect(status).toHaveText("Kabul edildi");
  await expect(status).toBeFocused();
  done();
  await ctx.close();
});
