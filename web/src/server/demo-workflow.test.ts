/**
 * Uçtan uca kiracı akışı (hayali kullanıcılar — 20 kişiye gerek yok).
 * Senaryo: owner kuruluş açar → admin dönem açar → katip kanıtsız sunamaz,
 * kanıtla sunar → katip onaylayamaz, şef onaylar → YoY gerekçesi kontrol edilir →
 * tesisler konsolide edilir → denetçi mühürler.
 */
import { describe, expect, it } from "vitest";
import { can } from "./rbac";
import {
  canTransition,
  consolidateFacilities,
  needsJustification,
  reviewGate,
} from "./hierarchy";

describe("demo tenant workflow (hayali holding)", () => {
  it("runs the full approval chain with the gates enforced", () => {
    // ADIM 1–2: kuruluş + dönem (yetki: owner, admin)
    expect(can("WORKSPACE_OWNER", "org:create")).toBe(true);
    expect(can("DATA_CONTRIBUTOR", "org:create")).toBe(false);
    expect(can("COMPANY_ADMIN", "period:open")).toBe(true);

    // ADIM 5: katip kanıtsız IN_REVIEW'e geçemez (Kural 2 kapısı)
    expect(reviewGate(0)).toEqual({ ok: false, reason: "missingEvidence" });
    expect(canTransition("IN_PROGRESS", "IN_REVIEW")).toBe(true);
    expect(can("DATA_CONTRIBUTOR", "task:submit")).toBe(true);

    // ADIM 6: katip onaylayamaz, şef onaylar; %30 üstü sapmada gerekçe şart (Kural 1)
    expect(can("DATA_CONTRIBUTOR", "task:approve")).toBe(false);
    expect(can("DATA_OWNER", "task:approve")).toBe(true);
    expect(needsJustification(140, 100)).toBe(true); // seed'deki görevde gerekçe var
    expect(needsJustification(105, 100)).toBe(false);

    // Konsolidasyon: Gebze OPERATIONAL %100, İştirak EQUITY %50
    const { rows, total } = consolidateFacilities([
      { id: "gebze", name: "Gebze Fabrikası", control: "OPERATIONAL", equityShare: 100, emissions: 1000 },
      { id: "istirak", name: "İştirak Tesisi", control: "EQUITY", equityShare: 50, emissions: 1000 },
    ]);
    expect(rows[0].attributed).toBe(1000);
    expect(rows[1].attributed).toBe(500);
    expect(total).toBe(1500);

    // ADIM 6 sonu: mühür yalnızca denetçide
    expect(can("EXTERNAL_AUDITOR", "audit:seal")).toBe(true);
    expect(can("DATA_CONTRIBUTOR", "audit:seal")).toBe(false);
    expect(canTransition("APPROVED", "SEALED")).toBe(true);
  });
});
