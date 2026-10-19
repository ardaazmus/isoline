/** Signs each persona in once and keeps the session cookies for the specs (project "setup"). */
import { test as setup } from "@playwright/test";
import { signIn, storageFile, type Persona } from "./support";

const PERSONAS: Persona[] = ["ayse", "mehmet", "zeynep", "can", "selin", "elif"];

for (const p of PERSONAS) {
  setup(`session: ${p}`, async ({ request }) => {
    await signIn(request, p);
    await request.storageState({ path: storageFile(p) });
  });
}
