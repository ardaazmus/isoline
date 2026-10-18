/**
 * Sunucu tarafı RBAC (iş akışı §4.1: 6 temel rol). Saf fonksiyonlar — DB yok.
 * Roller veritabanındaki `Role` enum'uyla birebir aynı adları taşır.
 */

export type ServerRole =
  | "WORKSPACE_OWNER"
  | "COMPANY_ADMIN"
  | "DATA_CONTRIBUTOR"
  | "DATA_OWNER"
  | "NARRATIVE_WRITER"
  | "EXTERNAL_AUDITOR";

export type Action =
  | "org:create"
  | "member:assign"
  | "period:open"
  | "task:submit"
  | "task:approve"
  | "task:return"
  | "narrative:write"
  | "audit:seal"
  | "audit:read";

const MATRIX: Record<Action, ServerRole[]> = {
  "org:create": ["WORKSPACE_OWNER"],
  "member:assign": ["WORKSPACE_OWNER", "COMPANY_ADMIN"],
  "period:open": ["COMPANY_ADMIN"],
  "task:submit": ["DATA_CONTRIBUTOR"],
  "task:approve": ["DATA_OWNER"],
  "task:return": ["DATA_OWNER"],
  "narrative:write": ["NARRATIVE_WRITER"],
  "audit:seal": ["EXTERNAL_AUDITOR"],
  "audit:read": ["WORKSPACE_OWNER", "COMPANY_ADMIN", "DATA_OWNER", "EXTERNAL_AUDITOR"],
};

/** Bu rol bu eylemi yapabilir mi? */
export function can(role: ServerRole, action: Action): boolean {
  return MATRIX[action].includes(role);
}

/** Denetçi salt-okunur ilkesi: yazma eylemlerinin hiçbirini yapamaz. */
export function isReadOnly(role: ServerRole): boolean {
  return role === "EXTERNAL_AUDITOR";
}
