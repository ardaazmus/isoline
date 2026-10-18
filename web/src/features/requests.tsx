"use client";

import Link from "next/link";
import { Fragment, useRef, useState } from "react";
import { CircleAlert, FileCheck2, FileDown, FileSpreadsheet, FileUp, Lock, ShieldAlert } from "lucide-react";
import { useI18n } from "@/i18n/provider";
import { CROSSWALK } from "@/data/crosswalk";
import { NAV } from "@/data/nav";
import { TEMPLATES } from "@/data/templates";
import type { ThemeId } from "@/data/themes";
import { evaluate } from "@/lib/calc/applicability";
import type { SectionId } from "@/lib/approval";
import { localDay, useToday } from "@/lib/dates";
import { download, slug, toCsv } from "@/lib/export";
import type { FileRead } from "@/lib/imports";
import { SHEET_ACCEPT, xlsxWorkbook, XLSX_MIME } from "@/lib/spreadsheet";
import {
  applyRequestRows,
  assignByRole,
  FILE_TEXT,
  generateRequests,
  hasEvidence,
  importRequestsFile,
  isOverdue,
  itemLocked,
  markRequested,
  REQUEST_STATUSES,
  requestTable,
  ROLES,
  sectionProgress,
  setTrack,
  suggestTemplates,
  trackOf,
  type FileLang,
  type ItemText,
  type RequestFile,
  type RequestFileIssue,
  type RequestItem,
  type RequestStatus,
  type RequestTrack,
  type Role,
  type TrackPatch,
} from "@/lib/requests";
import { useActiveClient, useWorkspace } from "@/store/workspace";
import { FiguresRow, InputGroup, PageHeader, ToolLayout } from "@/components/shell";
import { GroupRow, InlineBar, ThemeIcon } from "@/components/data";
import { SourceNote } from "@/components/figure";
import { ImportPreview, IssueList } from "@/components/file-import";
import { Button, Callout, cn, DraftInput, Field, Tabs, TextField } from "@/components/ui";
import { Hydrated } from "./common";

/** Theme of a section's group row; an item takes its crosswalk row's theme when it has one. */
const SECTION_THEME: Record<SectionId, ThemeId> = {
  ghg: "climate",
  cbam: "climate",
  ets: "climate",
  pathway: "climate",
  materiality: "governance",
  environment: "nature",
  workforce: "people",
  taxonomy: "economy",
  trialBalance: "economy",
  reconciliation: "economy",
  claims: "governance",
};
const CW_THEME = new Map(CROSSWALK.map((r) => [r.id, r.theme]));
const themeOf = (i: RequestItem): ThemeId => (i.cw && CW_THEME.get(i.cw)) || SECTION_THEME[i.section];

/** Status in the line language: dotted muted not sent, dashed requested, dotted amber received (to review), solid accepted. */
const LINE: Record<RequestStatus, string> = {
  todo: "border-dotted border-[var(--ink-3)]",
  requested: "border-dashed border-[var(--b-400)]",
  received: "border-dotted border-[var(--warn)]",
  accepted: "border-solid border-[var(--b-600)]",
};

type StatusFilter = RequestStatus | "all" | "overdue";

export function RequestsPage() {
  return (
    <Hydrated>
      <Requests />
    </Hydrated>
  );
}

function Requests() {
  const { t, fmt, locale } = useI18n();
  const client = useActiveClient();
  const update = useWorkspace((s) => s.update);
  const today = useToday();
  const req = client.requests;
  const suggestions = suggestTemplates(evaluate(client.profile), client.profile);
  // only known templates count: a stored choice may name one a later version dropped
  const chosen = (req.templates ?? suggestions.map((s) => s.template)).filter((id) => TEMPLATES.some((tp) => tp.id === id));
  const items = generateRequests(client, chosen);

  const [section, setSection] = useState<SectionId | "all">("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [role, setRole] = useState<Role | "all">("all");
  const [done, setDone] = useState<string | null>(null);
  const [imported, setImported] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ name: string; read: FileRead<RequestFile> } | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const now = () => new Date().toISOString();
  const lang: FileLang = locale === "tr" ? "tr" : "en";
  const navHref = (id: string) => NAV.flatMap((g) => g.items).find((i) => i.id === id)?.href ?? "";

  const matches = (i: RequestItem) => {
    const tr = trackOf(req, i.id);
    if (section !== "all" && i.section !== section) return false;
    if (role !== "all" && i.role !== role) return false;
    if (status === "overdue") return isOverdue(tr, today);
    return status === "all" || tr.status === status;
  };
  const visible = items.filter(matches);
  const progress = sectionProgress(items, req, client.approvals, today);
  const accepted = items.filter((i) => trackOf(req, i.id).status === "accepted").length;
  const overdue = items.filter((i) => isOverdue(trackOf(req, i.id), today)).length;
  const noOwner = items.filter((i) => !trackOf(req, i.id).owner).length;

  const edit = (i: RequestItem, patch: TrackPatch) => update("requests", setTrack(req, i, patch, client.importLog, now()));
  const chooseTemplates = (ids: string[] | null) => update("requests", { ...req, templates: ids });
  const toggleTemplate = (id: string) => {
    const on = new Set(chosen);
    if (on.has(id)) on.delete(id);
    else on.add(id);
    chooseTemplates(TEMPLATES.map((tp) => tp.id).filter((x) => on.has(x)));
  };

  // ── file exchange ──
  const text = (i: RequestItem): ItemText => ({
    section: t(`nav.${i.section}`),
    item: t(`req.items.${i.id}`),
    role: t(`req.role.${i.role}`),
    document: t(`req.docs.${i.id}`),
    unit: t(`req.units.${i.unit}`),
  });
  const fileName = (ext: string) => `${slug(client.name)}-${t("req.fileBase")}.${ext}`;
  const table = () => requestTable(visible, req, lang, text);
  const exportCsv = () => {
    const rows = table();
    download(fileName("csv"), toCsv(rows[0], rows.slice(1)), "text/csv;charset=utf-8");
  };
  const exportXlsx = async () => {
    const help = [
      [t("req.help.codes")],
      [t("req.help.fill")],
      [t("req.help.statuses", { list: REQUEST_STATUSES.map((s) => FILE_TEXT[lang].statuses[s]).join(", ") })],
      [t("req.help.evidence")],
    ];
    const buf = await xlsxWorkbook([
      { name: t("req.sheet"), rows: table(), widths: [18, 22, 44, 20, 50, 16, 10, 22, 12, 14, 40, 36, 12], text: [0, 6, 7, 10, 11] },
      { name: t("req.helpSheet"), rows: help, widths: [110] },
    ]);
    download(fileName("xlsx"), buf, XLSX_MIME);
  };
  const plan = (read: RequestFile) => applyRequestRows(req, items, read.rows, client.approvals, client.importLog, now());
  const issueText = (i: RequestFileIssue) => {
    const msg = t(`req.import.err.${i.key}`, i.vars);
    return i.key === "missingColumns" || i.key === "empty" ? msg : `${t("ghg.import.row", { row: i.row })} ${msg}`;
  };

  return (
    <div data-family="reporting">
      <PageHeader
        family="reporting"
        title={t("nav.requests")}
        result={items.length ? t("req.result", { n: items.length, r: chosen.length, accepted, overdue }) : t("req.resultNone")}
        actions={
          <>
            <Button variant="onBand" onClick={exportCsv} disabled={!visible.length}>
              <FileDown size={15} aria-hidden /> {t("req.csv")}
            </Button>
            <Button variant="onBand" onClick={exportXlsx} disabled={!visible.length}>
              <FileSpreadsheet size={15} aria-hidden /> {t("req.xlsx")}
            </Button>
            <Button variant="onBandPrimary" onClick={() => fileInput.current?.click()} disabled={busy || !items.length}>
              <FileUp size={15} aria-hidden /> {busy ? t("req.reading") : t("req.upload")}
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept={SHEET_ACCEPT}
              className="hidden"
              aria-label={t("req.upload")}
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                setBusy(true);
                setImported(null);
                try {
                  setPreview({ name: f.name, read: await importRequestsFile(await f.arrayBuffer(), f.name) });
                } finally {
                  setBusy(false);
                }
              }}
            />
          </>
        }
      />
      <p className="mb-6 max-w-[72ch] text-[14px] text-[var(--ink-2)]">{t("req.intro")}</p>
      <ToolLayout
        family="reporting"
        inputs={
          <>
            <InputGroup title={t("req.templates.title")}>
              <p className="text-[12.5px] leading-snug text-[var(--ink-3)]">{t("req.templates.hint")}</p>
              <ul className="-mx-2 flex flex-col">
                {TEMPLATES.map((tp) => {
                  const sug = suggestions.find((s) => s.template === tp.id);
                  return (
                    <li key={tp.id}>
                      <label className="flex cursor-pointer items-start gap-2.5 rounded-[10px] px-2 py-1.5 hover:bg-[color-mix(in_srgb,var(--paper)_60%,transparent)]">
                        <input
                          type="checkbox"
                          aria-label={t(`tpl.${tp.id}.title`)}
                          checked={chosen.includes(tp.id)}
                          onChange={() => toggleTemplate(tp.id)}
                          className="mt-[3px] h-4 w-4 shrink-0 accent-[var(--b-600)]"
                        />
                        <span className="min-w-0 text-[14px] leading-snug text-[var(--ink)]">
                          {t(`tpl.${tp.id}.title`)}
                          {sug && <span className="block text-[12px] text-[var(--accent-ink)]">{t("req.templates.suggested", { reg: t(`app.reg.${sug.finding}`) })}</span>}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              {req.templates && (
                <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-[var(--ink-3)]">
                  {t("req.templates.custom")}
                  <Button variant="ghost" size="sm" onClick={() => chooseTemplates(null)}>
                    {t("req.templates.reset")}
                  </Button>
                </div>
              )}
            </InputGroup>
            <AssignOwners
              disabled={!visible.length}
              onApply={(owners, due) => {
                const r = assignByRole(req, visible, owners, due, client.approvals, client.importLog, now());
                update("requests", r.next);
                setDone(t("req.assign.applied", { n: r.changed }));
              }}
              onMarkSent={() => {
                const r = markRequested(req, visible, client.approvals, client.importLog, now());
                update("requests", r.next);
                setDone(t("req.assign.marked", { n: r.changed }));
              }}
              done={done}
            />
          </>
        }
      >
        {preview && (
          <ImportPreview>
            {!preview.read.ok ? (
              <>
                <p className="font-semibold">{preview.name}</p>
                <IssueList items={[t(`imp.err.${preview.read.error}`, { mb: 15 })]} />
              </>
            ) : (
              (() => {
                const read = preview.read.result;
                const p = plan(read);
                return (
                  <>
                    <p className="font-semibold">{t("req.import.preview", { file: preview.read.sheet ? `${preview.name} · ${preview.read.sheet}` : preview.name, rows: read.read, n: p.changed })}</p>
                    {p.changed === 0 && !read.issues.length && <p className="text-[var(--ink-2)]">{t("req.import.nothing")}</p>}
                    <IssueList items={[...read.issues, ...p.issues].sort((a, b) => a.row - b.row).map(issueText)} />
                    <div className="flex flex-wrap gap-2 pt-1">
                      {p.changed > 0 && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => {
                            const r = plan(read);
                            update("requests", r.next);
                            setImported(t("req.import.applied", { n: r.changed }));
                            setPreview(null);
                          }}
                        >
                          {t("req.import.apply", { n: p.changed })}
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => setPreview(null)}>
                        {t("clients.cancel")}
                      </Button>
                    </div>
                  </>
                );
              })()
            )}
          </ImportPreview>
        )}
        {imported && !preview && <Callout>{imported}</Callout>}
        {!items.length ? (
          <Callout>{t("req.resultNone")}</Callout>
        ) : (
          <>
            <FiguresRow
              pulseKey={accepted}
              items={[
                { label: t("req.fig.accepted"), value: `${fmt.number(accepted)} / ${fmt.number(items.length)}`, note: t("req.fig.acceptedNote", { p: fmt.percent(accepted / items.length, 0) }) },
                { label: t("req.fig.items"), value: fmt.number(items.length), note: t("req.fig.itemsNote", { r: chosen.length, s: progress.length }) },
                { label: t("req.fig.overdue"), value: fmt.number(overdue), note: t("req.fig.overdueNote"), tone: overdue ? "crit" : undefined },
                { label: t("req.fig.noOwner"), value: fmt.number(noOwner), note: t("req.fig.noOwnerNote") },
              ]}
            />
            <section aria-label={t("req.progress.title")} className="glass sheet flex min-w-0 flex-col gap-3 p-5 md:p-6">
              <h2 className="text-[16px] font-semibold">{t("req.progress.title")}</h2>
              <div className="overflow-x-auto">
                <table className="report-table min-w-[560px] text-[13.5px]">
                  <thead>
                    <tr>
                      <th>{t("req.col.section")}</th>
                      <th>{t("req.col.accepted")}</th>
                      <th className="r">{t("req.col.open")}</th>
                      <th className="r">{t("req.fig.overdue")}</th>
                      <th className="r">{t("req.col.evidenced")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {progress.map((p, k) => {
                      const a = p.counts.accepted;
                      return (
                        <tr key={p.section} className="anim-row group" style={{ ["--i" as string]: k }}>
                          <td>
                            <button
                              type="button"
                              aria-pressed={section === p.section}
                              onClick={() => setSection(section === p.section ? "all" : p.section)}
                              className={cn("inline-flex items-center gap-2.5 text-left", section === p.section && "font-semibold underline")}
                            >
                              <ThemeIcon theme={SECTION_THEME[p.section]} size="sm" />
                              {t(`nav.${p.section}`)}
                              {p.locked && <Lock size={13} aria-label={t("req.progress.locked")} className="text-[var(--b-600)]" />}
                            </button>
                          </td>
                          <td>
                            <span className="inline-flex items-center gap-3 whitespace-nowrap">
                              <InlineBar value={a / p.total} label={t("req.progress.share", { a, n: p.total })} index={k} />
                              <span className="num text-[12.5px] text-[var(--ink-2)]">{t("req.progress.share", { a, n: p.total })}</span>
                            </span>
                          </td>
                          <td className="r num">{p.total - a}</td>
                          <td className={cn("r num", p.overdue > 0 && "font-semibold text-[var(--crit)]")}>{p.overdue}</td>
                          <td className="r num">{t("req.progress.of", { a: p.evidenced, n: p.total })}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-[12.5px] text-[var(--ink-3)]">{t("req.progress.caption")}</p>
            </section>
            <section aria-label={t("req.table.title")} className="glass sheet flex min-w-0 flex-col gap-4 p-5 md:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-[16px] font-semibold">{t("req.table.title")}</h2>
                <span className="text-[12.5px] text-[var(--ink-3)]">{t("req.table.shown", { shown: visible.length, n: items.length })}</span>
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <Tabs
                  label={t("req.filter.status")}
                  value={status}
                  onChange={setStatus}
                  items={(["all", ...REQUEST_STATUSES, "overdue"] as StatusFilter[]).map((s) => ({
                    value: s,
                    label: s === "all" ? t("req.filter.all") : s === "overdue" ? `${t("req.filter.overdue")} ${overdue}` : `${t(`req.status.${s}`)} ${items.filter((i) => trackOf(req, i.id).status === s).length}`,
                  }))}
                />
                <label className="flex flex-col gap-1 text-[13px] font-medium text-[var(--ink-2)]">
                  {t("req.filter.section")}
                  <select className="field-input h-9 text-[13.5px]" value={section} onChange={(e) => setSection(e.target.value as SectionId | "all")}>
                    <option value="all">{t("req.filter.all")}</option>
                    {progress.map((p) => (
                      <option key={p.section} value={p.section}>
                        {t(`nav.${p.section}`)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-[13px] font-medium text-[var(--ink-2)]">
                  {t("req.filter.role")}
                  <select className="field-input h-9 text-[13.5px]" value={role} onChange={(e) => setRole(e.target.value as Role | "all")}>
                    <option value="all">{t("req.filter.all")}</option>
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {t(`req.role.${r}`)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="overflow-x-auto">
                <table className="report-table min-w-[1440px] text-[13.5px]">
                  <thead>
                    <tr>
                      <th className="min-w-[300px]">{t("req.col.item")}</th>
                      <th>{t("req.col.role")}</th>
                      <th>{t("req.col.unit")}</th>
                      <th>{t("req.col.owner")}</th>
                      <th>{t("req.col.due")}</th>
                      <th>{t("req.col.status")}</th>
                      <th>{t("req.col.note")}</th>
                      <th>{t("req.col.evidence")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!visible.length && (
                      <tr>
                        <td colSpan={8} className="py-6 text-center text-[var(--ink-3)]">
                          {t("req.table.empty")}
                        </td>
                      </tr>
                    )}
                    {progress
                      .filter((p) => visible.some((i) => i.section === p.section))
                      .map((p) => (
                        <Fragment key={p.section}>
                          <GroupRow
                            theme={SECTION_THEME[p.section]}
                            colSpan={8}
                            title={
                              <>
                                <Link href={`/${locale}${navHref(p.section)}`} className="text-inherit">
                                  {t(`nav.${p.section}`)}
                                </Link>
                                {p.locked && <Lock size={13} aria-label={t("req.progress.locked")} />}
                              </>
                            }
                            aside={t("req.progress.share", { a: p.counts.accepted, n: p.total })}
                          />
                          {visible
                            .filter((i) => i.section === p.section)
                            .map((i, k) => (
                              <ItemRow key={i.id} item={i} track={trackOf(req, i.id)} today={today} index={k} locked={itemLocked(client.approvals, i)} onEdit={(patch) => edit(i, patch)} />
                            ))}
                        </Fragment>
                      ))}
                  </tbody>
                </table>
              </div>
              <SourceNote
                meta={{
                  sources: [...new Set(TEMPLATES.filter((tp) => chosen.includes(tp.id)).flatMap((tp) => tp.sources))],
                  status: TEMPLATES.some((tp) => chosen.includes(tp.id) && tp.status === "review") ? "review" : undefined,
                }}
              />
            </section>
          </>
        )}
      </ToolLayout>
    </div>
  );
}

/** One request: what to ask for and from whom, its trace, then the tracking fields (disabled in a locked section). */
function ItemRow({ item: i, track: tr, today, index, locked, onEdit }: { item: RequestItem; track: RequestTrack; today: string | null; index: number; locked: boolean; onEdit: (p: TrackPatch) => void }) {
  const { t, fmt } = useI18n();
  const late = isOverdue(tr, today);
  const name = t(`req.items.${i.id}`);
  const refs = [...new Set(i.traces.flatMap((x) => x.refs))];
  const traceTitle = i.traces.map((x) => `${t(`tpl.${x.template}.title`)} — ${t(`tpl.${x.template}.sections.${x.section}.title`)} (${x.refs.join(", ")})`).join("\n");
  return (
    <tr className="anim-row group" style={{ ["--i" as string]: index }} title={locked ? t("req.table.locked") : undefined}>
      <td>
        <span className="flex items-start gap-2.5">
          <ThemeIcon theme={themeOf(i)} size="sm" title={t(`theme.${themeOf(i)}`)} />
          <span className="min-w-0">
            <span className="block font-medium text-[var(--ink)]">{name}</span>
            <span className="block text-[12.5px] leading-snug text-[var(--ink-2)]">{t(`req.docs.${i.id}`)}</span>
            <span className="mt-0.5 block text-[11.5px] leading-snug text-[var(--ink-3)]" title={traceTitle}>
              <span className="sr-only">{t("req.table.trace")}: </span>
              {refs.slice(0, 2).join(" · ")}
              {refs.length > 2 && ` · +${refs.length - 2}`}
            </span>
            {i.sensitive && (
              <span className="mt-1 inline-flex items-center gap-1 text-[11.5px] text-[var(--ink-2)]">
                <ShieldAlert size={12} aria-hidden /> {t("req.table.sensitive")}
              </span>
            )}
          </span>
        </span>
      </td>
      <td className="whitespace-nowrap">{t(`req.role.${i.role}`)}</td>
      <td className="whitespace-nowrap">
        <span className="block">{t(`req.units.${i.unit}`)}</span>
        <span className="num text-[12px] text-[var(--ink-3)]">{i.period}</span>
      </td>
      <td>
        <DraftInput value={tr.owner} label={`${t("req.col.owner")}: ${name}`} placeholder={t("req.table.ownerPh")} disabled={locked} onCommit={(v) => onEdit({ owner: v })} width="9.5rem" />
      </td>
      <td>
        <input
          type="date"
          aria-label={`${t("req.col.due")}: ${name}`}
          aria-invalid={late}
          disabled={locked}
          value={tr.due}
          onChange={(e) => onEdit({ due: e.target.value })}
          className="field-input h-9 text-[13.5px]"
          style={{ width: "9.5rem" }}
        />
        {late && (
          <span className="mt-1 flex items-center gap-1 text-[12px] font-medium text-[var(--crit)]">
            <CircleAlert size={12} aria-hidden /> {t("req.table.overdue")}
          </span>
        )}
      </td>
      <td>
        <span className="flex items-center gap-2">
          <span aria-hidden className={cn("inline-block w-5 shrink-0 border-t-2", LINE[tr.status])} />
          <select
            aria-label={`${t("req.col.status")}: ${name}`}
            disabled={locked}
            value={tr.status}
            onChange={(e) => onEdit({ status: e.target.value as RequestStatus })}
            className={cn("field-input h-9 text-[13.5px]", tr.status === "received" && "text-[var(--warn)]")}
            style={{ width: "9.5rem" }}
          >
            {REQUEST_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`req.status.${s}`)}
              </option>
            ))}
          </select>
        </span>
        {tr.status === "accepted" && tr.acceptedAt && <span className="mt-1 block pl-7 text-[12px] text-[var(--ink-3)]">{t("req.table.acceptedOn", { date: fmt.date(localDay(tr.acceptedAt)) })}</span>}
      </td>
      <td>
        <DraftInput value={tr.note} label={`${t("req.col.note")}: ${name}`} placeholder={t("req.table.notePh")} disabled={locked} onCommit={(v) => onEdit({ note: v })} width="13rem" />
      </td>
      <td className="text-[12.5px]">
        <span className="flex flex-col gap-1.5">
          {tr.evidence && (
            <span
              className="flex flex-col"
              title={t("req.table.evidenceTitle", { file: tr.evidence.fileName, date: fmt.date(localDay(tr.evidence.importedAt)), hash: tr.evidence.sha256 })}
            >
              <span className="inline-flex max-w-[200px] items-center gap-1.5 text-[var(--ink)]">
                <FileCheck2 size={14} aria-hidden className="shrink-0 text-[var(--b-600)]" />
                <span className="truncate">{tr.evidence.fileName}</span>
              </span>
              <span className="num text-[11.5px] text-[var(--ink-3)]">SHA-256 {tr.evidence.sha256.slice(0, 12)}…</span>
            </span>
          )}
          <DraftInput value={tr.source?.doc ?? ""} label={`${t("src.doc")}: ${name}`} placeholder={t("src.doc")} disabled={locked} onCommit={(v) => onEdit({ sourceDoc: v })} width="12.5rem" />
          <input
            type="date"
            aria-label={`${t("src.date")}: ${name}`}
            title={t("src.date")}
            disabled={locked}
            value={tr.source?.date ?? ""}
            onChange={(e) => onEdit({ sourceDate: e.target.value })}
            className="field-input h-9 text-[13.5px]"
            style={{ width: "9.5rem" }}
          />
          {tr.status === "accepted" && !hasEvidence(tr) && (
            <span className="flex items-center gap-1 text-[12px] font-medium text-[var(--warn)]">
              <CircleAlert size={12} aria-hidden /> {t("req.table.noEvidence")}
            </span>
          )}
        </span>
      </td>
    </tr>
  );
}

/** One name per department and a shared due date, applied to the empty fields of the shown items. */
function AssignOwners({ disabled, onApply, onMarkSent, done }: { disabled: boolean; onApply: (owners: Partial<Record<Role, string>>, due: string) => void; onMarkSent: () => void; done: string | null }) {
  const { t } = useI18n();
  const [owners, setOwners] = useState<Partial<Record<Role, string>>>({});
  const [due, setDue] = useState("");
  return (
    <InputGroup title={t("req.assign.title")}>
      <p className="text-[12.5px] leading-snug text-[var(--ink-3)]">{t("req.assign.hint")}</p>
      {ROLES.map((r) => (
        <TextField key={r} label={t(`req.role.${r}`)} value={owners[r] ?? ""} onChange={(v) => setOwners({ ...owners, [r]: v })} />
      ))}
      <Field label={t("req.assign.due")}>{(id) => <input id={id} type="date" className="field-input" value={due} onChange={(e) => setDue(e.target.value)} />}</Field>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" size="sm" disabled={disabled} onClick={() => onApply(owners, due)}>
          {t("req.assign.apply")}
        </Button>
        <Button variant="quiet" size="sm" disabled={disabled} onClick={onMarkSent}>
          {t("req.assign.markSent")}
        </Button>
      </div>
      {done && <Callout>{done}</Callout>}
    </InputGroup>
  );
}
