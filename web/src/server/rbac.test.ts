import { describe, expect, it } from "vitest";
import { can, isReadOnly } from "./rbac";

describe("rbac", () => {
  it("lets the workspace owner open orgs and the company admin open periods", () => {
    expect(can("WORKSPACE_OWNER", "org:create")).toBe(true);
    expect(can("COMPANY_ADMIN", "org:create")).toBe(false);
    expect(can("COMPANY_ADMIN", "period:open")).toBe(true);
  });
  it("keeps the contributor/checker split and the auditor read-only", () => {
    expect(can("DATA_CONTRIBUTOR", "task:submit")).toBe(true);
    expect(can("DATA_CONTRIBUTOR", "task:approve")).toBe(false);
    expect(can("DATA_OWNER", "task:approve")).toBe(true);
    expect(can("EXTERNAL_AUDITOR", "audit:seal")).toBe(true);
    expect(can("EXTERNAL_AUDITOR", "task:submit")).toBe(false);
    expect(isReadOnly("EXTERNAL_AUDITOR")).toBe(true);
    expect(isReadOnly("DATA_OWNER")).toBe(false);
  });
});
