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
