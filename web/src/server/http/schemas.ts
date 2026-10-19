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
export const CreateFacility = z.object({ legalEntityId: uuid, name, kind: z.enum(FACILITY_KINDS).optional(), countryCode: country.optional(), city: z.string().max(100).nullable().optional(), naceCode: z.string().max(10).nullable().optional(), operated: z.boolean().optional(), cbamInstallation: z.boolean().optional(), responsibleUserId: uuid.nullable().optional(), validFrom: isoDate.nullable().optional(), validTo: isoDate.nullable().optional() });
export const UpdateFacility = z.object({ name: name.optional(), kind: z.enum(FACILITY_KINDS).optional(), city: z.string().max(100).nullable().optional(), operated: z.boolean().optional(), cbamInstallation: z.boolean().optional(), responsibleUserId: uuid.nullable().optional(), validTo: isoDate.nullable().optional() });
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
