/**
 * Role and grant permissions (RBAC; plan 03 §6, ADR-007). Deny by default: an action not listed for a role is
 * refused. Scope (ABAC: tenant, project, facility, cycle, state) is checked by the services and by RLS; this
 * module answers only "may this role attempt this action at all".
 */
export const MEMBER_ROLES = ["owner", "admin", "project_lead", "data_owner", "contributor", "report_editor", "management_signer", "viewer", "preparer", "reviewer"] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

export const GRANT_ROLES = ["preparer", "reviewer", "methodology", "design", "assurance"] as const;
export type GrantRole = (typeof GRANT_ROLES)[number];

export const ACTIONS = [
  "tenant.manage", // members, invitations, settings
  "grant.manage", // open, narrow, revoke external access
  "audit.read",
  "client.create", // advisory: open a provisional client
  "project.create",
  "project.update",
  "project.read",
  "org.manage", // organisation tree, boundaries (G2)
  "data.request", // build campaigns, assign tasks (G3)
  "data.submit", // enter observations, upload evidence
  "data.review", // accept or return submissions (someone else's)
  "evidence.upload",
  "evidence.download",
  "calc.run", // run calculations (G4)
  "quality.review", // close quality issues (G5)
  "cycle.close", // freeze a reporting cycle (G5)
  "report.write", // draft report sections (G6)
  "report.review", // technical/customer section review
  "report.release", // management signature, publication
  "design.handoff", // design partner assets
  "assurance.query", // external assurance questions
] as const;
export type Action = (typeof ACTIONS)[number];

const ALL_READ: Action[] = ["project.read"];

const MEMBER: Record<MemberRole, Action[]> = {
  owner: ["tenant.manage", "grant.manage", "audit.read", "client.create", "project.create", "project.update", "project.read", "org.manage", "data.request", "data.submit", "evidence.upload", "evidence.download", "report.write", "report.review", "cycle.close"],
  admin: ["tenant.manage", "grant.manage", "audit.read", "client.create", "project.create", "project.update", "project.read", "org.manage", "data.request", "evidence.download"],
  project_lead: ["project.create", "project.update", "project.read", "org.manage", "data.request", "data.submit", "data.review", "evidence.upload", "evidence.download", "calc.run", "quality.review", "cycle.close", "report.write", "report.review"],
  data_owner: ["project.read", "data.submit", "data.review", "evidence.upload", "evidence.download", "quality.review"],
  contributor: ["project.read", "data.submit", "evidence.upload"],
  report_editor: ["project.read", "report.write", "evidence.download"],
  management_signer: ["project.read", "report.review", "report.release", "evidence.download"],
  viewer: [...ALL_READ],
  // advisory tenant's own staff (working in their own tenant or under a grant)
  preparer: ["project.read", "client.create", "project.create", "data.request", "data.submit", "evidence.upload", "evidence.download", "calc.run", "report.write"],
  reviewer: ["project.read", "data.review", "quality.review", "report.review", "evidence.download"],
};

/** What a grant lets the recipient tenant do inside the customer's project (plan 03 §6, 10). */
const GRANT: Record<GrantRole, Action[]> = {
  preparer: ["project.read", "data.request", "data.submit", "evidence.upload", "calc.run", "report.write"],
  methodology: ["project.read", "calc.run", "data.review"],
  reviewer: ["project.read", "report.review"],
  design: ["project.read", "design.handoff"],
  assurance: ["project.read", "assurance.query"],
};

/** Actions no grant can ever carry: customer governance stays with the customer (plan 03 §6, 05 §6). */
const NEVER_BY_GRANT: Action[] = ["tenant.manage", "grant.manage", "audit.read", "report.release", "cycle.close"];

export function memberCan(role: MemberRole, action: Action): boolean {
  // own keys only: a role named "constructor" or "toString" must not reach Object.prototype
  return Object.hasOwn(MEMBER, role) && MEMBER[role].includes(action);
}

export function grantCan(role: GrantRole, action: Action, canDownload = false): boolean {
  if (NEVER_BY_GRANT.includes(action)) return false;
  if (!Object.hasOwn(GRANT, role)) return false;
  if (action === "evidence.download") return canDownload && (role === "preparer" || role === "methodology" || role === "assurance");
  return Object.hasOwn(GRANT, role) && GRANT[role].includes(action);
}

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message = code,
  ) {
    super(message);
  }
}

export const forbidden = (code = "forbidden") => new HttpError(403, code);
/** Another tenant's resource answers 404, never 403: existence is not disclosed (OWASP API1). */
export const notFound = (code = "not_found") => new HttpError(404, code);
