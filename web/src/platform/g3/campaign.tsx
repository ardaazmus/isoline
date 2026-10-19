"use client";

/**
 * DATA-01..03, 06..08: campaign generation from report templates, the request table with bulk assignment and
 * sending, progress by status and facility, and the file import (preview → commit → rollback).
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Download, FileSpreadsheet, Send } from "lucide-react";
import { useI18n } from "@/i18n/provider";
import { Button, cn } from "@/components/ui";
import { api } from "../client";
import { Badge, Check, ErrorNote, Input, OkNote, Select, SubmitButton, useSubmit } from "../ui";

export function CampaignForm({ cycleId, templates, suggested, lang, projectId }: { cycleId: string; templates: { id: string; kind: string }[]; suggested: string[]; lang: string; projectId: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [chosen, setChosen] = useState<string[]>(suggested);
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const s = useSubmit(
    () => api<{ campaignId: string; created: number }>("POST", `/api/v1/cycles/${cycleId}/campaigns`, { title, templateIds: chosen, dueOn: due || null }),
    (d) => router.push(`/${lang}/app/projects/${projectId}/data/${d.campaignId}`),
  );
  const kinds = [...new Set(templates.map((x) => x.kind))];
  return (
    <form onSubmit={s.submit} className="flex flex-col gap-4">
      {suggested.length > 0 && <p className="text-[13px] text-[var(--ink-2)]">{t("pf.data.suggestedNote")}</p>}
      {kinds.map((k) => (
        <fieldset key={k} className="flex flex-wrap gap-x-5 gap-y-2">
          <legend className="mb-1 text-[12.5px] font-semibold uppercase tracking-[0.05em] text-[var(--ink-3)]">{t(`tpl.kinds.${k}`)}</legend>
          {templates
            .filter((x) => x.kind === k)
            .map((x) => (
              <Check
                key={x.id}
                id={`tpl-${x.id}`}
                checked={chosen.includes(x.id)}
                onChange={(v) => setChosen(v ? [...chosen, x.id] : chosen.filter((y) => y !== x.id))}
                label={
                  <>
                    {t(`tpl.${x.id}.title`)} {suggested.includes(x.id) && <Badge tone="info">{t("pf.data.suggested")}</Badge>}
                  </>
                }
              />
            ))}
        </fieldset>
      ))}
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_200px_auto] md:items-end">
        <Input label={t("pf.data.campaignTitle")} name="cmp-title" maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
        <Input label={t("pf.data.defaultDue")} name="cmp-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        <SubmitButton busy={s.busy} disabled={!chosen.length}>
          {t("pf.data.generate")}
        </SubmitButton>
      </div>
      <ErrorNote code={s.error} />
    </form>
  );
}

export type Req = {
  id: string;
  metric_code: string;
  facility_id: string | null;
  facility_name: string | null;
  period_label: string;
  status: string;
  due_on: string | null;
  critical: boolean;
  returns: number;
  assignee_user_id: string | null;
  reviewer_user_id: string | null;
  assignee_name: string | null;
  reviewer_name: string | null;
  evidence: number;
};
export type Person = { user_id: string; name: string; raci_role: string };

const TONE: Record<string, "neutral" | "ok" | "warn" | "crit" | "info"> = { created: "neutral", assigned: "neutral", sent: "info", submitted: "warn", reviewing: "warn", accepted: "ok", revision_required: "crit", withdrawn: "neutral", not_applicable: "neutral" };

export function StatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  return <Badge tone={TONE[status] ?? "neutral"}>{t(`pf.data.status.${status}`)}</Badge>;
}

export function RequestTable({ lang, requests, team, assigneeRoles, reviewerRoles, canManage, today }: { lang: string; requests: Req[]; team: Person[]; assigneeRoles: string[]; reviewerRoles: string[]; canManage: boolean; today: string }) {
  const { t, fmt } = useI18n();
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [filter, setFilter] = useState({ status: "", facility: "", person: "" });
  const [assign, setAssign] = useState({ assignee: "", reviewer: "", due: "", critical: false });
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const facilities = useMemo(() => [...new Map(requests.map((r) => [r.facility_id ?? "", r.facility_name ?? t("pf.data.organisationLevel")])).entries()], [requests, t]);
  const shown = requests.filter((r) => (!filter.status || r.status === filter.status) && (!filter.facility || (r.facility_id ?? "") === filter.facility) && (!filter.person || r.assignee_user_id === filter.person || r.reviewer_user_id === filter.person));
  const people = [...new Map(team.map((p) => [p.user_id, p])).values()];
  const assignees = people.filter((p) => team.some((x) => x.user_id === p.user_id && assigneeRoles.includes(x.raci_role)));
  const reviewers = people.filter((p) => team.some((x) => x.user_id === p.user_id && reviewerRoles.includes(x.raci_role)));
  const all = shown.length > 0 && shown.every((r) => selected.includes(r.id));
  const run = async (path: string, body: Record<string, unknown>, msg: (d: Record<string, number>) => string) => {
    setBusy(true);
    setError(null);
    setOk(null);
    const r = await api<Record<string, number>>("POST", path, body);
    setBusy(false);
    if (!r.ok) return setError(r.code);
    setOk(msg(r.data));
    setSelected([]);
    router.refresh();
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <Select label={t("pf.data.filterStatus")} name="f-status" value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })} options={[{ value: "", label: t("pf.data.all") }, ...["created", "assigned", "sent", "submitted", "reviewing", "revision_required", "accepted", "not_applicable", "withdrawn"].map((s) => ({ value: s, label: t(`pf.data.status.${s}`) }))]} />
        <Select label={t("pf.data.filterFacility")} name="f-fac" value={filter.facility} onChange={(e) => setFilter({ ...filter, facility: e.target.value })} options={[{ value: "", label: t("pf.data.all") }, ...facilities.map(([id, n]) => ({ value: id, label: n }))]} />
        <Select label={t("pf.data.filterPerson")} name="f-person" value={filter.person} onChange={(e) => setFilter({ ...filter, person: e.target.value })} options={[{ value: "", label: t("pf.data.all") }, ...people.map((p) => ({ value: p.user_id, label: p.name }))]} />
      </div>
      {canManage && (
        <div className="flex flex-col gap-2 rounded-[14px] border border-[var(--rule)] bg-[var(--paper)] p-3">
          <p className="text-[12.5px] font-semibold text-[var(--ink-2)]">{t("pf.data.bulkTitle", { n: selected.length })}</p>
          <div className="grid gap-2 md:grid-cols-[1fr_1fr_160px_auto_auto] md:items-end">
            <Select label={t("pf.data.assignee")} name="b-assignee" value={assign.assignee} onChange={(e) => setAssign({ ...assign, assignee: e.target.value })} options={[{ value: "", label: t("pf.data.keep") }, ...assignees.map((p) => ({ value: p.user_id, label: p.name }))]} />
            <Select label={t("pf.data.reviewer")} name="b-reviewer" value={assign.reviewer} onChange={(e) => setAssign({ ...assign, reviewer: e.target.value })} options={[{ value: "", label: t("pf.data.keep") }, ...reviewers.map((p) => ({ value: p.user_id, label: p.name }))]} />
            <Input label={t("pf.data.due")} name="b-due" type="date" value={assign.due} onChange={(e) => setAssign({ ...assign, due: e.target.value })} />
            <Check id="b-critical" checked={assign.critical} onChange={(v) => setAssign({ ...assign, critical: v })} label={t("pf.data.critical")} />
            <Button
              variant="primary"
              size="sm"
              disabled={busy || !selected.length}
              onClick={() =>
                void run("/api/v1/requests/assign", { requestIds: selected, ...(assign.assignee ? { assigneeUserId: assign.assignee } : {}), ...(assign.reviewer ? { reviewerUserId: assign.reviewer } : {}), ...(assign.due ? { dueOn: assign.due } : {}), ...(assign.critical ? { critical: true } : {}) }, (d) => t("pf.data.assigned", { n: d.changed }))
              }
            >
              {t("pf.data.assign")}
            </Button>
          </div>
          <div>
            <Button size="sm" disabled={busy || !selected.length} onClick={() => void run("/api/v1/requests/send", { requestIds: selected }, (d) => t("pf.data.sentN", { n: d.sent }))}>
              <Send size={14} aria-hidden />
              {t("pf.data.send")}
            </Button>
          </div>
          <ErrorNote code={error} />
          {ok && <OkNote>{ok}</OkNote>}
        </div>
      )}
      <div className="-mx-1 overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-left text-[13px]">
          <caption className="sr-only">{t("pf.data.tableCaption")}</caption>
          <thead>
            <tr className="border-b border-[var(--rule)] text-[11.5px] uppercase tracking-[0.06em] text-[var(--ink-3)]">
              {canManage && (
                <th scope="col" className="px-2 py-2">
                  <input type="checkbox" aria-label={t("pf.data.selectAll")} checked={all} onChange={(e) => setSelected(e.target.checked ? [...new Set([...selected, ...shown.map((r) => r.id)])] : selected.filter((id) => !shown.some((r) => r.id === id)))} />
                </th>
              )}
              <th scope="col" className="px-2 py-2 font-semibold">{t("pf.data.metric")}</th>
              <th scope="col" className="px-2 py-2 font-semibold">{t("pf.data.facility")}</th>
              <th scope="col" className="px-2 py-2 font-semibold">{t("pf.data.statusCol")}</th>
              <th scope="col" className="px-2 py-2 font-semibold">{t("pf.data.people")}</th>
              <th scope="col" className="px-2 py-2 font-semibold">{t("pf.data.due")}</th>
              <th scope="col" className="px-2 py-2 font-semibold">{t("pf.data.evidence")}</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => {
              const late = r.due_on && r.due_on < today && !["accepted", "not_applicable", "withdrawn"].includes(r.status);
              return (
                <tr key={r.id} className={cn("align-top", selected.includes(r.id) && "bg-[var(--b-50)]")}>
                  {canManage && (
                    <td className="border-b border-[var(--rule)] px-2 py-2">
                      <input type="checkbox" aria-label={t("pf.data.select")} checked={selected.includes(r.id)} onChange={(e) => setSelected(e.target.checked ? [...selected, r.id] : selected.filter((x) => x !== r.id))} />
                    </td>
                  )}
                  <td className="border-b border-[var(--rule)] px-2 py-2">
                    <Link href={`/${lang}/app/tasks/${r.id}`} className="font-medium text-[var(--b-700)]">
                      {t(`req.items.${r.metric_code}`)}
                    </Link>
                    <span className="block text-[11.5px] text-[var(--ink-3)]">
                      {r.metric_code} · {r.period_label}
                    </span>
                  </td>
                  <td className="border-b border-[var(--rule)] px-2 py-2">{r.facility_name ?? <span className="text-[var(--ink-3)]">{t("pf.data.organisationLevel")}</span>}</td>
                  <td className="border-b border-[var(--rule)] px-2 py-2">
                    <span className="flex flex-wrap gap-1">
                      <StatusBadge status={r.status} />
                      {r.critical && <Badge tone="info">{t("pf.data.critical")}</Badge>}
                      {r.returns > 0 && <Badge tone="warn">{t("pf.data.returnsN", { n: r.returns })}</Badge>}
                    </span>
                  </td>
                  <td className="border-b border-[var(--rule)] px-2 py-2 text-[12.5px]">
                    {r.assignee_name ?? "—"}
                    <span className="block text-[var(--ink-3)]">{r.reviewer_name ? t("pf.data.reviewedBy", { name: r.reviewer_name }) : ""}</span>
                  </td>
                  <td className={cn("border-b border-[var(--rule)] px-2 py-2 whitespace-nowrap", late && "font-semibold text-[var(--crit)]")}>{r.due_on ? fmt.date(r.due_on) : "—"}</td>
                  <td className="border-b border-[var(--rule)] px-2 py-2">{Number(r.evidence) || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type Preview = { importId: string; duplicateOf: string | null; total: number; valid: number; errors: { row: number; column: string | null; code: string }[]; ownReview: number };

export function ImportPanel({ campaignId, lang, imports }: { campaignId: string; lang: string; imports: { id: string; file_name: string; status: string; rows_total: number; rows_valid: number; rows_error: number; created_at: string | Date; created_by_name: string | null }[] }) {
  const { t, fmt } = useI18n();
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const act = async (fn: () => Promise<{ ok: boolean; code?: string; data?: unknown }>, done: (d: unknown) => void) => {
    setBusy(true);
    setError(null);
    const r = await fn();
    setBusy(false);
    if (!r.ok) return setError((r as { code: string }).code);
    done(r.data);
  };
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <a href={`/api/v1/campaigns/${campaignId}/template?lang=${lang}`} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--b-700)]">
          <Download size={14} aria-hidden />
          {t("pf.data.downloadTemplate")}
        </a>
        <span className="text-[12.5px] text-[var(--ink-3)]">{t("pf.data.templateHint")}</span>
      </div>
      <div className="flex flex-col gap-2 md:flex-row md:items-end">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <label htmlFor="imp-file" className="text-[13px] font-medium text-[var(--ink-2)]">
            {t("pf.data.importFile")}
          </label>
          <input id="imp-file" type="file" accept=".xlsx,.xls,.csv,.txt,.ods" className="field-input" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setPreview(null); setOk(null); }} />
        </div>
        <Button
          variant="primary"
          disabled={!file || busy}
          onClick={() => {
            const f = new FormData();
            f.set("file", file!);
            void act(() => api<Preview>("POST", `/api/v1/campaigns/${campaignId}/imports`, undefined, { form: f }), (d) => setPreview(d as Preview));
          }}
        >
          <FileSpreadsheet size={15} aria-hidden />
          {t("pf.data.preview")}
        </Button>
      </div>
      <ErrorNote code={error} />
      {ok && <OkNote>{ok}</OkNote>}
      {preview && (
        <div className="flex flex-col gap-3 rounded-[14px] border border-[var(--rule)] bg-[var(--paper)] p-4">
          <p className="text-[13.5px]">{t("pf.data.previewLine", { total: preview.total, valid: preview.valid, errors: preview.errors.length })}</p>
          {preview.duplicateOf && <ErrorNote code="import_already_committed" />}
          {preview.ownReview > 0 && <p className="text-[12.5px] text-[var(--warn)]">{t("pf.data.ownReview", { n: preview.ownReview })}</p>}
          {preview.errors.length > 0 && (
            <ul className="max-h-60 overflow-y-auto text-[12.5px]">
              {preview.errors.map((e) => (
                <li key={`${e.row}-${e.code}`} className="border-b border-[var(--rule)] py-1">
                  {t("pf.data.rowError", { row: e.row, column: e.column ?? "—", reason: t(`pf.data.rowErr.${e.code.startsWith("request_") ? "request_closed" : e.code}`) })}
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <Button variant="primary" disabled={busy || !preview.valid || !!preview.duplicateOf} onClick={() => void act(() => api<{ versions: number }>("POST", `/api/v1/source-imports/${preview.importId}/commit`), (d) => { setOk(t("pf.data.committed", { n: (d as { versions: number }).versions })); setPreview(null); router.refresh(); })}>
              {t("pf.data.commit", { n: preview.valid })}
            </Button>
          </div>
        </div>
      )}
      {imports.length > 0 && (
        <ul className="flex flex-col divide-y divide-[var(--rule)] text-[13px]">
          {imports.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center gap-3 py-2">
              <span className="flex-1">
                {i.file_name} <span className="text-[var(--ink-3)]">· {i.created_by_name} · {fmt.date(new Date(i.created_at).toISOString().slice(0, 10))}</span>
              </span>
              <span className="text-[12.5px] text-[var(--ink-2)]">{t("pf.data.previewLine", { total: i.rows_total, valid: i.rows_valid, errors: i.rows_error })}</span>
              <Badge tone={i.status === "committed" ? "ok" : "neutral"}>{t(`pf.data.importStatus.${i.status}`)}</Badge>
              {i.status === "committed" && (
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => void act(() => api("POST", `/api/v1/source-imports/${i.id}/rollback`), () => { setOk(t("pf.data.rolledBack")); router.refresh(); })}>
                  {t("pf.data.rollback")}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const days = (s: string) =>
  s
    .split(/[,\s]+/)
    .map((x) => Number(x))
    .filter((n) => Number.isInteger(n) && n > 0);

/** G3-08: the campaign's reminder rule — days before the due date, days after it, and which of them only for critical requests. */
export function ReminderForm({ campaignId, policy, status }: { campaignId: string; policy: { beforeDays: number[]; afterDays: number[]; criticalOnlyDays: number[] }; status: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [before, setBefore] = useState(policy.beforeDays.join(", "));
  const [after, setAfter] = useState(policy.afterDays.join(", "));
  const [critical, setCritical] = useState(policy.criticalOnlyDays.join(", "));
  const [saved, setSaved] = useState(false);
  const s = useSubmit(
    () => api("PATCH", `/api/v1/campaigns/${campaignId}`, { reminderPolicy: { beforeDays: days(before), afterDays: days(after), criticalOnlyDays: days(critical) } }),
    () => {
      setSaved(true);
      router.refresh();
    },
  );
  const close = useSubmit(() => api("PATCH", `/api/v1/campaigns/${campaignId}`, { status: status === "active" ? "closed" : "active" }), () => router.refresh());
  return (
    <form onSubmit={s.submit} className="flex flex-col gap-3">
      <div className="grid gap-3 md:grid-cols-3">
        <Input label={t("pf.data.remBefore")} name="rem-before" value={before} onChange={(e) => setBefore(e.target.value)} hint={t("pf.data.remBeforeHint")} />
        <Input label={t("pf.data.remCritical")} name="rem-critical" value={critical} onChange={(e) => setCritical(e.target.value)} hint={t("pf.data.remCriticalHint")} />
        <Input label={t("pf.data.remAfter")} name="rem-after" value={after} onChange={(e) => setAfter(e.target.value)} hint={t("pf.data.remAfterHint")} />
      </div>
      <ErrorNote code={s.error ?? close.error} />
      {saved && !s.error && <OkNote>{t("pf.common.saved")}</OkNote>}
      <div className="flex flex-wrap gap-2">
        <SubmitButton busy={s.busy}>{t("pf.common.save")}</SubmitButton>
        <Button size="sm" variant="ghost" disabled={close.busy} onClick={() => void close.submit()}>
          {status === "active" ? t("pf.data.closeCampaign") : t("pf.data.reopenCampaign")}
        </Button>
      </div>
    </form>
  );
}
