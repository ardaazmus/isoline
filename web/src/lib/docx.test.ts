import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { buildDocx, type DocApproval } from "./docx";
import { allLocked, sectionsOf } from "./approval";

const labels = { title: "Onay durumu", section: "Bölüm", status: "Durum", preparedBy: "Hazırlayan", approvedBy: "Onaylayan", date: "Onay tarihi" };

async function documentXml(approval?: DocApproval): Promise<string> {
  const blob = await buildDocx({
    title: "Başlık",
    subtitle: "Alt başlık",
    client: "Müşteri",
    intro: "Giriş",
    sections: [{ title: "Bölüm", guide: "Rehber", refs: [], figures: [] }],
    labels: { refs: "Atıf", figures: "Rakamlar", draft: "Taslak metin", sources: "Kaynaklar" },
    sources: [],
    approval,
  });
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  return zip.file("word/document.xml")!.async("string");
}

describe("Word sign-off block", () => {
  it("prints who prepared and approved each section, and a draft note when something is not approved", async () => {
    const xml = await documentXml({
      labels,
      rows: [
        { section: "Kapsam 1-2-3 envanteri", status: "Onaylandı, kilitli", preparedBy: "Ayşe Kaya", approvedBy: "Mehmet Demir", date: "18.10.2026" },
        { section: "Mizan", status: "Taslak", preparedBy: "", approvedBy: "", date: "" },
      ],
      draftNote: "TASLAK: onaylanmamış veri",
    });
    for (const s of ["Onay durumu", "Hazırlayan", "Ayşe Kaya", "Mehmet Demir", "18.10.2026", "Mizan", "TASLAK: onaylanmamış veri"]) expect(xml).toContain(s);
  });
  it("leaves the block out when the document uses no approval section", async () => {
    const xml = await documentXml(undefined);
    expect(xml).not.toContain("Onay durumu");
  });
  it("finds the sections a template draws on and whether they are all locked", () => {
    expect(sectionsOf(["ghg", "workforce", "ghg", "templates", "regulations"])).toEqual(["ghg", "workforce"]);
    const approved = { status: "approved" as const, preparedBy: "A", approvedBy: "B", approvedAt: "2026-10-18T10:00:00.000Z", log: [] };
    expect(allLocked({ ghg: approved }, ["ghg", "workforce"])).toBe(false);
    expect(allLocked({ ghg: approved, workforce: { ...approved, status: "published" } }, ["ghg", "workforce"])).toBe(true);
    expect(allLocked({}, [])).toBe(true);
  });
});
