/**
 * Malware scanning before a file becomes available (ADR-005, plan 12 §5). Production uses clamd's INSTREAM
 * protocol (ClamAV, compose profile "scan"); development may use the "dev" scanner, which only recognises the
 * EICAR test file so the quarantine path can be exercised without a 300 MB signature database.
 */
import { connect } from "node:net";

export type ScanResult = { clean: boolean; engine: string; signature?: string };

// assembled at runtime so this source file itself is not flagged by desktop antivirus
const EICAR = ["X5O!P%@AP[4\\PZX54(P^)7CC)7}$", "EICAR-STANDARD-ANTIVIRUS-", "TEST-FILE!$H+H*"].join("");

export function eicarBytes(): Uint8Array {
  return new TextEncoder().encode(EICAR);
}

function devScan(bytes: Uint8Array): ScanResult {
  const text = Buffer.from(bytes.subarray(0, 4096)).toString("latin1");
  return text.includes(EICAR) ? { clean: false, engine: "dev", signature: "Eicar-Test-Signature" } : { clean: true, engine: "dev" };
}

/** clamd INSTREAM: "zINSTREAM\0", then <uint32 BE length><chunk>… and a zero length; reply "stream: OK" or "… FOUND". */
export function clamdScan(bytes: Uint8Array, host: string, port: number, timeoutMs = 30_000): Promise<ScanResult> {
  return new Promise((resolve, reject) => {
    const socket = connect({ host, port });
    const chunks: Buffer[] = [];
    const timer = setTimeout(() => socket.destroy(new Error("clamd timeout")), timeoutMs);
    socket.on("connect", () => {
      socket.write("zINSTREAM\0");
      const size = 64 * 1024;
      for (let i = 0; i < bytes.length; i += size) {
        const part = bytes.subarray(i, i + size);
        const len = Buffer.alloc(4);
        len.writeUInt32BE(part.length);
        socket.write(len);
        socket.write(part);
      }
      socket.write(Buffer.alloc(4));
    });
    socket.on("data", (d) => chunks.push(d));
    socket.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    socket.on("close", () => {
      clearTimeout(timer);
      const reply = Buffer.concat(chunks).toString("utf8").replace(/\0/g, "").trim();
      if (/:\s*OK$/.test(reply)) resolve({ clean: true, engine: "clamav" });
      else if (/FOUND$/.test(reply)) resolve({ clean: false, engine: "clamav", signature: reply.replace(/^stream:\s*/, "").replace(/\s*FOUND$/, "") });
      else reject(new Error(`clamd: unexpected reply "${reply.slice(0, 120)}"`));
    });
  });
}

export async function scan(bytes: Uint8Array): Promise<ScanResult> {
  const mode = process.env.SCANNER ?? "clamav";
  if (mode === "dev") {
    if (process.env.NODE_ENV === "production") throw new Error("SCANNER=dev is not allowed in production");
    return devScan(bytes);
  }
  return clamdScan(bytes, process.env.CLAMAV_HOST ?? "127.0.0.1", Number(process.env.CLAMAV_PORT ?? 3310));
}
