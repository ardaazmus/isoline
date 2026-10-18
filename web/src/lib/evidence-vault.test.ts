import { describe, expect, it } from "vitest";
import { SAMPLE_CLIENT } from "@/data/sample";
import { buildVaultManifest, localVault } from "./evidence-vault";

describe("evidence vault", () => {
  it("dedupes the import log by SHA-256", () => {
    const m = buildVaultManifest(SAMPLE_CLIENT, [], "local");
    const hashes = m.records.map((r) => r.sha256);
    expect(new Set(hashes).size).toBe(hashes.length);
    expect(m.backend).toBe("local");
  });

  it("flags accepted items without evidence and notes hand-entered ones", () => {
    const c = structuredClone(SAMPLE_CLIENT);
    c.requests.items = {
      with_file: { owner: "A", due: "", status: "accepted", note: "", evidence: { fileName: "f.xlsx", sha256: "x".repeat(64), importedAt: "2026-10-01T00:00:00.000Z" } },
      with_note: { owner: "A", due: "", status: "accepted", note: "", source: { doc: "Fatura 12", date: "2026-09-01" } },
      bare: { owner: "A", due: "", status: "accepted", note: "" },
      draft: { owner: "", due: "", status: "todo", note: "" },
    };
    const items = [
      { id: "with_file", section: "ghg" },
      { id: "with_note", section: "ghg" },
      { id: "bare", section: "ghg" },
      { id: "draft", section: "ghg" },
    ];
    const m = buildVaultManifest(c, items, "local");
    expect(m.missing).toEqual([{ itemId: "bare", section: "ghg" }]);
    expect(m.noted.map((n) => n.itemId)).toEqual(["with_note"]);
  });

  it("local backend answers has() from the log", async () => {
    const v = localVault(SAMPLE_CLIENT.importLog);
    const first = SAMPLE_CLIENT.importLog[0];
    if (first) expect(await v.has(first.sha256)).toBe(true);
    expect(await v.has("0".repeat(64))).toBe(false);
  });
});
