/**
 * Sunucu tarafı konsolidasyon (hiyerarşi §3: GHG Protocol uyumlu).
 * Saf fonksiyonlar — DB yok; Prisma modelleri bu tiplere dökülür.
 *
 * Ağırlık kuralı: OPERATIONAL/FINANCIAL kontrol %100 alır, EQUITY özkaynak
 * payı kadar alır. Tesis düğümündeki `control` + `equityShare` belirler.
 */

export type ConsolidationMethod = "OPERATIONAL" | "FINANCIAL" | "EQUITY";

export type FacilityNode = {
  id: string;
  name: string;
  control: ConsolidationMethod;
  /** Özkaynak payı yüzdesi (0–100). */
  equityShare: number;
  /** Tesisin ölçülen emisyonu (tCO₂e). */
  emissions: number;
};

export type ConsolidatedRow = FacilityNode & { weight: number; attributed: number };

/** Tek tesisin etkin ağırlığı. */
export function facilityWeight(f: Pick<FacilityNode, "control" | "equityShare">): number {
  if (f.control === "EQUITY") {
    const s = Number(f.equityShare);
    if (!Number.isFinite(s)) return 1;
    return Math.min(1, Math.max(0, s / 100));
  }
  return 1;
}

/** Tesis listesini konsolide eder; toplam + satırları döner. */
export function consolidateFacilities(sites: FacilityNode[]): { rows: ConsolidatedRow[]; total: number } {
  const rows = sites.map((s) => {
    const weight = facilityWeight(s);
    return { ...s, weight, attributed: s.emissions * weight };
  });
  return { rows, total: rows.reduce((n, r) => n + r.attributed, 0) };
}

export type TaskStatus = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "APPROVED" | "REJECTED" | "SEALED";

const TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  TODO: ["IN_PROGRESS"],
  IN_PROGRESS: ["IN_REVIEW", "TODO"],
  IN_REVIEW: ["APPROVED", "REJECTED"],
  REJECTED: ["IN_PROGRESS"],
  APPROVED: ["SEALED"],
  SEALED: [],
};

/** Geçerli durum geçişi mi? */
export function canTransition(from: TaskStatus, to: TaskStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/**
 * Kural 2 (eksik kanıt kapısı): IN_REVIEW'e geçişte en az bir kanıt şart.
 * Döner: { ok } ya da { ok: false, reason }.
 */
export function reviewGate(evidenceCount: number): { ok: true } | { ok: false; reason: "missingEvidence" } {
  return evidenceCount > 0 ? { ok: true } : { ok: false, reason: "missingEvidence" };
}

/**
 * Kural 1 (YoY sapma ±%30): eşiği aşan değişimde gerekçe (justification) zorunlu.
 * `prior` 0 ise oran tanımsızdır — temkinli tarafta kalıp gerekçe ister.
 */
export function needsJustification(current: number, prior: number, threshold = 0.3): boolean {
  if (!Number.isFinite(current) || !Number.isFinite(prior) || prior === 0) return true;
  return Math.abs(current / prior - 1) > threshold;
}
