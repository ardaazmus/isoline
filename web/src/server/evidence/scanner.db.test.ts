/**
 * The production scanner path (clamd INSTREAM) against the ClamAV container (`docker compose --profile scan up -d`).
 * When the container is not running the test says so and is skipped; the dev scanner is covered in api.db.test.
 */
import { connect } from "node:net";
import { describe, expect, it } from "vitest";
import { clamdScan, eicarBytes } from "./scanner";

const host = process.env.CLAMAV_HOST ?? "127.0.0.1";
const port = Number(process.env.CLAMAV_PORT ?? 3310);

async function clamdReady(): Promise<boolean> {
  return new Promise((resolve) => {
    const s = connect({ host, port });
    s.setTimeout(1500);
    s.on("connect", () => s.write("zPING\0"));
    s.on("data", (d) => {
      resolve(d.toString().includes("PONG"));
      s.destroy();
    });
    s.on("error", () => resolve(false));
    s.on("timeout", () => {
      resolve(false);
      s.destroy();
    });
  });
}

const ready = await clamdReady();
if (!ready) console.warn(`[scanner] clamd not reachable on ${host}:${port}; production scanner test skipped`);

describe.skipIf(!ready)("ClamAV clamd scanner", () => {
  it("passes a clean file and finds the EICAR test signature", async () => {
    expect(await clamdScan(new TextEncoder().encode("%PDF-1.4 temiz fatura"), host, port)).toMatchObject({ clean: true, engine: "clamav" });
    const bad = await clamdScan(eicarBytes(), host, port);
    expect(bad.clean).toBe(false);
    expect(bad.signature).toMatch(/eicar/i);
  });

  it("streams files larger than one chunk", async () => {
    const big = new Uint8Array(300 * 1024).fill(65);
    expect((await clamdScan(big, host, port)).clean).toBe(true);
  });
});
