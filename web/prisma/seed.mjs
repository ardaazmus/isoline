// Hayali kiracı seed'i — 20 kişi yok, 6 hayali kullanıcı var.
// Workspace > Organization > LegalEntity > Facility > CostCenter > MetricTask.
// Çalıştırma: npm run db:seed  (önce: docker compose up -d db && prisma migrate dev)
// Tamamen kurgu veridir; gerçek sunucuya geçişte bu dosya çalıştırılmaz.

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const USERS = [
  { subject: "hayali.owner", role: "WORKSPACE_OWNER" },
  { subject: "hayali.admin", role: "COMPANY_ADMIN" },
  { subject: "hayali.katip", role: "DATA_CONTRIBUTOR" },
  { subject: "hayali.sef", role: "DATA_OWNER" },
  { subject: "hayali.yazar", role: "NARRATIVE_WRITER" },
  { subject: "hayali.denetci", role: "EXTERNAL_AUDITOR" },
];

async function main() {
  const ws = await db.workspace.create({ data: { name: "Ege Danışmanlık (hayali)" } });
  const org = await db.organization.create({
    data: { workspaceId: ws.id, name: "Hayali Holding A.Ş." },
  });

  const members = {};
  for (const u of USERS) {
    members[u.role] = await db.membership.create({
      data: {
        workspaceId: ws.id,
        organizationId: org.id,
        subject: u.subject,
        role: u.role,
      },
    });
  }

  const demir = await db.legalEntity.create({
    data: { organizationId: org.id, name: "Ege Demir A.Ş.", equityShare: 100 },
  });
  const lojistik = await db.legalEntity.create({
    data: { organizationId: org.id, name: "Ege Lojistik A.Ş.", equityShare: 60 },
  });

  const gebze = await db.facility.create({
    data: { legalEntityId: demir.id, name: "Gebze Fabrikası", kind: "factory", control: "OPERATIONAL", equityShare: 100 },
  });
  const izmir = await db.facility.create({
    data: { legalEntityId: lojistik.id, name: "İzmir Deposu", kind: "warehouse", control: "OPERATIONAL", equityShare: 60 },
  });
  const istirak = await db.facility.create({
    data: { legalEntityId: lojistik.id, name: "İştirak Tesisi", kind: "factory", control: "EQUITY", equityShare: 50 },
  });

  const kazan = await db.costCenter.create({ data: { facilityId: gebze.id, name: "Kazan Dairesi" } });
  const filo = await db.costCenter.create({ data: { facilityId: izmir.id, name: "Araç Filosu" } });

  // Görev 1: kanıtlı + onaylı (mutlu yol)
  const t1 = await db.metricTask.create({
    data: {
      costCenterId: kazan.id,
      tool: "ghg-stationary",
      periodSlice: "2026-03",
      unit: "tCO2e",
      value: 140,
      quality: "measured",
      status: "APPROVED",
      assigneeId: members.DATA_CONTRIBUTOR.id,
      justification: "Martta ek vardiya çalışıldı.",
    },
  });
  await db.evidenceFile.create({
    data: { taskId: t1.id, objectKey: "hayali/2026-03-dogalgaz.pdf", sha256: "hayali-sha-001", uploadedBy: "hayali.katip" },
  });

  // Görev 2: kanıtsız, incelemeye takılır (Kural 2 kapısı)
  const t2 = await db.metricTask.create({
    data: {
      costCenterId: filo.id,
      tool: "ghg-mobile",
      periodSlice: "2026-03",
      unit: "tCO2e",
      value: 95,
      quality: "estimated",
      status: "IN_PROGRESS",
      assigneeId: members.DATA_CONTRIBUTOR.id,
    },
  });
  await db.validationFinding.create({
    data: { taskId: t2.id, rule: "missing-evidence", severity: "error", detail: "IN_REVIEW öncesi kanıt şart." },
  });

  await db.reportingPeriod.create({
    data: { organizationId: org.id, year: 2026, baseYear: 2023, status: "DATA_COLLECTION" },
  });
  await db.auditLog.create({
    data: { organizationId: org.id, actor: "hayali.denetci", action: "seed.loaded", entityRef: org.id },
  });

  const counts = {
    workspaces: await db.workspace.count(),
    organizations: await db.organization.count(),
    legalEntities: await db.legalEntity.count(),
    facilities: await db.facility.count(),
    costCenters: await db.costCenter.count(),
    tasks: await db.metricTask.count(),
    memberships: await db.membership.count(),
    evidences: await db.evidenceFile.count(),
    findings: await db.validationFinding.count(),
  };
  console.log("seed-ok", JSON.stringify(counts));
}

await main().catch(async (e) => {
  console.error("seed-fail", e.message);
  process.exitCode = 1;
}).finally(() => db.$disconnect());
