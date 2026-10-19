import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { ACTIONS, GRANT_ROLES, MEMBER_ROLES, grantCan, memberCan } from "./policy";

describe("role and grant permissions", () => {
  it("follows the plan's role table for the governance actions", () => {
    expect(memberCan("owner", "tenant.manage")).toBe(true);
    expect(memberCan("contributor", "data.submit")).toBe(true);
    expect(memberCan("contributor", "data.review")).toBe(false);
    expect(memberCan("contributor", "report.release")).toBe(false);
    expect(memberCan("management_signer", "report.release")).toBe(true);
    expect(memberCan("report_editor", "data.submit")).toBe(false);
    expect(memberCan("viewer", "project.update")).toBe(false);
  });
  it("never lets a grant carry customer governance (release, close, access, audit)", () => {
    for (const r of GRANT_ROLES) {
      for (const a of ["tenant.manage", "grant.manage", "audit.read", "report.release", "cycle.close"] as const) expect(grantCan(r, a, true)).toBe(false);
    }
  });
  it("keeps read-only grants read-only and downloads behind the explicit flag", () => {
    expect(grantCan("reviewer", "data.submit")).toBe(false);
    expect(grantCan("assurance", "data.submit")).toBe(false);
    expect(grantCan("design", "evidence.download", true)).toBe(false);
    expect(grantCan("preparer", "evidence.download", false)).toBe(false);
    expect(grantCan("preparer", "evidence.download", true)).toBe(true);
  });
  it("property: unknown roles and actions are denied", () => {
    fc.assert(
      fc.property(fc.string(), fc.constantFrom(...ACTIONS), (role, action) => {
        fc.pre(!(MEMBER_ROLES as readonly string[]).includes(role) && !(GRANT_ROLES as readonly string[]).includes(role));
        expect(memberCan(role as never, action)).toBe(false);
        expect(grantCan(role as never, action, true)).toBe(false);
      }),
    );
  });
});
