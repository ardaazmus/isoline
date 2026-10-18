/**
 * Auditor workspace (Faz 4, docs/HEDEF_MIMARI.md §5.2 and §6).
 * The external auditor is read-only on tool data: they add notes and evidence
 * requests, never edits. Notes stay writable while tool sections are locked.
 * v1 has no accounts, so people are typed names. Pure: same input, same output.
 */
import type { SectionId } from "./approval";

export type AuditTargetType = "section" | "item";
export type AuditNoteStatus = "open" | "answered" | "closed";

export type AuditorNote = {
  id: string;
  targetType: AuditTargetType;
  /** SectionId for a section note, DATA_POINTS id for an item note. */
  targetId: string;
  author: string;
  body: string;
  createdAt: string;
  status: AuditNoteStatus;
  reply?: string;
  repliedBy?: string;
  repliedAt?: string;
};

export type EvidenceRequestStatus = "open" | "fulfilled" | "waived";

export type EvidenceRequest = {
  id: string;
  /** DATA_POINTS id or SectionId the auditor asks evidence for. */
  targetId: string;
  requestedBy: string;
  requestedAt: string;
  note: string;
  status: EvidenceRequestStatus;
};

export type AuditState = { notes: AuditorNote[]; requests: EvidenceRequest[] };

export const emptyAudit = (): AuditState => ({ notes: [], requests: [] });

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null;

const NOTE_STATUSES: AuditNoteStatus[] = ["open", "answered", "closed"];
const REQ_STATUSES: EvidenceRequestStatus[] = ["open", "fulfilled", "waived"];

/** Repair a stored/hand-edited audit state field by field so it cannot break the screen. */
export function asAudit(x: unknown): AuditState {
  if (!isRecord(x)) return emptyAudit();
  const notes = Array.isArray(x.notes) ? x.notes.flatMap((n) => (isRecord(n) && typeof n.id === "string" && typeof n.body === "string" ? [cleanNote(n)] : [])) : [];
  const requests = Array.isArray(x.requests) ? x.requests.flatMap((r) => (isRecord(r) && typeof r.id === "string" && typeof r.targetId === "string" ? [cleanRequest(r)] : [])) : [];
  return { notes, requests };
}

function cleanNote(n: Record<string, unknown>): AuditorNote {
  return {
    id: String(n.id),
    targetType: n.targetType === "item" ? "item" : "section",
    targetId: String(n.targetId ?? ""),
    author: String(n.author ?? ""),
    body: String(n.body ?? "").replace(/\s+/g, " ").trim().slice(0, 2000),
    createdAt: String(n.createdAt ?? ""),
    status: NOTE_STATUSES.includes(n.status as AuditNoteStatus) ? (n.status as AuditNoteStatus) : "open",
    ...(typeof n.reply === "string" && n.reply ? { reply: n.reply.replace(/\s+/g, " ").trim().slice(0, 2000) } : {}),
    ...(typeof n.repliedBy === "string" && n.repliedBy ? { repliedBy: String(n.repliedBy).slice(0, 120) } : {}),
    ...(typeof n.repliedAt === "string" && n.repliedAt ? { repliedAt: String(n.repliedAt) } : {}),
  };
}

function cleanRequest(r: Record<string, unknown>): EvidenceRequest {
  return {
    id: String(r.id),
    targetId: String(r.targetId ?? ""),
    requestedBy: String(r.requestedBy ?? ""),
    requestedAt: String(r.requestedAt ?? ""),
    note: String(r.note ?? "").replace(/\s+/g, " ").trim().slice(0, 2000),
    status: REQ_STATUSES.includes(r.status as EvidenceRequestStatus) ? (r.status as EvidenceRequestStatus) : "open",
  };
}

export const newAuditId = () =>
  `a-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** Adds an auditor note; empty body or author is refused. */
export function addNote(
  s: AuditState,
  n: { targetType: AuditTargetType; targetId: string; author: string; body: string; at: string; id?: string },
): { next: AuditState } | { error: "needName" | "needBody" | "needTarget" } {
  if (!n.author.trim()) return { error: "needName" };
  if (!n.body.trim()) return { error: "needBody" };
  if (!n.targetId.trim()) return { error: "needTarget" };
  const note: AuditorNote = {
    id: n.id ?? newAuditId(),
    targetType: n.targetType,
    targetId: n.targetId.trim(),
    author: n.author.trim().slice(0, 120),
    body: n.body.replace(/\s+/g, " ").trim().slice(0, 2000),
    createdAt: n.at,
    status: "open",
  };
  return { next: { ...s, notes: [...s.notes, note] } };
}

/** The preparer answers a note; answering an answered note replaces the reply. */
export function answerNote(
  s: AuditState,
  id: string,
  reply: { by: string; body: string; at: string },
): { next: AuditState } | { error: "notFound" | "needName" | "needBody" } {
  if (!reply.by.trim()) return { error: "needName" };
  if (!reply.body.trim()) return { error: "needBody" };
  let found = false;
  const notes = s.notes.map((x) => {
    if (x.id !== id) return x;
    found = true;
    return { ...x, status: "answered" as const, reply: reply.body.replace(/\s+/g, " ").trim().slice(0, 2000), repliedBy: reply.by.trim().slice(0, 120), repliedAt: reply.at };
  });
  if (!found) return { error: "notFound" };
  return { next: { ...s, notes } };
}

/** Closes or reopens a note. */
export function setNoteStatus(s: AuditState, id: string, status: AuditNoteStatus): { next: AuditState } | { error: "notFound" } {
  let found = false;
  const notes = s.notes.map((x) => (x.id === id ? ((found = true), { ...x, status }) : x));
  if (!found) return { error: "notFound" };
  return { next: { ...s, notes } };
}

/** Asks for evidence on an item or section. */
export function addEvidenceRequest(
  s: AuditState,
  r: { targetId: string; requestedBy: string; note: string; at: string; id?: string },
): { next: AuditState } | { error: "needName" | "needTarget" } {
  if (!r.requestedBy.trim()) return { error: "needName" };
  if (!r.targetId.trim()) return { error: "needTarget" };
  const req: EvidenceRequest = {
    id: r.id ?? newAuditId(),
    targetId: r.targetId.trim(),
    requestedBy: r.requestedBy.trim().slice(0, 120),
    requestedAt: r.at,
    note: r.note.replace(/\s+/g, " ").trim().slice(0, 2000),
    status: "open",
  };
  return { next: { ...s, requests: [...s.requests, req] } };
}

/** Marks an evidence request fulfilled or waived (with a reason in note), or reopens it. */
export function setEvidenceRequestStatus(
  s: AuditState,
  id: string,
  status: EvidenceRequestStatus,
): { next: AuditState } | { error: "notFound" } {
  let found = false;
  const requests = s.requests.map((x) => (x.id === id ? ((found = true), { ...x, status }) : x));
  if (!found) return { error: "notFound" };
  return { next: { ...s, requests } };
}

/** Notes for one target, oldest first. */
export function notesFor(s: AuditState, targetId: string): AuditorNote[] {
  return s.notes.filter((n) => n.targetId === targetId);
}

/** Open counts for the auditor badge: open notes + open evidence requests. */
export function openAuditCounts(s: AuditState): { notes: number; requests: number } {
  return { notes: s.notes.filter((n) => n.status === "open").length, requests: s.requests.filter((r) => r.status === "open").length };
}

export type { SectionId };
