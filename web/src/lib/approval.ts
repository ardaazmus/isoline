/**
 * Approval and period lock (reporting workflow step 4, docs/DENETIM_RAPORLAMA_2026-10.md §2.2–2.3).
 * Each tool section of a client moves draft → review → approved (locked) → published. The preparer cannot
 * approve their own work (segregation of duties), sending back and reopening need a reason, and every move is
 * appended to a log that is never rewritten. Approved and published sections are locked: the store refuses
 * changes to their data until they are reopened. v1 has no accounts, so people are typed names.
 */
import type { ClientData } from "@/data/sample";

export type ApprovalStatus = "draft" | "review" | "approved" | "published";
export const APPROVAL_STATUSES: ApprovalStatus[] = ["draft", "review", "approved", "published"];

export type ApprovalEvent = { at: string; by: string; from: ApprovalStatus; to: ApprovalStatus; reason?: string };

export type Approval = {
  status: ApprovalStatus;
  preparedBy: string;
  approvedBy: string;
  approvedAt: string | null;
  /** Append-only history of status changes, oldest first. */
  log: ApprovalEvent[];
};

/** Where a section's data lives in ClientData; `parts` narrows a shared key (indicators) to the section's own fields. */
type SectionDef = { key: keyof ClientData; parts?: string[] };

export const SECTIONS = {
  ghg: { key: "ghg" },
  cbam: { key: "cbam" },
  ets: { key: "ets" },
  pathway: { key: "pathway" },
  materiality: { key: "materiality" },
  environment: { key: "indicators", parts: ["env"] },
  workforce: { key: "indicators", parts: ["safety", "workforce"] },
  taxonomy: { key: "taxonomy" },
  trialBalance: { key: "trialBalance" },
  reconciliation: { key: "reconciliation" },
  claims: { key: "claims" },
} as const satisfies Record<string, SectionDef>;

export type SectionId = keyof typeof SECTIONS;
export const SECTION_IDS = Object.keys(SECTIONS) as SectionId[];

export type Approvals = Partial<Record<SectionId, Approval>>;

export const emptyApproval = (): Approval => ({ status: "draft", preparedBy: "", approvedBy: "", approvedAt: null, log: [] });

export function approvalOf(approvals: Approvals | undefined, section: SectionId): Approval {
  return approvals?.[section] ?? emptyApproval();
}

export const isLocked = (a: Pick<Approval, "status">) => a.status === "approved" || a.status === "published";

/** The same person, whatever the spacing or case of the typed name. */
export const samePerson = (a: string, b: string) => a.trim().toLocaleLowerCase("tr") === b.trim().toLocaleLowerCase("tr");

export type ApprovalAction = "submit" | "sendBack" | "approve" | "publish" | "reopen";

/** Allowed moves: action → [from statuses, to status]. */
export const MOVES: Record<ApprovalAction, [ApprovalStatus[], ApprovalStatus]> = {
  submit: [["draft"], "review"],
  sendBack: [["review"], "draft"],
  approve: [["review"], "approved"],
  publish: [["approved"], "published"],
  reopen: [["approved", "published"], "draft"],
};

export type ApprovalError = "badMove" | "needName" | "samePerson" | "needReason";
export type ApprovalResult = { ok: true; next: Approval } | { ok: false; error: ApprovalError };

/**
 * Applies an action by `by` at `at` (ISO time). Rules: a name is always needed; the approver must differ from
 * the preparer; sending back and reopening need a reason. Reopening clears the current approval, the log keeps it.
 */
export function act(a: Approval, action: ApprovalAction, by: string, at: string, reason = ""): ApprovalResult {
  const [from, to] = MOVES[action];
  if (!from.includes(a.status)) return { ok: false, error: "badMove" };
  if (!by.trim()) return { ok: false, error: "needName" };
  if ((action === "sendBack" || action === "reopen") && !reason.trim()) return { ok: false, error: "needReason" };
  if (action === "approve" && samePerson(by, a.preparedBy)) return { ok: false, error: "samePerson" };
  const event: ApprovalEvent = { at, by: by.trim(), from: a.status, to, ...(reason.trim() ? { reason: reason.trim() } : {}) };
  const next: Approval = { ...a, status: to, log: [...a.log, event] };
  if (action === "submit") next.preparedBy = by.trim();
  if (action === "approve") {
    next.approvedBy = by.trim();
    next.approvedAt = at;
  }
  if (action === "reopen") {
    next.approvedBy = "";
    next.approvedAt = null;
  }
  return { ok: true, next };
}

/** Actions open from a status, in the order the screen offers them. */
export function availableActions(status: ApprovalStatus): ApprovalAction[] {
  return (Object.keys(MOVES) as ApprovalAction[]).filter((k) => MOVES[k][0].includes(status));
}

/** Sections a report draws on: the tool ids of its sections that are approval sections, in order, once each. */
export function sectionsOf(toolIds: readonly string[]): SectionId[] {
  return [...new Set(toolIds)].filter((x): x is SectionId => x in SECTIONS);
}

/** True when every given section is approved or published, i.e. the report quotes only locked data. */
export function allLocked(approvals: Approvals | undefined, sections: readonly SectionId[]): boolean {
  return sections.every((s) => isLocked(approvalOf(approvals, s)));
}

const same = (x: unknown, y: unknown) => x === y || JSON.stringify(x) === JSON.stringify(y);

/**
 * The locked section a change to `client[key]` would touch, or null if the change is allowed. A shared key
 * (indicators) is only refused for the parts that belong to a locked section.
 */
export function lockedBy(client: ClientData, key: keyof ClientData, value: unknown): SectionId | null {
  const approvals = client.approvals;
  for (const id of SECTION_IDS) {
    const def: SectionDef = SECTIONS[id];
    if (def.key !== key || !isLocked(approvalOf(approvals, id))) continue;
    const cur = client[key] as Record<string, unknown> | null;
    const nxt = value as Record<string, unknown> | null;
    if (!def.parts) {
      if (!same(cur, nxt)) return id;
    } else if (def.parts.some((p) => !same(cur?.[p], nxt?.[p]))) return id;
  }
  return null;
}
