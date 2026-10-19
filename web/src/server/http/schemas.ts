/** Request bodies for /api/v1 (zod). Shared by route handlers and server actions. */
import { z } from "zod";
import { GRANT_ROLES, MEMBER_ROLES } from "../policy/policy";

export const uuid = z.uuid();
export const name = z.string().trim().min(1).max(200);
export const email = z.string().trim().toLowerCase().pipe(z.email().max(254));

export const CreateTenant = z.object({ name, kind: z.enum(["company", "advisory"]), acceptTerms: z.literal(true), termsVersion: z.string().min(1).max(40) });
export const TenantSettings = z.object({ name: name.optional(), requireMfa: z.boolean().optional() }).refine((v) => v.name !== undefined || v.requireMfa !== undefined, "nothing to change");
export const Invite = z.object({ email, role: z.enum(MEMBER_ROLES).exclude(["owner"]) });
export const Token = z.object({ token: z.string().min(16).max(200) });
export const CreateProject = z.object({ name, ownerTenantId: uuid.optional() });
export const Grant = z.object({
  recipientTenantId: uuid,
  role: z.enum(GRANT_ROLES),
  purpose: z.string().trim().min(3).max(500),
  days: z.number().int().min(1).max(365),
  dataClasses: z.array(z.string().max(40)).max(20).optional(),
  canDownload: z.boolean().optional(),
  acceptTerms: z.literal(true),
  termsVersion: z.string().min(1).max(40),
});
export const ProvisionalClient = z.object({ name, contactEmail: email });
export const ChooseTenant = z.object({ tenantId: uuid });
export const AuditQuery = z.object({ limit: z.coerce.number().int().min(1).max(200).optional(), beforeId: z.coerce.number().int().positive().optional(), projectId: uuid.optional() });

export const LegacyImport = z.object({
  content: z.string().min(2).max(20 * 1024 * 1024),
  fileName: z.string().trim().min(1).max(255),
  mode: z.enum(["own", "provisional"]),
  includeSample: z.boolean().optional(),
});

// ---------------------------------------------------------------- G2
const isoDate = z.iso.date();
const country = z.string().regex(/^[A-Z]{2}$/);
export const ENTITY_TYPES = ["listed", "bank", "bank_tmsf", "nonbank_fi", "insurer", "capital_markets_fi", "precious_metals", "unlisted_company", "public_body"] as const;
export const FACILITY_KINDS = ["plant", "office", "warehouse", "store", "site", "mine", "vessel", "other"] as const;
export const CONTROLS = ["operational", "financial", "joint", "significant_influence", "none"] as const;
export const BOUNDARY_KINDS = ["ghg_operational_control", "ghg_financial_control", "ghg_equity_share", "financial_reporting", "cbam_facility_product"] as const;
export const REPORT_KINDS = ["tsrs", "gri", "esrs", "vsme", "annual_report", "integrated", "ghg_inventory", "cbam", "tr_ets", "cdp", "other"] as const;
export const RACI_ROLES = ["project_lead", "data_lead", "data_owner", "contributor", "technical_reviewer", "report_editor", "management_signer", "advisor_preparer", "advisor_reviewer", "assurance", "design"] as const;

export const CreateOrganization = z.object({ name, countryCode: country.optional(), sectorCode: z.string().regex(/^[A-U]([0-9]{2}(\.[0-9]{1,2})?)?$/).nullable().optional(), fiscalYearStartMonth: z.number().int().min(1).max(12).optional(), ownerTenantId: uuid.optional() });
export const CreateEntity = z.object({ organizationId: uuid, name, countryCode: country.optional(), taxId: z.string().regex(/^[0-9A-Za-z-]{5,20}$/).nullable().optional(), tradeRegistryNo: z.string().max(40).nullable().optional(), entityType: z.enum(ENTITY_TYPES).optional(), isReportingParent: z.boolean().optional(), validFrom: isoDate.nullable().optional(), validTo: isoDate.nullable().optional() });
export const UpdateEntity = CreateEntity.omit({ organizationId: true, countryCode: true, tradeRegistryNo: true }).partial();
export const OwnershipEdge = z.object({ parentEntityId: uuid, childEntityId: uuid, sharePct: z.number().gt(0).max(100), control: z.enum(CONTROLS), validFrom: isoDate, validTo: isoDate.nullable().optional(), sourceNote: z.string().max(500).nullable().optional() });
export const EndEdge = z.object({ validTo: isoDate });
export const CreateFacility = z.object({ legalEntityId: uuid, name, kind: z.enum(FACILITY_KINDS).optional(), countryCode: country.optional(), city: z.string().max(100).nullable().optional(), naceCode: z.string().max(10).nullable().optional(), operated: z.boolean().optional(), cbamInstallation: z.boolean().optional(), gridConnection: z.enum(["transmission", "distribution"]).optional(), responsibleUserId: uuid.nullable().optional(), validFrom: isoDate.nullable().optional(), validTo: isoDate.nullable().optional() });
export const UpdateFacility = z.object({ name: name.optional(), kind: z.enum(FACILITY_KINDS).optional(), city: z.string().max(100).nullable().optional(), operated: z.boolean().optional(), cbamInstallation: z.boolean().optional(), gridConnection: z.enum(["transmission", "distribution"]).optional(), responsibleUserId: uuid.nullable().optional(), validTo: isoDate.nullable().optional() });
export const TreeQuery = z.object({ asOf: isoDate.optional(), ownerTenantId: uuid.optional() });

export const Cycle = z.object({ label: z.string().trim().max(120).optional(), reportingYear: z.number().int().min(2000).max(2100), periodStart: isoDate.optional(), periodEnd: isoDate.optional(), publishDue: isoDate.nullable().optional(), isBaseYear: z.boolean().optional(), planStart: isoDate.optional() });
export const ProjectWizard = z.object({ name, description: z.string().max(2000).nullable().optional(), ownerTenantId: uuid.optional(), organizationId: uuid.nullable().optional(), engagementId: uuid.nullable().optional(), cycle: Cycle, planStart: isoDate.optional() });
export const MoveTo = z.object({ to: z.string().regex(/^[a-z_]{3,20}$/) });
export const ProposeBoundary = z.object({ kind: z.enum(BOUNDARY_KINDS) });
export const BoundaryMember = z.object({ inclusionPct: z.number().min(0).max(100), reason: z.string().max(500).nullable().optional() });

const nonNeg = z.number().min(0).max(1e16);
const year = z.object({ totalAssetsTry: nonNeg, revenueTry: nonNeg, employees: z.number().int().min(0).max(10_000_000) });
export const ApplicabilityProfile = z.object({
  entityType: z.enum(ENTITY_TYPES),
  watchlistMarket: z.boolean(),
  bistMainMarkets: z.boolean(),
  branches: z.number().int().min(0).max(100_000),
  sharesListed: z.boolean().optional(),
  history: z.tuple([year, year]),
  regulatedStatus: z.tuple([z.boolean(), z.boolean()]),
  reportingYear: z.number().int().min(2000).max(2100),
  firstTsrsYear: z.number().int().min(2023).max(2100).nullable(),
  euEntity: z.boolean(),
  euTurnoverEur: nonNeg,
  euTurnoverPrevEur: nonNeg.optional(),
  euSubsidiaryTurnoverEur: nonNeg,
  worldwideTurnoverEur: nonNeg,
  employeesGroup: z.number().int().min(0).max(10_000_000),
  euCsrdCustomers: z.boolean(),
  cbamSectors: z.array(z.string().max(30)).max(10),
  euExportTonnes: nonNeg,
  annualEmissionsTco2e: nonNeg,
  pilotSector: z.string().max(30),
  eudrCommodities: z.boolean(),
  smallOrMicro: z.boolean(),
  dppProducts: z.boolean(),
  batteries: z.boolean(),
  energyToe: nonNeg,
});
export const RunApplicability = z.object({ profile: ApplicabilityProfile });
export const DecideApplicability = z.object({ decision: z.enum(["in_scope", "voluntary", "not_applicable", "needs_review"]), rationale: z.string().trim().min(10).max(2000), decisionSource: z.string().max(500).nullable().optional() });
export const AddParticipant = z.object({ userId: uuid, memberTenantId: uuid, raciRole: z.enum(RACI_ROLES), responsibilities: z.string().max(500).nullable().optional(), facilityIds: z.array(uuid).max(200).optional() });
export const WorkPackagePatch = z.object({
  status: z.enum(["not_ready", "ready", "active", "review", "done", "blocked", "rework"]).optional(),
  responsibleUserId: uuid.nullable().optional(),
  accountableUserId: uuid.nullable().optional(),
  startsOn: isoDate.optional(),
  dueOn: isoDate.optional(),
  blockedReason: z.string().max(500).nullable().optional(),
  title: z.string().trim().min(1).max(200).optional(),
});
export const AddDependency = z.object({ dependsOnId: uuid });
export const CreateEngagement = z.object({ title: name, scope: z.string().max(4000).nullable().optional(), advisoryTenantId: uuid.nullable().optional(), startsOn: isoDate.nullable().optional(), endsOn: isoDate.nullable().optional(), ownerTenantId: uuid.optional() });
export const AddDeliverable = z.object({ title: name, reportKind: z.enum(REPORT_KINDS), dueOn: isoDate.nullable().optional(), projectId: uuid.nullable().optional() });

// ---------------------------------------------------------------- G3
export const CreateCampaign = z.object({ title: z.string().trim().max(200), templateIds: z.array(z.string().regex(/^[a-z0-9_]+$/)).min(1).max(20), dueOn: isoDate.nullable().optional(), facilityIds: z.array(uuid).max(500).nullable().optional() });
export const ExtendCampaign = z.object({ templateIds: z.array(z.string().regex(/^[a-z0-9_]+$/)).min(1).max(20) });
export const AssignRequests = z.object({ requestIds: z.array(uuid).min(1).max(1000), assigneeUserId: uuid.nullable().optional(), reviewerUserId: uuid.nullable().optional(), dueOn: isoDate.nullable().optional(), critical: z.boolean().optional() });
export const RequestIds = z.object({ requestIds: z.array(uuid).min(1).max(1000) });
export const CloseRequest = z.object({ to: z.enum(["withdrawn", "not_applicable"]), reason: z.string().trim().min(10).max(2000) });
const num = z.union([z.string().max(60), z.number()]);
export const Draft = z.object({
  value: num.nullable().optional(),
  unit: z.string().max(20).nullable().optional(),
  text: z.string().max(4000).nullable().optional(),
  lines: z.array(z.object({ key: z.string().min(1).max(60), label: z.string().max(120).optional(), value: num, unit: z.string().max(20) })).max(100).nullable().optional(),
  quality: z.enum(["measured", "calculated", "estimated"]).optional(),
  methodNote: z.string().max(2000).nullable().optional(),
  sourceRef: z.string().max(500).nullable().optional(),
});
export const Note = z.object({ note: z.string().max(2000).nullable().optional() });
export const Reason = z.object({ reason: z.string().trim().min(10).max(2000) });
export const Comment = z.object({ body: z.string().trim().min(1).max(4000) });
export const LinkEvidence = z.object({ evidenceId: uuid });
export const MarkRead = z.object({ ids: z.array(z.number().int().positive()).max(500) });
export const UpdateCampaign = z.object({
  reminderPolicy: z.object({ beforeDays: z.array(z.number().int()).max(5), afterDays: z.array(z.number().int()).max(5), criticalOnlyDays: z.array(z.number().int()).max(5) }).optional(),
  status: z.enum(["active", "closed"]).optional(),
});

// ---------------------------------------------------------------- G4
export const RunCalculation = z.object({
  kind: z.enum(["ghg", "environment", "workforce", "finance", "cbam", "ets"]),
  boundaryKind: z.enum(["ghg_operational_control", "ghg_financial_control", "ghg_equity_share", "financial_reporting", "cbam_facility_product"]).nullable().optional(),
  mode: z.enum(["preview", "final"]).optional(),
});
export const ChooseFactor = z.object({ target: z.string().regex(/^(grid|fuel|gwp|scope3|cbam):[a-z0-9_:./-]+$/).max(120), factorValueId: uuid, reason: z.string().trim().max(500).nullable().optional() });
export const AddFactorSet = z.object({
  code: z.string().regex(/^[a-z0-9_]{3,40}$/),
  name,
  publisher: z.string().trim().min(1).max(200),
  licence: z.enum(["open", "public_sector", "user_licensed"]),
  url: z.string().url().max(500).nullable().optional(),
  year: z.number().int().min(1990).max(2100).nullable().optional(),
  csv: z.string().min(1).max(2_000_000),
  rightsConfirmed: z.boolean(),
});
export const ResolveIssue = z.object({ decision: z.enum(["resolved", "accepted_exception"]), resolution: z.string().trim().min(10).max(2000) });
export const IssuesQuery = z.object({ status: z.enum(["open", "all"]).optional() });
export const RunsQuery = z.object({ cycleId: uuid.optional() });

// ---------------------------------------------------------------- G5
const money = z.union([z.string().max(40), z.number()]);
export const EntityFinancial = z.object({ legalEntityId: uuid, netSales: money, evidenceId: uuid.nullable().optional(), note: z.string().max(2000).nullable().optional() });
export const Elimination = z.object({ sellerEntityId: uuid, buyerEntityId: uuid, amount: money, description: z.string().trim().min(3).max(500), evidenceId: uuid.nullable().optional() });
export const ReopenReason = z.object({ reason: z.string().trim().min(20).max(2000) });

// ---------------------------------------------------------------- G6
export const CreateReport = z.object({ cycleId: uuid, templateId: z.string().regex(/^[a-z0-9_]+$/), title: z.string().trim().max(200).nullable().optional(), language: z.enum(["tr", "en"]).optional() });
export const SaveSection = z.object({ body: z.string().max(100_000), baseVersion: z.number().int().min(0).nullable().optional() });
export const AssignSection = z.object({ ownerUserId: uuid.nullable().optional(), dueOn: isoDate.nullable().optional() });
export const ReviewSection = z.object({ decision: z.enum(["approve", "reject"]), note: z.string().max(2000).nullable().optional() });
export const StageDecision = z.object({ decision: z.enum(["approved", "changes_requested"]), comment: z.string().max(2000).nullable().optional() });
export const Release = z.object({ amendmentReason: z.string().trim().max(2000).nullable().optional() });
export const ProofDecision = z.object({ decision: z.enum(["approved", "changes_requested"]), note: z.string().max(2000).nullable().optional() });

// ---------------------------------------------------------------- G7
export const EnablePack = z.object({ packId: z.string().regex(/^[a-z0-9_]+$/), facilityIds: z.array(uuid).max(500) });
export const DisablePack = z.object({ packId: z.string().regex(/^[a-z0-9_]+$/) });
export const AskQuestion = z.object({ targetType: z.enum(["fact", "evidence", "report", "general"]), targetId: z.string().max(100).nullable().optional(), question: z.string().trim().min(10).max(4000) });
export const AnswerQuestion = z.object({ answer: z.string().trim().min(10).max(8000), evidenceIds: z.array(uuid).max(20).optional() });
export const CreateAssuranceEngagement = z.object({ standard: z.enum(["isae3000", "isae3410", "issa5000", "kgk_gds", "other"]), level: z.enum(["limited", "reasonable"]), providerTenantId: uuid.nullable().optional() });
export const EngagementStatus = z.object({ status: z.enum(["preparing", "ready", "in_progress", "opinion_received", "withdrawn"]), opinionEvidenceId: uuid.nullable().optional() });

// ---------------------------------------------------------------- G8
export const CreateConnector = z.object({ name: z.string().trim().min(1).max(120), kind: z.enum(["http_csv", "http_json"]), url: z.string().url().max(500), secret: z.string().max(500).nullable().optional(), schedule: z.enum(["manual", "daily"]).optional() });

// ---------------------------------------------------------------- cycle worksheets (UX Faz 3)
export const WorksheetQuery = z.object({ reportId: uuid.optional() });
export const SaveWorksheet = z.object({ payload: z.unknown(), reportId: uuid.nullable().optional(), note: z.string().trim().max(2000).nullable().optional() });
export const WorksheetReturn = z.object({ reason: z.string().trim().min(10).max(2000) });

// ---------------------------------------------------------------- quick calculation → cycle (UX Faz 3)
export const QuickTargetsQuery = z.object({ metrics: z.string().max(400) });
const QuickLine = z.object({ key: z.string().trim().min(1).max(60), value: z.number().finite().min(0), unit: z.string().trim().min(1).max(20) });
export const QuickSaveBody = z.object({
  items: z
    .array(z.object({ requestId: uuid, draft: z.object({ metric: z.string().max(60), value: z.number().finite().min(0).optional(), unit: z.string().max(20).optional(), lines: z.array(QuickLine).max(40).optional() }) }))
    .min(1)
    .max(50),
});
