import { route } from "@/server/http/api";
import { AuditQuery } from "@/server/http/schemas";
import { auditChainStatus, listAudit } from "@/server/tenancy/service";

/** Tenant audit trail (ORG-13) with the hash-chain check. */
export const GET = route({ query: AuditQuery }, async ({ actor, input }) => ({ events: await listAudit(actor, input), chain: await auditChainStatus(actor) }));
