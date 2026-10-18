import { NextResponse } from "next/server";

/**
 * Hiyerarşi sözleşmesi (§3): 6 katman + konsolidasyon kuralları.
 * Salt-okunur sözleşme ucu — istemci ve denetçi aynı katman adlarını kullanır.
 * Kayıt yazma uçları (org/entity/facility CRUD) Prisma istemcisi bağlanınca eklenir.
 */
export async function GET() {
  return NextResponse.json({
    layers: ["workspace", "organization", "legalEntity", "facility", "costCenter", "metricTask"],
    consolidation: {
      OPERATIONAL: "Tesisi işletiyorsa verinin %100'ü konsolide edilir.",
      FINANCIAL: "Tam konsolidasyona tabiyse %100 alınır.",
      EQUITY: "Ortaklık payı kadar yansır.",
    },
    roles: [
      "WORKSPACE_OWNER",
      "COMPANY_ADMIN",
      "DATA_CONTRIBUTOR",
      "DATA_OWNER",
      "NARRATIVE_WRITER",
      "EXTERNAL_AUDITOR",
    ],
  });
}
