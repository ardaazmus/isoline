/**
 * G8-08: API surface inventory. Every handler under src/app/api goes through route() (session → verified actor →
 * tenant → MFA → validation → CSRF origin → idempotency), except a short, reviewed list that carries no tenant
 * data. A new public endpoint fails this test until it is added here on purpose.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(process.cwd(), "src", "app", "api");
const files = (dir: string): string[] => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? files(join(dir, n)) : n === "route.ts" ? [join(dir, n)] : []));

/** Reviewed exceptions: auth library endpoints, liveness, a static contract, the invitation preview (token-gated). */
const OUTSIDE_ROUTE = ["auth/[...all]/route.ts", "v1/health/route.ts", "v1/hierarchy/route.ts"];
const PUBLIC = ["v1/invitations/preview/route.ts"];

describe("API surface", () => {
  const all = files(root).map((f) => ({ path: relative(root, f).replace(/\\/g, "/"), text: readFileSync(f, "utf8") }));

  it("every handler uses route(), except the reviewed list", () => {
    const outside = all.filter((f) => !/\broute\(/.test(f.text)).map((f) => f.path).sort();
    expect(outside).toEqual(OUTSIDE_ROUTE.sort());
  });

  it("no endpoint is public except the reviewed one", () => {
    expect(all.filter((f) => /public:\s*true/.test(f.text)).map((f) => f.path)).toEqual(PUBLIC);
  });

  it("no handler reaches the system (RLS-bypassing) database role directly", () => {
    expect(all.filter((f) => /withSystem|systemDb/.test(f.text)).map((f) => f.path)).toEqual([]);
  });

  it("the inventory is large enough to mean something", () => {
    expect(all.length).toBeGreaterThan(120);
  });
});
