"use client";

/**
 * DATA-05 / G3-04: the contributor's four steps — what is asked, the value, the evidence, submit — and the
 * reviewer's accept or return-with-reason. Versions are listed newest first; nothing earlier is overwritten.
 */
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Check as CheckIcon, FileUp, Paperclip, Plus, Trash2 } from "lucide-react";
import { useI18n } from "@/i18n/provider";
import { Button, cn } from "@/components/ui";
import { api } from "../client";
import { Badge, ErrorNote, Input, OkNote, Select, SubmitButton, useSubmit } from "../ui";
import { StatusBadge } from "./campaign";

type Line = { key: string; value: string; unit: string };
export type TaskView = {
  request: { id: string; project_id: string; metric_code: string; facility_name: string | null; period_label: string; period_start: string | null; period_end: string | null; status: string; due_on: string | null; returns: number; instructions: string | null; traces: unknown; assignee_name: string | null; reviewer_name: string | null; row_version: number; project_name: string; cycle_label: string };
  metric: { code: string; unitKey: string; dimensions: string[]; multiline: boolean; lineKeys: string[]; evidenceRequired: boolean; sensitive: boolean; aggregation: string; grain: string };
  versions: { id: string; revision: number; value_num: string | null; unit_code: string | null; canonical_value: string | null; canonical_unit: string | null; value_text: string | null; lines: unknown; quality: string; method_note: string | null; source_ref: string | null; status: string; created_at: string | Date; entered_by_name: string | null; decided_by_name: string | null; import_id: string | null }[];
  evidence: { id: string; filename: string; scan_status: string }[];
  comments: { id: string; kind: string; body: string; created_at: string | Date; author: string | null }[];
  can: { edit: boolean; review: boolean };
};

const STEPS = ["what", "value", "evidence", "submit"] as const;

const num = (v: string | null) => (v === null ? "" : String(Number(v)));

export function TaskForm({ task, units, projectEvidence }: { task: TaskView; units: Record<string, string[]>; projectEvidence: { id: string; filename: string; scan_status: string }[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const draft = task.versions.find((v) => v.status === "draft");
  const last = draft ?? task.versions[0];
  const allowed = task.metric.dimensions.flatMap((d) => units[d] ?? []);
  const numeric = !task.metric.dimensions.includes("none");
  const [step, setStep] = useState<(typeof STEPS)[number]>(task.can.edit ? "what" : "what");
  const [value, setValue] = useState(last?.value_num ? num(last.value_num) : "");
  const [unit, setUnit] = useState(last?.unit_code ?? allowed[0] ?? "");
  const [text, setText] = useState(last?.value_text ?? "");
  const [lines, setLines] = useState<Line[]>(Array.isArray(last?.lines) ? (last!.lines as { key: string; value: string; unit: string }[]).map((l) => ({ key: l.key, value: num(l.value), unit: l.unit })) : [{ key: task.metric.lineKeys[0] ?? "", value: "", unit: allowed[0] ?? "" }]);
  const [quality, setQuality] = useState(last?.quality ?? "measured");
  const [method, setMethod] = useState(last?.method_note ?? "");
  const [source, setSource] = useState(last?.source_ref ?? "");
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [evBusy, setEvBusy] = useState(false);
  const [evError, setEvError] = useState<string | null>(null);
  const [pick, setPick] = useState("");

  const save = useSubmit(
    () =>
      api("PUT", `/api/v1/requests/${task.request.id}/draft`, task.metric.multiline ? { lines, text: text || null, quality, methodNote: method || null, sourceRef: source || null } : numeric ? { value: value || null, unit, text: text || null, quality, methodNote: method || null, sourceRef: source || null } : { text, quality, methodNote: method || null, sourceRef: source || null }),
    () => {
      setSaved(true);
      router.refresh();
      setStep("evidence");
    },
  );
  const submit = useSubmit(() => api("POST", `/api/v1/requests/${task.request.id}/submit`, { note: note || null }), () => router.refresh());

  const upload = async () => {
    const f = fileRef.current?.files?.[0];
    if (!f) return setEvError("file_required");
    setEvBusy(true);
    setEvError(null);
    const fd = new FormData();
    fd.set("file", f);
    fd.set("classification", task.metric.sensitive ? "personal" : "internal");
    const up = await api<{ id: string }>("POST", `/api/v1/projects/${task.request.project_id}/evidence`, undefined, { form: fd });
    if (!up.ok) {
      setEvBusy(false);
      return setEvError(up.code);
    }
    const ln = await api("POST", `/api/v1/requests/${task.request.id}/evidence`, { evidenceId: up.data.id });
    setEvBusy(false);
    if (!ln.ok && ln.code !== "conflict") return setEvError(ln.code);
    if (fileRef.current) fileRef.current.value = "";
    router.refresh();
  };

  if (!task.can.edit) return null;
  return (
    <section className="glass flex flex-col gap-4 p-5 md:p-6" aria-labelledby="task-steps">
      <h2 id="task-steps" className="sr-only">
        {t("pf.task.steps")}
      </h2>
      <ol className="flex flex-wrap gap-2" aria-label={t("pf.task.steps")}>
        {STEPS.map((s, i) => (
          <li key={s}>
            <button type="button" onClick={() => setStep(s)} aria-current={step === s ? "step" : undefined} className={cn("flex items-center gap-2 rounded-full border px-3 py-1 text-[13px]", step === s ? "border-[var(--b-600)] bg-[var(--b-600)] text-white" : "border-[var(--rule)] text-[var(--ink-2)]")}>
              <span className="grid h-5 w-5 place-items-center rounded-full bg-white/20 text-[11px] font-semibold">{i + 1}</span>
              {t(`pf.task.step.${s}`)}
            </button>
          </li>
        ))}
      </ol>

      {step === "what" && (
        <div className="flex flex-col gap-3 text-[14px]">
          <p className="text-[16px] font-semibold">{t(`req.items.${task.metric.code}`)}</p>
          <dl className="grid gap-x-6 gap-y-2 md:grid-cols-[180px_minmax(0,1fr)]">
            <dt className="text-[var(--ink-3)]">{t("pf.task.source")}</dt>
            <dd>{t(`req.docs.${task.metric.code}`)}</dd>
            <dt className="text-[var(--ink-3)]">{t("pf.task.unit")}</dt>
            <dd>{t(`req.units.${task.metric.unitKey}`)}</dd>
            <dt className="text-[var(--ink-3)]">{t("pf.task.period")}</dt>
            <dd>{task.request.period_label}</dd>
            <dt className="text-[var(--ink-3)]">{t("pf.task.where")}</dt>
            <dd>{task.request.facility_name ?? t("pf.data.organisationLevel")}</dd>
            <dt className="text-[var(--ink-3)]">{t("pf.task.aggregation")}</dt>
            <dd>{t(`pf.task.agg.${task.metric.aggregation}`)}</dd>
          </dl>
          {task.metric.sensitive && <p className="rounded-[12px] border border-[var(--warn)] bg-[var(--warn-wash)] px-3 py-2 text-[13px]">{t("pf.task.sensitive")}</p>}
          {task.request.instructions && <p className="text-[13.5px] text-[var(--ink-2)]">{task.request.instructions}</p>}
          <div>
            <Button variant="primary" onClick={() => setStep("value")}>
              {t("pf.task.next")}
            </Button>
          </div>
        </div>
      )}

      {step === "value" && (
        <form onSubmit={save.submit} className="flex flex-col gap-4">
          {task.metric.multiline ? (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-[13px] font-semibold">{t("pf.task.lines")}</legend>
              {lines.map((l, i) => (
                <div key={i} className="grid gap-2 md:grid-cols-[1fr_1fr_140px_auto] md:items-end">
                  {task.metric.lineKeys.length ? (
                    <Select label={t("pf.task.line")} name={`l-k-${i}`} value={l.key} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)))} options={task.metric.lineKeys.map((k) => ({ value: k, label: t(`pf.task.lineKey.${k}`) }))} />
                  ) : (
                    <Input label={t("pf.task.line")} name={`l-k-${i}`} value={l.key} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)))} />
                  )}
                  <Input label={t("pf.task.value")} name={`l-v-${i}`} inputMode="decimal" value={l.value} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
                  <Select label={t("pf.task.unit")} name={`l-u-${i}`} value={l.unit} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, unit: e.target.value } : x)))} options={allowed.map((u) => ({ value: u, label: u }))} />
                  <Button size="sm" variant="ghost" aria-label={t("pf.task.removeLine")} onClick={() => setLines(lines.filter((_, j) => j !== i))}>
                    <Trash2 size={14} aria-hidden />
                  </Button>
                </div>
              ))}
              <div>
                <Button size="sm" onClick={() => setLines([...lines, { key: task.metric.lineKeys.find((k) => !lines.some((x) => x.key === k)) ?? "", value: "", unit: allowed[0] ?? "" }])}>
                  <Plus size={14} aria-hidden />
                  {t("pf.task.addLine")}
                </Button>
              </div>
            </fieldset>
          ) : numeric ? (
            <div className="grid gap-3 md:grid-cols-[1fr_160px]">
              <Input label={t("pf.task.value")} name="v-value" inputMode="decimal" required value={value} onChange={(e) => setValue(e.target.value)} hint={t("pf.task.numberHint")} />
              <Select label={t("pf.task.unit")} name="v-unit" value={unit} onChange={(e) => setUnit(e.target.value)} options={allowed.map((u) => ({ value: u, label: u }))} />
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <label htmlFor="v-text" className="text-[13px] font-medium text-[var(--ink-2)]">
                {t("pf.task.text")}
              </label>
              <textarea id="v-text" className="field-input min-h-[120px]" required maxLength={4000} value={text} onChange={(e) => setText(e.target.value)} />
            </div>
          )}
          <div className="grid gap-3 md:grid-cols-3">
            <Select label={t("pf.task.quality")} name="v-quality" value={quality} onChange={(e) => setQuality(e.target.value)} options={["measured", "calculated", "estimated"].map((q) => ({ value: q, label: t(`pf.task.q.${q}`) }))} />
            <Input label={t("pf.task.sourceRef")} name="v-source" maxLength={500} value={source} onChange={(e) => setSource(e.target.value)} hint={t("pf.task.sourceRefHint")} />
            <Input label={t("pf.task.method")} name="v-method" maxLength={2000} value={method} onChange={(e) => setMethod(e.target.value)} />
          </div>
          <ErrorNote code={save.error} />
          {saved && !save.error && <OkNote>{t("pf.task.draftSaved")}</OkNote>}
          <div>
            <SubmitButton busy={save.busy}>{t("pf.task.saveDraft")}</SubmitButton>
          </div>
        </form>
      )}

      {step === "evidence" && (
        <div className="flex flex-col gap-3">
          <p className="text-[13.5px] text-[var(--ink-2)]">{task.metric.evidenceRequired ? t("pf.task.evidenceRequired") : t("pf.task.evidenceOptional")}</p>
          {task.evidence.length > 0 && (
            <ul className="flex flex-col gap-1 text-[13.5px]">
              {task.evidence.map((e) => (
                <li key={e.id} className="flex items-center gap-2">
                  <Paperclip size={14} aria-hidden />
                  {e.filename} <Badge tone={e.scan_status === "available" ? "ok" : "warn"}>{t(`pf.evidence.status.${e.scan_status}`)}</Badge>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-col gap-2 md:flex-row md:items-end">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <label htmlFor="t-file" className="text-[13px] font-medium text-[var(--ink-2)]">
                {t("pf.evidence.file")}
              </label>
              <input id="t-file" ref={fileRef} type="file" className="field-input" accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.docx,.csv,.txt,.json,.xml,.zip" />
            </div>
            <Button variant="primary" disabled={evBusy} onClick={() => void upload()}>
              <FileUp size={15} aria-hidden />
              {t("pf.task.uploadAndLink")}
            </Button>
          </div>
          {projectEvidence.length > 0 && (
            <div className="flex flex-col gap-2 md:flex-row md:items-end">
              <div className="flex-1">
                <Select label={t("pf.task.linkExisting")} name="t-pick" value={pick} onChange={(e) => setPick(e.target.value)} options={[{ value: "", label: "—" }, ...projectEvidence.filter((e) => !task.evidence.some((x) => x.id === e.id)).map((e) => ({ value: e.id, label: e.filename }))]} />
              </div>
              <Button
                disabled={!pick || evBusy}
                onClick={async () => {
                  setEvBusy(true);
                  const r = await api("POST", `/api/v1/requests/${task.request.id}/evidence`, { evidenceId: pick });
                  setEvBusy(false);
                  if (!r.ok) return setEvError(r.code);
                  setPick("");
                  router.refresh();
                }}
              >
                {t("pf.task.link")}
              </Button>
            </div>
          )}
          <ErrorNote code={evError} />
          <div>
            <Button variant="primary" onClick={() => setStep("submit")}>
              {t("pf.task.next")}
            </Button>
          </div>
        </div>
      )}

      {step === "submit" && (
        <form onSubmit={submit.submit} className="flex flex-col gap-3">
          <p className="text-[13.5px] text-[var(--ink-2)]">{t("pf.task.submitLead", { reviewer: task.request.reviewer_name ?? "—" })}</p>
          {!draft && <ErrorNote code="value_required" />}
          <Input label={t("pf.task.note")} name="t-note" maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />
          <ErrorNote code={submit.error} />
          <div>
            <SubmitButton busy={submit.busy} disabled={!draft}>
              {task.request.returns > 0 ? t("pf.task.resubmit") : t("pf.task.submit")}
            </SubmitButton>
          </div>
        </form>
      )}
    </section>
  );
}

export function ReviewPanel({ task }: { task: TaskView }) {
  const { t } = useI18n();
  const router = useRouter();
  const [reason, setReason] = useState("");
  const accept = useSubmit(() => api("POST", `/api/v1/requests/${task.request.id}/accept`, undefined, { ifMatch: `"${task.request.row_version}"` }), () => router.refresh());
  const back = useSubmit(() => api("POST", `/api/v1/requests/${task.request.id}/return`, { reason }), () => router.refresh());
  if (!task.can.review) return null;
  return (
    <section className="glass flex flex-col gap-3 p-5 md:p-6" aria-labelledby="review-h">
      <h2 id="review-h" className="text-[17px] font-semibold">
        {t("pf.task.reviewTitle")}
      </h2>
      <p className="text-[13.5px] text-[var(--ink-2)]">{t("pf.task.reviewLead")}</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" disabled={accept.busy} onClick={() => void accept.submit()}>
          <CheckIcon size={15} aria-hidden />
          {t("pf.task.accept")}
        </Button>
      </div>
      <ErrorNote code={accept.error} />
      <form onSubmit={back.submit} className="flex flex-col gap-2 md:flex-row md:items-end">
        <div className="flex-1">
          <Input label={t("pf.task.returnReason")} name="r-reason" minLength={10} required value={reason} onChange={(e) => setReason(e.target.value)} hint={t("pf.task.returnHint")} />
        </div>
        <SubmitButton busy={back.busy} disabled={reason.trim().length < 10}>
          {t("pf.task.return")}
        </SubmitButton>
      </form>
      <ErrorNote code={back.error} />
    </section>
  );
}

export function Versions({ task }: { task: TaskView }) {
  const { t, fmt } = useI18n();
  if (!task.versions.length) return <p className="text-[13.5px] text-[var(--ink-3)]">{t("pf.task.noVersions")}</p>;
  return (
    <ol className="flex flex-col gap-2">
      {task.versions.map((v) => (
        <li key={v.id} className="rounded-[12px] border border-[var(--rule)] bg-[var(--paper)] p-3 text-[13.5px]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{t("pf.task.revision", { n: v.revision })}</span>
            <Badge tone={v.status === "accepted" ? "ok" : v.status === "rejected" ? "crit" : v.status === "submitted" ? "warn" : "neutral"}>{t(`pf.task.vstatus.${v.status}`)}</Badge>
            <span className="text-[12px] text-[var(--ink-3)]">
              {v.entered_by_name} · {fmt.date(new Date(v.created_at).toISOString().slice(0, 10))}
              {v.decided_by_name && ` · ${t("pf.task.decidedBy", { name: v.decided_by_name })}`}
              {v.import_id && ` · ${t("pf.task.viaImport")}`}
            </span>
          </div>
          <p className="mt-1 num">
            {v.value_num !== null && (
              <>
                {fmt.number(Number(v.value_num), 3)} {v.unit_code}
                {v.canonical_unit && v.canonical_unit !== v.unit_code && <span className="text-[var(--ink-3)]"> = {fmt.number(Number(v.canonical_value), 3)} {v.canonical_unit}</span>}
              </>
            )}
            {Array.isArray(v.lines) &&
              (v.lines as { key: string; value: string; unit: string }[]).map((l) => (
                <span key={l.key} className="mr-3 inline-block">
                  {t(`pf.task.lineKey.${l.key}`)}: {fmt.number(Number(l.value), 3)} {l.unit}
                </span>
              ))}
          </p>
          {v.value_text && <p className="mt-1 whitespace-pre-wrap text-[13px] text-[var(--ink-2)]">{v.value_text}</p>}
          <p className="mt-1 text-[12px] text-[var(--ink-3)]">
            {t(`pf.task.q.${v.quality}`)}
            {v.source_ref && ` · ${v.source_ref}`}
            {v.method_note && ` · ${v.method_note}`}
          </p>
        </li>
      ))}
    </ol>
  );
}

export function Comments({ task }: { task: TaskView }) {
  const { t, fmt } = useI18n();
  const router = useRouter();
  const [body, setBody] = useState("");
  const s = useSubmit(() => api("POST", `/api/v1/requests/${task.request.id}/comments`, { body }), () => {
    setBody("");
    router.refresh();
  });
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {task.comments.map((c) => (
          <li key={c.id} className={cn("rounded-[12px] px-3 py-2 text-[13.5px]", c.kind === "return" ? "border border-[color-mix(in_srgb,var(--crit)_35%,transparent)] bg-[var(--crit-wash)]" : "bg-[var(--b-50)]")}>
            <span className="text-[12px] font-semibold text-[var(--ink-2)]">
              {c.author ?? "—"} · {t(`pf.task.ckind.${c.kind}`)} · {fmt.date(new Date(c.created_at).toISOString().slice(0, 10))}
            </span>
            <p className="mt-0.5 whitespace-pre-wrap">{c.body}</p>
          </li>
        ))}
      </ul>
      <form onSubmit={s.submit} className="flex flex-col gap-2 md:flex-row md:items-end">
        <div className="flex-1">
          <Input label={t("pf.task.comment")} name="c-body" maxLength={4000} value={body} onChange={(e) => setBody(e.target.value)} />
        </div>
        <SubmitButton busy={s.busy} disabled={!body.trim()}>
          {t("pf.task.send")}
        </SubmitButton>
      </form>
      <ErrorNote code={s.error} />
    </div>
  );
}

export { StatusBadge };
