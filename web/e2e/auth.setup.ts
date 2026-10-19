/**
 * Signs each demo role in once and keeps the session for the journeys (the sign-in endpoint is rate limited, as it
 * should be). Also the first acceptance check: a person with one workspace lands on "Today" with no chooser.
 */
import { mkdirSync, readFileSync } from "node:fs";
import { expect, test as setup, type Page } from "@playwright/test";
import { ROLES, stateOf } from "./roles";

const demo = JSON.parse(readFileSync(".demo-users.local.json", "utf8")) as { password: string };

async function signIn(page: Page, email: string) {
  for (let attempt = 0; attempt < 4; attempt++) {
    await page.goto("/");
    await expect(page).toHaveURL(/\/tr\/auth\/login/);
    await page.getByLabel("E-posta").fill(email);
    await page.getByLabel("Şifre").fill(demo.password);
    await page.getByRole("button", { name: "Giriş yap" }).click();
    const outcome = await Promise.race([
      page.waitForURL(/\/tr\/app\/home$/, { timeout: 30_000 }).then(() => "home" as const),
      page.getByText("Çok fazla deneme yapıldı").waitFor({ timeout: 30_000 }).then(() => "limited" as const),
    ]);
    if (outcome === "home") return;
    await page.waitForTimeout(12_000); // the limiter's window
  }
  throw new Error(`could not sign in ${email}`);
}

setup.describe.configure({ mode: "serial" });

for (const who of ROLES)
  setup(`${who} signs in and lands on Today`, async ({ page }) => {
    mkdirSync("e2e/.auth", { recursive: true });
    await signIn(page, `${who}@ornek.test`);
    await expect(page.getByRole("heading", { name: "Bugün", level: 1 })).toBeVisible();
    await page.context().storageState({ path: stateOf(who) });
  });
