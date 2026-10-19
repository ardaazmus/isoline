import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { detect, safeFilename } from "./filetype";

const bytes = (...xs: number[]) => new Uint8Array(xs);
const text = (s: string) => new TextEncoder().encode(s);

describe("evidence file type", () => {
  it("detects allowed formats by content", () => {
    expect(detect(text("%PDF-1.7\n..."), "fatura.pdf")?.mime).toBe("application/pdf");
    expect(detect(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0), "sayac.png")?.mime).toBe("image/png");
    expect(detect(bytes(0xff, 0xd8, 0xff, 0xe0), "foto.jpg")?.mime).toBe("image/jpeg");
    expect(detect(bytes(0x50, 0x4b, 0x03, 0x04, 1, 2), "mizan.xlsx")?.mime).toContain("spreadsheetml");
    expect(detect(text("tesis;yakit;miktar\nA;dogalgaz;1200\n"), "veri.csv")?.mime).toBe("text/csv");
  });

  it("refuses scripts and markup disguised as evidence", () => {
    expect(detect(text("<svg onload=alert(1)>"), "grafik.svg")).toBeNull();
    expect(detect(text("<html><script>x()</script>"), "rapor.html")).toBeNull();
    expect(detect(bytes(0x4d, 0x5a, 0x90, 0x00), "fatura.pdf")).toBeNull(); // Windows executable renamed to .pdf
    expect(detect(new Uint8Array(), "bos.txt")).toBeNull();
  });

  it("the detected type never depends on a lying extension for binary formats", () => {
    expect(detect(text("%PDF-1.4"), "x.png")?.mime).toBe("application/pdf");
  });

  it("safe file names keep no path or control characters", () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        const n = safeFilename(s);
        expect(n.length).toBeGreaterThan(0);
        expect(n.length).toBeLessThanOrEqual(255);
        expect(/[\\/\u0000-\u001f]/.test(n)).toBe(false);
        expect(n.startsWith(".")).toBe(false);
      }),
    );
    expect(safeFilename("../../etc/passwd")).toBe("passwd");
    expect(safeFilename("C:\\Users\\x\\Fatura Ocak.pdf")).toBe("Fatura Ocak.pdf");
  });
});
