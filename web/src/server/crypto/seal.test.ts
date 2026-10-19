import { randomBytes } from "node:crypto";
import fc from "fast-check";
import { beforeAll, describe, expect, it } from "vitest";
import { seal, unseal } from "./seal";

beforeAll(() => {
  process.env.APP_ENCRYPTION_KEY = randomBytes(32).toString("base64url");
});

describe("seal", () => {
  it("round-trips any string and never shows the plain text", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), fc.string(), (plain, aad) => {
        const s = seal(plain, aad);
        expect(unseal(s, aad)).toBe(plain);
        if (plain.length >= 8) expect(s.includes(plain)).toBe(false);
        expect(seal(plain, aad)).not.toBe(s); // fresh IV every time
      }),
      { numRuns: 200 },
    );
  });

  it("rejects a tampered value, the wrong context or another key", () => {
    const s = seal("token-123", "invitation:a");
    const parts = s.split(".");
    const flipped = [parts[0], parts[1], parts[2].slice(0, -1) + (parts[2].endsWith("A") ? "B" : "A"), parts[3]].join(".");
    expect(() => unseal(flipped, "invitation:a")).toThrow();
    expect(() => unseal(s, "invitation:b")).toThrow();
    const old = process.env.APP_ENCRYPTION_KEY;
    process.env.APP_ENCRYPTION_KEY = randomBytes(32).toString("base64url");
    expect(() => unseal(s, "invitation:a")).toThrow();
    process.env.APP_ENCRYPTION_KEY = old;
  });

  it("refuses to run without a proper key", () => {
    const old = process.env.APP_ENCRYPTION_KEY;
    process.env.APP_ENCRYPTION_KEY = "short";
    expect(() => seal("x")).toThrow(/32 bytes/);
    process.env.APP_ENCRYPTION_KEY = old;
  });
});
