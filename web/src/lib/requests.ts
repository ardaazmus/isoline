/**
 * Data request list (reporting workflow steps 1–2, docs/DENETIM_RAPORLAMA_2026-10.md §2.1 and §4 item 2).
 * The reports a client produces decide which data it must supply; each data item names the approval section
 * that owns it, the role that usually holds it, the source document to ask for, its unit and period.
 *
 * Nothing here adds a requirement: an item enters the list only when a section of a chosen template draws on
 * its tool (`TemplateSection.tools`), narrowed by the data points the section names (`points`) and by the
 * framework's crosswalk column ("—" = no counterpart). Every item carries those template sections and their
 * references as its trace. Tracking (owner, due date, status, note, and the source document of a hand-entered
 * value) is stored per client; a locked (approved) section freezes its items like the rest of its data.
 */
import type { ClientData } from "@/data/sample";
import { CROSSWALK } from "@/data/crosswalk";
import { TEMPLATES, type Template, type TemplateSection } from "@/data/templates";
import type { Finding, Profile } from "./calc/applicability";
import { approvalOf, isLocked, SECTION_IDS, type Approvals, type SectionId } from "./approval";
import { csvUnsafe } from "./export";
import { lastImport, readFirstSheet, type FileRead, type ImportRecord, type ImportTool } from "./imports";

export const ROLES = ["finance", "hr", "ohs", "production", "sustainability"] as const;
export type Role = (typeof ROLES)[number];

/** Which year a figure covers: the reporting year, the year before, the pathway's base year, the base year up to now, or now up to the target year. */
export type PeriodKind = "year" | "prior" | "base" | "history" | "plan";

export type DataPoint = {
  id: string;
  /** Owning approval section: its lock freezes the item. */
  section: SectionId;
  /** Other sections that use the same figure (net sales feeds intensity, environment and reconciliation). */
  feeds?: SectionId[];
  role: Role;
  /** Unit key, req.units.<unit>. */
  unit: string;
  when: PeriodKind;
  /** Crosswalk row the item belongs to, if any. */
  cw?: string;
  /** Where the value lands in the client data (dot path), for the trace and the tests. */
  input: string;
  /** File import whose evidence record an accepted item links to. */
  importTool?: ImportTool;
  /** Personal or health data (KVKK md. 6): ask for totals only. */
  sensitive?: boolean;
};

/**
 * The data points behind the tool inputs, in section order. Labels and source documents live in messages
 * under req.items.<id> and req.docs.<id>.
 */
export const DATA_POINTS: DataPoint[] = [
  { id: "ghg_stationary", section: "ghg", role: "production", unit: "byFuel", when: "year", cw: "scope1", input: "ghg.fuels", importTool: "ghg" },
  { id: "ghg_mobile", section: "ghg", role: "finance", unit: "litre", when: "year", cw: "scope1", input: "ghg.fuels", importTool: "ghg" },
  { id: "ghg_process", section: "ghg", role: "production", unit: "t", when: "year", cw: "scope1", input: "ghg.process", importTool: "ghg" },
  { id: "ghg_refrigerants", section: "ghg", role: "production", unit: "kg", when: "year", cw: "scope1", input: "ghg.refrigerants", importTool: "ghg" },
  { id: "ghg_electricity", section: "ghg", role: "finance", unit: "mwh", when: "year", cw: "scope2", input: "ghg.electricity", importTool: "ghg" },
  { id: "ghg_certificates", section: "ghg", role: "sustainability", unit: "mwh", when: "year", cw: "scope2", input: "ghg.electricity", importTool: "ghg" },
  { id: "ghg_purchases", section: "ghg", role: "finance", unit: "tOrTry", when: "year", cw: "scope3", input: "ghg.scope3", importTool: "ghg" },
  { id: "ghg_transport", section: "ghg", role: "production", unit: "tkm", when: "year", cw: "scope3", input: "ghg.scope3", importTool: "ghg" },
  { id: "ghg_travel", section: "ghg", role: "hr", unit: "pkm", when: "year", cw: "scope3", input: "ghg.scope3", importTool: "ghg" },
  { id: "ghg_production", section: "ghg", role: "production", unit: "t", when: "year", cw: "intensity", input: "ghg.productionTonnes" },
  { id: "net_sales", section: "ghg", feeds: ["environment", "reconciliation"], role: "finance", unit: "mTry", when: "year", cw: "intensity", input: "ghg.revenueMillionTry" },
  { id: "cbam_goods", section: "cbam", role: "finance", unit: "t", when: "year", cw: "transition_risk_amounts", input: "cbam.products" },
  { id: "cbam_see", section: "cbam", role: "production", unit: "tco2ePerT", when: "year", cw: "transition_risk_amounts", input: "cbam.products" },
  { id: "cbam_price_paid", section: "cbam", role: "finance", unit: "eurPerT", when: "year", input: "cbam.scenario.originCarbonPrice" },
  { id: "ets_emissions", section: "ets", role: "sustainability", unit: "tco2e", when: "year", input: "ets.emissions" },
  { id: "ets_activity", section: "ets", role: "production", unit: "t", when: "year", input: "ets.activity" },
  { id: "pathway_base", section: "pathway", role: "sustainability", unit: "tco2e", when: "base", cw: "targets", input: "pathway.baseScope12" },
  { id: "pathway_actuals", section: "pathway", role: "sustainability", unit: "tco2e", when: "history", cw: "targets", input: "pathway.actuals" },
  { id: "pathway_measures", section: "pathway", role: "production", unit: "tco2ePerYr", when: "plan", cw: "transition_plan", input: "pathway.measures" },
  { id: "pathway_target", section: "pathway", role: "sustainability", unit: "yearPct", when: "plan", cw: "targets", input: "pathway.targetYear" },
  { id: "mat_stakeholders", section: "materiality", role: "sustainability", unit: "score", when: "year", cw: "risks_opps", input: "materiality.topics" },
  { id: "mat_risks", section: "materiality", role: "finance", unit: "score", when: "year", cw: "risks_opps", input: "materiality.topics" },
  { id: "env_energy", section: "environment", role: "production", unit: "gj", when: "year", cw: "energy", input: "indicators.env.energyGj", importTool: "indicators" },
  { id: "env_renewable", section: "environment", role: "production", unit: "gj", when: "year", cw: "energy", input: "indicators.env.renewableGj", importTool: "indicators" },
  { id: "env_water_withdrawal", section: "environment", role: "production", unit: "m3", when: "year", cw: "water", input: "indicators.env.waterWithdrawalM3", importTool: "indicators" },
  { id: "env_water_discharge", section: "environment", role: "production", unit: "m3", when: "year", cw: "water", input: "indicators.env.waterDischargeM3", importTool: "indicators" },
  { id: "env_water_stress", section: "environment", role: "sustainability", unit: "percent", when: "year", cw: "water", input: "indicators.env.waterStressShare", importTool: "indicators" },
  { id: "env_waste", section: "environment", role: "production", unit: "t", when: "year", cw: "waste", input: "indicators.env.wasteTotalT", importTool: "indicators" },
  { id: "work_headcount", section: "workforce", feeds: ["reconciliation"], role: "hr", unit: "persons", when: "year", input: "indicators.workforce.headcountEnd", importTool: "indicators" },
  { id: "work_diversity", section: "workforce", role: "hr", unit: "persons", when: "year", input: "indicators.workforce.women", importTool: "indicators", sensitive: true },
  { id: "work_pay", section: "workforce", role: "hr", unit: "try", when: "year", cw: "pay_gap", input: "indicators.workforce.avgPayWomen", importTool: "indicators", sensitive: true },
  { id: "work_training", section: "workforce", role: "hr", unit: "hours", when: "year", cw: "training", input: "indicators.workforce.trainingHours", importTool: "indicators" },
  { id: "ohs_hours", section: "workforce", role: "ohs", unit: "hours", when: "year", cw: "health_safety", input: "indicators.safety.hoursWorked", importTool: "indicators" },
  { id: "ohs_incidents", section: "workforce", role: "ohs", unit: "cases", when: "year", cw: "health_safety", input: "indicators.safety.lostTimeInjuries", importTool: "indicators", sensitive: true },
  { id: "tax_totals", section: "taxonomy", role: "finance", unit: "mTry", when: "year", cw: "taxonomy", input: "taxonomy.totals" },
  { id: "tax_activities", section: "taxonomy", role: "finance", unit: "mTry", when: "year", cw: "taxonomy", input: "taxonomy.activities" },
  { id: "tax_screening", section: "taxonomy", role: "sustainability", unit: "evidence", when: "year", cw: "taxonomy", input: "taxonomy.activities" },
  { id: "tb_export", section: "trialBalance", role: "finance", unit: "try", when: "year", input: "trialBalance", importTool: "trialBalance" },
  { id: "rec_prior", section: "reconciliation", role: "sustainability", unit: "various", when: "prior", input: "reconciliation.prior" },
];

const POINT = new Map(DATA_POINTS.map((d) => [d.id, d]));
const CW = new Map(CROSSWALK.map((r) => [r.id, r]));

export const dataPoint = (id: string): DataPoint | undefined => POINT.get(id);

export type RequestTrace = { template: string; section: string; refs: string[] };
export type RequestItem = DataPoint & { period: string; traces: RequestTrace[] };

/** Whether a template section draws on a data point (see the module note for the three rules). */
export function sectionNeeds(tp: Template, sec: TemplateSection, dp: DataPoint): boolean {
  const tools = sec.tools ?? [];
  if (![dp.section, ...(dp.feeds ?? [])].some((s) => tools.includes(s))) return false;
  if (sec.points && !(dp.cw && sec.points.includes(dp.cw))) return false;
  if (tp.crosswalk && dp.cw && CW.get(dp.cw)?.[tp.crosswalk] === "—") return false;
  return true;
}

export function periodOf(c: Pick<ClientData, "profile" | "pathway">, when: PeriodKind): string {
  const y = c.profile.reportingYear;
  const span = (a: number, b: number) => (a < b ? `${a}–${b}` : String(b));
  switch (when) {
    case "year":
      return String(y);
    case "prior":
      return String(y - 1);
    case "base":
      return String(c.pathway.baseYear);
    case "history":
      return span(c.pathway.baseYear, y);
    case "plan":
      return span(y, c.pathway.targetYear);
  }
}

/**
 * The data items the chosen templates need, in section order, each with the template sections that ask for
 * it. Pure: the same client and the same set of templates (in any order) give the same list.
 */
export function generateRequests(c: Pick<ClientData, "profile" | "pathway">, templateIds: readonly string[]): RequestItem[] {
  const chosen = TEMPLATES.filter((tp) => templateIds.includes(tp.id));
  return DATA_POINTS.flatMap((dp) => {
    const traces = chosen.flatMap((tp) => tp.sections.filter((s) => sectionNeeds(tp, s, dp)).map((s) => ({ template: tp.id, section: s.id, refs: s.refs })));
    return traces.length ? [{ ...dp, period: periodOf(c, dp.when), traces }] : [];
  });
}

/**
 * Templates the applicability result points to, with the finding behind each: a required annual report
 * (listed companies take the SPK template), required TSRS, a required TR ETS obligation, CBAM exposure, and
 * CSRD (ESRS when in scope, the voluntary standard when only the value-chain cap applies).
 */
export function suggestTemplates(findings: Finding[], profile: Pick<Profile, "entityType">): { template: string; finding: string }[] {
  const out: { template: string; finding: string }[] = [];
  for (const f of findings) {
    const required = f.status === "required";
    if (f.id === "annual_report" && required) out.push({ template: profile.entityType === "listed" ? "ar_listed" : "ar_ttk", finding: f.id });
    if (f.id === "tsrs" && required) out.push({ template: "tsrs_full", finding: f.id });
    if (f.id === "tr_ets" && required) out.push({ template: "tr_ets_mp", finding: f.id });
    if (f.id === "cbam" && (required || f.status === "indirect")) out.push({ template: "cbam_operator_pack", finding: f.id });
    if (f.id === "csrd" && required) out.push({ template: "esrs_2026", finding: f.id });
    if (f.id === "csrd" && f.status === "indirect") out.push({ template: "vss", finding: f.id });
  }
  const order = TEMPLATES.map((t) => t.id);
  return out.filter((x, i) => out.findIndex((y) => y.template === x.template) === i).sort((a, b) => order.indexOf(a.template) - order.indexOf(b.template));
}

// ── Tracking ──────────────────────────────────────────────────────────────────────────────────────────

export const REQUEST_STATUSES = ["todo", "requested", "received", "accepted"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

/** The import record an accepted item was checked against: file, hash and time, copied at acceptance. */
export type RequestEvidence = { fileName: string; sha256: string; importedAt: string };

/**
 * The document a hand-entered value comes from (workflow step 2: "elle girişte belge notu"): its name or
 * reference and its date. A file import carries its own evidence (file, SHA-256); this is the record for
 * everything typed in.
 */
export type SourceNote = { doc: string; date: string };

export type RequestTrack = { owner: string; due: string; status: RequestStatus; note: string; source?: SourceNote; acceptedAt?: string; evidence?: RequestEvidence };

export type Requests = {
  /** Templates the user picked; null follows the applicability suggestion. */
  templates: string[] | null;
  /** Tracking per data point id; an untouched item has no entry. */
  items: Record<string, RequestTrack>;
};

export const emptyRequests = (): Requests => ({ templates: null, items: {} });
export const emptyTrack = (): RequestTrack => ({ owner: "", due: "", status: "todo", note: "" });

export function trackOf(r: Requests | undefined, id: string): RequestTrack {
  return r?.items?.[id] ?? emptyTrack();
}

export const OWNER_MAX = 120;
export const NOTE_MAX = 500;
export const DOC_MAX = 200;

/** One line of text: runs of whitespace (line breaks included) become one space; capped. */
export function cleanText(s: string, max: number): string {
  return s.replace(/\s+/g, " ").trim().slice(0, max).trim();
}

/** A real calendar day written YYYY-MM-DD. */
export function isDay(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

const isEmptyTrack = (t: RequestTrack) => !t.owner && !t.due && t.status === "todo" && !t.note && !t.source;

/** Backed by a document: a linked file import or a source note naming the document. */
export const hasEvidence = (t: RequestTrack) => !!t.evidence || !!t.source?.doc;

export type TrackPatch = Partial<Pick<RequestTrack, "owner" | "due" | "status" | "note">> & { sourceDoc?: string; sourceDate?: string };

/**
 * Applies a change to one item. Accepting an item records the time and, when its tool has a file import,
 * links the latest import record as its evidence; leaving "accepted" drops both. Text is cleaned and an
 * invalid due date is cleared.
 */
export function setTrack(req: Requests, dp: Pick<DataPoint, "id" | "importTool">, patch: TrackPatch, importLog: ImportRecord[] | undefined, at: string): Requests {
  const prev = trackOf(req, dp.id);
  const next: RequestTrack = {
    owner: patch.owner !== undefined ? cleanText(patch.owner, OWNER_MAX) : prev.owner,
    due: patch.due !== undefined ? (isDay(patch.due) ? patch.due : "") : prev.due,
    status: patch.status ?? prev.status,
    note: patch.note !== undefined ? cleanText(patch.note, NOTE_MAX) : prev.note,
  };
  const doc = patch.sourceDoc !== undefined ? cleanText(patch.sourceDoc, DOC_MAX) : (prev.source?.doc ?? "");
  const date = patch.sourceDate !== undefined ? (isDay(patch.sourceDate) ? patch.sourceDate : "") : (prev.source?.date ?? "");
  if (doc || date) next.source = { doc, date };
  if (next.status === "accepted") {
    if (prev.status === "accepted") {
      if (prev.acceptedAt) next.acceptedAt = prev.acceptedAt;
      if (prev.evidence) next.evidence = prev.evidence;
    } else {
      next.acceptedAt = at;
      const rec = dp.importTool ? lastImport(importLog, dp.importTool) : undefined;
      if (rec) next.evidence = { fileName: rec.fileName, sha256: rec.sha256, importedAt: rec.importedAt };
    }
  }
  const items = { ...req.items };
  if (isEmptyTrack(next)) delete items[dp.id];
  else items[dp.id] = next;
  return { ...req, items };
}

/** True when the item's owning section is approved or published. */
export function itemLocked(approvals: Approvals | undefined, dp: Pick<DataPoint, "section">): boolean {
  return isLocked(approvalOf(approvals, dp.section));
}

/** Field by field, so tracking read from storage and tracking just built compare equal whatever their key order. */
const canon = (t: RequestTrack | undefined) =>
  t ? [t.owner, t.due, t.status, t.note, t.source?.doc, t.source?.date, t.acceptedAt, t.evidence?.fileName, t.evidence?.sha256, t.evidence?.importedAt] : null;
const sameTrack = (a: RequestTrack | undefined, b: RequestTrack | undefined) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));

/** The locked section a change to the request tracking would touch, or null if the change is allowed. */
export function requestsLockedBy(c: Pick<ClientData, "approvals"> & { requests?: Requests }, next: Requests): SectionId | null {
  const cur = c.requests?.items ?? {};
  const nxt = next?.items ?? {};
  for (const id of new Set([...Object.keys(cur), ...Object.keys(nxt)])) {
    if (sameTrack(cur[id], nxt[id])) continue;
    const dp = POINT.get(id);
    if (dp && itemLocked(c.approvals, dp)) return dp.section;
  }
  return null;
}

/** Overdue: past its due date and not yet delivered. */
export function isOverdue(t: RequestTrack, today: string | null): boolean {
  return !!today && !!t.due && t.due < today && (t.status === "todo" || t.status === "requested");
}

export type SectionProgress = { section: SectionId; total: number; counts: Record<RequestStatus, number>; overdue: number; evidenced: number; locked: boolean };

/** Item counts by status per section, in section order; sections with no items are left out. */
export function sectionProgress(items: RequestItem[], req: Requests, approvals: Approvals | undefined, today: string | null): SectionProgress[] {
  return SECTION_IDS.flatMap((section) => {
    const own = items.filter((i) => i.section === section);
    if (!own.length) return [];
    const counts = Object.fromEntries(REQUEST_STATUSES.map((s) => [s, 0])) as Record<RequestStatus, number>;
    let overdue = 0;
    let evidenced = 0;
    for (const i of own) {
      const t = trackOf(req, i.id);
      counts[t.status]++;
      if (isOverdue(t, today)) overdue++;
      if (hasEvidence(t)) evidenced++;
    }
    return [{ section, total: own.length, counts, overdue, evidenced, locked: isLocked(approvalOf(approvals, section)) }];
  });
}

/**
 * Fills empty owners from a name per role and empty due dates from one date, for the given items; locked
 * sections are skipped. Returns the new tracking and how many items changed.
 */
export function assignByRole(
  req: Requests,
  items: RequestItem[],
  owners: Partial<Record<Role, string>>,
  due: string,
  approvals: Approvals | undefined,
  importLog: ImportRecord[] | undefined,
  at: string,
): { next: Requests; changed: number } {
  let next = req;
  let changed = 0;
  for (const i of items) {
    if (itemLocked(approvals, i)) continue;
    const t = trackOf(next, i.id);
    const patch: TrackPatch = {};
    const name = cleanText(owners[i.role] ?? "", OWNER_MAX);
    if (!t.owner && name) patch.owner = name;
    if (!t.due && isDay(due)) patch.due = due;
    if (!Object.keys(patch).length) continue;
    next = setTrack(next, i, patch, importLog, at);
    changed++;
  }
  return { next, changed };
}

/** Marks the given items that are not yet sent as requested (after the list went out); locked sections are skipped. */
export function markRequested(req: Requests, items: RequestItem[], approvals: Approvals | undefined, importLog: ImportRecord[] | undefined, at: string): { next: Requests; changed: number } {
  let next = req;
  let changed = 0;
  for (const i of items) {
    if (itemLocked(approvals, i) || trackOf(next, i.id).status !== "todo") continue;
    next = setTrack(next, i, { status: "requested" }, importLog, at);
    changed++;
  }
  return { next, changed };
}

// ── File exchange (CSV and Excel) ─────────────────────────────────────────────────────────────────────

export const REQUEST_COLUMNS = ["id", "section", "item", "role", "document", "unit", "period", "owner", "due", "status", "note", "sourceDoc", "sourceDate"] as const;
export type RequestColumn = (typeof REQUEST_COLUMNS)[number];
export type FileLang = "tr" | "en";

/** File headers and status words. They live here, not in messages, because the importer must read them back. */
export const FILE_TEXT: Record<FileLang, { headers: Record<RequestColumn, string>; statuses: Record<RequestStatus, string> }> = {
  tr: {
    headers: { id: "Kod", section: "Bölüm", item: "Veri kalemi", role: "Sorumlu birim", document: "Kaynak belge", unit: "Birim", period: "Dönem", owner: "Sorumlu kişi", due: "Son tarih", status: "Durum", note: "Not", sourceDoc: "Teslim edilen belge", sourceDate: "Belge tarihi" },
    statuses: { todo: "Gönderilmedi", requested: "Talep edildi", received: "Teslim alındı", accepted: "Kabul edildi" },
  },
  en: {
    headers: { id: "Code", section: "Section", item: "Data item", role: "Owner role", document: "Source document", unit: "Unit", period: "Period", owner: "Owner", due: "Due date", status: "Status", note: "Note", sourceDoc: "Document provided", sourceDate: "Document date" },
    statuses: { todo: "Not sent", requested: "Requested", received: "Received", accepted: "Accepted" },
  },
};

/** Case- and spacing-blind; Turkish dotless ı is folded so "ID" and "TESLIM ALINDI" typed on any keyboard match. */
const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLocaleLowerCase("tr").replace(/ı/g, "i");

const HEADER_ALIASES = new Map<string, RequestColumn>(
  REQUEST_COLUMNS.flatMap((col) => [col, FILE_TEXT.tr.headers[col], FILE_TEXT.en.headers[col]].map((a) => [norm(a), col] as [string, RequestColumn])),
);
const STATUS_ALIASES = new Map<string, RequestStatus>(
  REQUEST_STATUSES.flatMap((s) => [s, FILE_TEXT.tr.statuses[s], FILE_TEXT.en.statuses[s]].map((a) => [norm(a), s] as [string, RequestStatus])),
);

export type ItemText = { section: string; item: string; role: string; document: string; unit: string };

/** Header and one row per item, ready for toCsv or xlsxWorkbook; the due date is written YYYY-MM-DD. */
export function requestTable(items: RequestItem[], req: Requests, lang: FileLang, text: (i: RequestItem) => ItemText): string[][] {
  const ft = FILE_TEXT[lang];
  return [
    REQUEST_COLUMNS.map((c) => ft.headers[c]),
    ...items.map((i) => {
      const t = trackOf(req, i.id);
      const x = text(i);
      return [i.id, x.section, x.item, x.role, x.document, x.unit, i.period, t.owner, t.due, ft.statuses[t.status], t.note, t.source?.doc ?? "", t.source?.date ?? ""];
    }),
  ];
}

/** Days from 1899-12-30, the spreadsheet date origin. */
function serialDay(n: number): string {
  const d = new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86_400_000);
  return d.toISOString().slice(0, 10);
}

/**
 * Reads a due date as typed in a sheet: YYYY-MM-DD (time part ignored), DD.MM.YYYY or DD/MM/YYYY, or a
 * spreadsheet date serial. Empty is "no date"; anything else is null.
 */
export function parseDue(raw: string): string | null {
  const s = raw.trim();
  if (!s) return "";
  const iso = /^(\d{4}-\d{2}-\d{2})(?:[T ][\d:.]+Z?)?$/.exec(s);
  if (iso) return isDay(iso[1]) ? iso[1] : null;
  const tr = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(s);
  if (tr) {
    const day = `${tr[3]}-${tr[2].padStart(2, "0")}-${tr[1].padStart(2, "0")}`;
    return isDay(day) ? day : null;
  }
  if (/^\d{4,6}(?:\.\d+)?$/.test(s)) {
    const n = Number(s);
    if (n >= 20_000 && n <= 120_000) return serialDay(Math.floor(n));
  }
  return null;
}

export type RequestRow = { row: number; id: string } & TrackPatch;
export type RequestFileIssue = {
  row: number;
  key: "missingColumns" | "empty" | "missingId" | "badStatus" | "badDate" | "badDocDate" | "duplicate" | "unknownId" | "locked";
  vars?: Record<string, string | number>;
};
export type RequestFile = { rows: RequestRow[]; issues: RequestFileIssue[]; read: number };

/**
 * Rows of a filled request list. The header may sit below title rows and may be Turkish, English or the
 * column codes; only the code column is required, and only the tracking columns present are read. A cell
 * of a column that is present is the new value, empty included. `csv` undoes the formula escaping this app
 * writes into CSV files.
 */
export function parseRequestRows(grid: string[][], opts: { csv?: boolean } = {}): RequestFile {
  const out: RequestFile = { rows: [], issues: [], read: 0 };
  if (!grid.length) {
    out.issues.push({ row: 0, key: "empty" });
    return out;
  }
  const h = grid.slice(0, 10).findIndex((r) => r.some((c) => HEADER_ALIASES.get(norm(c)) === "id"));
  if (h < 0) {
    out.issues.push({ row: 1, key: "missingColumns", vars: { cols: FILE_TEXT.tr.headers.id } });
    return out;
  }
  const col = new Map<RequestColumn, number>();
  grid[h].forEach((c, i) => {
    const k = HEADER_ALIASES.get(norm(c));
    if (k && !col.has(k)) col.set(k, i);
  });
  const text = (r: string[], k: RequestColumn) => {
    const v = r[col.get(k)!] ?? "";
    return opts.csv ? csvUnsafe(v) : v;
  };
  const seen = new Set<string>();
  for (let i = h + 1; i < grid.length; i++) {
    const r = grid[i];
    const row = i + 1;
    if (!r.some((c) => c.trim() !== "")) continue;
    out.read++;
    const id = text(r, "id").trim();
    if (!id) {
      out.issues.push({ row, key: "missingId" });
      continue;
    }
    if (seen.has(id)) {
      out.issues.push({ row, key: "duplicate", vars: { id } });
      continue;
    }
    seen.add(id);
    const rec: RequestRow = { row, id };
    if (col.has("owner")) rec.owner = cleanText(text(r, "owner"), OWNER_MAX);
    if (col.has("note")) rec.note = cleanText(text(r, "note"), NOTE_MAX);
    if (col.has("sourceDoc")) rec.sourceDoc = cleanText(text(r, "sourceDoc"), DOC_MAX);
    if (col.has("sourceDate")) {
      const d = parseDue(text(r, "sourceDate"));
      if (d === null) out.issues.push({ row, key: "badDocDate", vars: { value: text(r, "sourceDate").trim() } });
      else rec.sourceDate = d;
    }
    if (col.has("due")) {
      const d = parseDue(text(r, "due"));
      if (d === null) out.issues.push({ row, key: "badDate", vars: { value: text(r, "due").trim() } });
      else rec.due = d;
    }
    if (col.has("status")) {
      const raw = norm(text(r, "status"));
      const s = raw === "" ? "todo" : STATUS_ALIASES.get(raw);
      if (!s) out.issues.push({ row, key: "badStatus", vars: { value: text(r, "status").trim() } });
      else rec.status = s;
    }
    out.rows.push(rec);
  }
  return out;
}

/** Reads a filled list (Excel, OpenDocument or CSV): the first sheet with a code column wins. */
export function importRequestsFile(buf: ArrayBuffer, fileName: string): Promise<FileRead<RequestFile>> {
  const csv = /\.(csv|txt)$/i.test(fileName);
  return readFirstSheet(buf, fileName, (g) => parseRequestRows(g, { csv }), (r) => !r.issues.some((i) => i.key === "missingColumns" || i.key === "empty"));
}

/**
 * Applies the rows of a filled list to the items on screen. Unknown codes and rows of locked sections that
 * would change something are reported and skipped. Returns the new tracking and how many items changed.
 */
export function applyRequestRows(
  req: Requests,
  items: RequestItem[],
  rows: RequestRow[],
  approvals: Approvals | undefined,
  importLog: ImportRecord[] | undefined,
  at: string,
): { next: Requests; changed: number; issues: RequestFileIssue[] } {
  const byId = new Map(items.map((i) => [i.id, i]));
  const issues: RequestFileIssue[] = [];
  let next = req;
  let changed = 0;
  for (const r of rows) {
    const item = byId.get(r.id);
    if (!item) {
      issues.push({ row: r.row, key: "unknownId", vars: { id: r.id } });
      continue;
    }
    const after = setTrack(next, item, { owner: r.owner, due: r.due, status: r.status, note: r.note, sourceDoc: r.sourceDoc, sourceDate: r.sourceDate }, importLog, at);
    if (sameTrack(trackOf(after, item.id), trackOf(next, item.id))) continue;
    if (itemLocked(approvals, item)) {
      issues.push({ row: r.row, key: "locked", vars: { id: r.id } });
      continue;
    }
    next = after;
    changed++;
  }
  return { next, changed, issues };
}

const isSource = (x: unknown): x is SourceNote => {
  const v = x as Partial<SourceNote> | null;
  return !!v && typeof v.doc === "string" && typeof v.date === "string" && (v.doc !== "" || isDay(v.date));
};

const isEvidence = (e: unknown): e is RequestEvidence => {
  const x = e as Partial<RequestEvidence> | null;
  return !!x && typeof x.fileName === "string" && typeof x.sha256 === "string" && typeof x.importedAt === "string";
};

/** Repairs a stored or imported value into the tracking shape; anything unreadable becomes empty tracking. */
export function asRequests(v: unknown): Requests {
  const x = v as Partial<Requests> | null;
  if (!x || typeof x !== "object" || !x.items || typeof x.items !== "object" || Array.isArray(x.items)) return emptyRequests();
  const templates = Array.isArray(x.templates) ? x.templates.filter((t): t is string => typeof t === "string") : null;
  const items: Record<string, RequestTrack> = {};
  for (const [id, t] of Object.entries(x.items as Record<string, Partial<RequestTrack>>)) {
    if (!t || typeof t !== "object" || !(REQUEST_STATUSES as readonly string[]).includes(t.status as string)) continue;
    items[id] = {
      owner: typeof t.owner === "string" ? t.owner : "",
      due: typeof t.due === "string" && isDay(t.due) ? t.due : "",
      status: t.status as RequestStatus,
      note: typeof t.note === "string" ? t.note : "",
      ...(isSource(t.source) ? { source: { doc: t.source.doc, date: isDay(t.source.date) ? t.source.date : "" } } : {}),
      ...(t.status === "accepted" && typeof t.acceptedAt === "string" ? { acceptedAt: t.acceptedAt } : {}),
      ...(t.status === "accepted" && isEvidence(t.evidence) ? { evidence: { fileName: t.evidence.fileName, sha256: t.evidence.sha256, importedAt: t.evidence.importedAt } } : {}),
    };
  }
  return { templates, items };
}
