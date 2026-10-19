/**
 * Background worker: `npm run worker` (development) or the "worker" service in docker-compose (server).
 * Drains the outbox (mail, evidence scans, later reminders and report packages) and recovers stuck events.
 */
import { existsSync } from "node:fs";
import { closeDb } from "../src/server/db/client";
import { ensureBucket } from "../src/server/evidence/storage";
import { recoverStuck, runOnce } from "../src/server/jobs/worker";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

let stopping = false;
const stop = () => {
  stopping = true;
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  await ensureBucket();
  console.log("worker started");
  let lastRecover = 0;
  while (!stopping) {
    if (Date.now() - lastRecover > 60_000) {
      const n = await recoverStuck();
      if (n) console.log(`requeued ${n} stuck event(s)`);
      lastRecover = Date.now();
    }
    const { handled, failed } = await runOnce(20);
    if (handled) console.log(`${new Date().toISOString()} handled ${handled}, failed ${failed}`);
    if (!handled) await sleep(2000);
  }
  await closeDb();
  console.log("worker stopped");
}

main().catch(async (e) => {
  console.error(e);
  await closeDb();
  process.exit(1);
});
