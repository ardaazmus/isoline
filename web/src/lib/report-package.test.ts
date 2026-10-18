import { describe, expect, it } from "vitest";
import { SAMPLE_CLIENT } from "@/data/sample";
import { buildReportPackage, packageFileName } from "./report-package";
import { generateRequests } from "./requests";

describe("report package", () => {
  it("puts visibility first and covers approvals, evidence and reconciliation", () => {
    const ids = generateRequests(SAMPLE_CLIENT, ["tsrs_full"]).map((i) => i.id);
    const templateIds = ["tsrs_full"];
    const pkg = buildReportPackage(SAMPLE_CLIENT, { visibility: "authorized", templateIds, exportedAt: "2026-10-18T10:00:00.000Z", today: "2026-10-18" });
    expect(Object.keys(pkg)[0]).toBe("visibility");
    expect(pkg.visibility).toBe("authorized");
    expect(pkg.kind).toBe("isoline-report-package");
    expect(pkg.approvals.length).toBeGreaterThan(5);
    expect(pkg.reconciliation.engine).toContain("reconcile");
    expect(pkg.requests.total).toBe(ids.length);
    expect(pkgFileNameOk()).toBe(true);
  });

  it("counts accepted and overdue without crashing on empty templates", () => {
    const pkg = buildReportPackage(SAMPLE_CLIENT, { visibility: "internal", templateIds: [], exportedAt: "2026-10-18T10:00:00.000Z", today: null });
    expect(pkg.requests.total).toBe(0);
    expect(pkg.requests.accepted).toBe(0);
    expect(pkg.locked).toBe(true);
  });
});

function pkgFileNameOk() {
  return packageFileName("Anadolu Yassı Çelik A.Ş.", "2026-10-18T10:00:00.000Z").startsWith("isoline-paket-");
}
