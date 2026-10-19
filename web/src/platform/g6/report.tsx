"use client";

/**
 * REP-01..12 (G6): report creation, the section editor with metric tokens, section review, the approval chain,
 * release and amendment, design proofs. Every action is checked again on the server.
 */
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Copy, Rocket, Send, Upload } from "lucide-react";
import { useI18n } from "@/i18n/provider";
import { Button } from "@/components/ui";
import { api } from "../client";
import { ErrorNote, Input, OkNote, Select, SubmitButton, useSubmit } from "../ui";

export function CreateReportForm({ projectId, base, cycles, templates }: { projectId: string; base: string; cycles: { id: string; label: string }[]; templates: { id: string; kind: string }[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const [cycleId, setCycle] = useState(cycles[0]?.id ?? "");
  const [templateId, setTemplate] = useState(templates[0]?.id ?? "");
  const [language, setLanguage] = useState("tr");
  const [title, setTitle] = useState("");
  const s = useSubmit(
    () => api<{ reportId: string }>("POST", `/api/v1/projects/${projectId}/reports`, { cycleId, templateId, language, title: title || null }),
    (d) => router.push(`${base}/${d.reportId}`),
  );
  return (
    <form onSubmit={s.submit} className="grid gap-3 md:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto] lg:items-end">
      <Select label={t("pf.rep.cycle")} name="r-cycle" value={cycleId} onChange={(e) => setCycle(e.target.value)} options={cycles.map((c) => ({ value: c.id, label: c.label }))} />
      <Select label={t("pf.rep.template")} name="r-template" value={templateId} onChange={(e) => setTemplate(e.target.value)} options={templates.map((x) => ({ value: x.id, label: t(`tpl.${x.id}.title`) }))} />
      <Select label={t("pf.rep.language")} name="r-lang" value={language} onChange={(e) => setLanguage(e.target.value)} options={["tr", "en"].map((l) => ({ value: l, label: t(`pf.rep.lang.${l}`) }))} />
      <Input label={t("pf.rep.title")} name="r-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} hint={t("pf.rep.titleHint")} />
      <SubmitButton busy={s.busy} disabled={!cycleId || !templateId}>
        {t("pf.rep.create")}
      </SubmitButton>
      <div className="md:col-span-2 lg:col-span-5">
        <ErrorNote code={s.error} />
      </div>
    </form>
  );
}

export function SectionEditor({ sectionId, body, version, canWrite, canSubmit }: { sectionId: string; body: string; version: number | null; canWrite: boolean; canSubmit: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [text, setText] = useState(body);
  const [unresolved, setUnresolved] = useState<string[]>([]);
  const save = useSubmit(
    () => api<{ unresolved: string[] }>("PUT", `/api/v1/report-sections/${sectionId}`, { body: text, baseVersion: version ?? 0 }),
    (d) => {
      setUnresolved(d.unresolved);
      router.refresh();
    },
  );
  const submit = useSubmit(() => api("POST", `/api/v1/report-sections/${sectionId}/submit`), () => router.refresh());
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={`body-${sectionId}`} className="text-[13px] font-medium">
        {t("pf.rep.body")}
      </label>
      <textarea id={`body-${sectionId}`} className="min-h-[320px] rounded-[12px] border border-[var(--rule)] bg-[var(--paper)] p-3 font-mono text-[13px] leading-relaxed" value={text} onChange={(e) => setText(e.target.value)} readOnly={!canWrite} maxLength={100000} />
      <p className="text-[12px] leading-relaxed text-[var(--ink-3)]">{t("pf.rep.markupHint")}</p>
      {canWrite && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="primary" onClick={() => save.submit()} disabled={save.busy || text === body}>
            {t("pf.rep.saveVersion")}
          </Button>
          {canSubmit && (
            <Button type="button" size="sm" onClick={() => submit.submit()} disabled={submit.busy || text !== body}>
              <Send size={14} aria-hidden /> {t("pf.rep.submit")}
            </Button>
          )}
        </div>
      )}
      {unresolved.length > 0 && <p className="text-[12.5px] text-[var(--warn)]">{t("pf.rep.unresolved", { tokens: unresolved.join(", ") })}</p>}
      <ErrorNote code={save.error ?? submit.error} />
    </div>
  );
}

export function SectionReview({ sectionId }: { sectionId: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [note, setNote] = useState("");
  const approve = useSubmit(() => api("POST", `/api/v1/report-sections/${sectionId}/review`, { decision: "approve", note: note || null }), () => router.refresh());
  const reject = useSubmit(() => api("POST", `/api/v1/report-sections/${sectionId}/review`, { decision: "reject", note }), () => router.refresh());
  return (
    <div className="flex flex-col gap-2 rounded-[12px] border border-[var(--rule)] bg-[var(--paper)] p-3">
      <Input label={t("pf.rep.reviewNote")} name={`rn-${sectionId}`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} />
      <div className="flex gap-2">
        <Button type="button" size="sm" variant="primary" onClick={() => approve.submit()} disabled={approve.busy}>
          {t("pf.calc.approve")}
        </Button>
        <Button type="button" size="sm" onClick={() => reject.submit()} disabled={reject.busy || note.trim().length < 10}>
          {t("pf.rep.returnSection")}
        </Button>
      </div>
      <ErrorNote code={approve.error ?? reject.error} />
    </div>
  );
}

export function CopyToken({ token }: { token: string }) {
  const { t } = useI18n();
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 rounded-[8px] px-1.5 py-0.5 font-mono text-[11.5px] text-[var(--b-700)] hover:bg-[var(--b-50)]"
      onClick={() => {
        void navigator.clipboard?.writeText(token).then(() => setDone(true));
      }}
      aria-label={t("pf.rep.copyToken", { token })}
    >
      <Copy size={12} aria-hidden /> {done ? t("pf.rep.copied") : token}
    </button>
  );
}

export function StageActions({ reportId, status, canRequest, canDecide, canRelease, released }: { reportId: string; status: string; canRequest: boolean; canDecide: boolean; canRelease: boolean; released: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [comment, setComment] = useState("");
  const [reason, setReason] = useState("");
  const [out, setOut] = useState<string | null>(null);
  const request = useSubmit(() => api("POST", `/api/v1/reports/${reportId}/request-review`), () => router.refresh());
  const approve = useSubmit(() => api("POST", `/api/v1/reports/${reportId}/decision`, { decision: "approved", comment: comment || null }), () => router.refresh());
  const changes = useSubmit(() => api("POST", `/api/v1/reports/${reportId}/decision`, { decision: "changes_requested", comment }), () => router.refresh());
  const release = useSubmit(
    () => api<{ version: number; manifestSha256: string }>("POST", `/api/v1/reports/${reportId}/release`, { amendmentReason: reason || null }),
    (d) => {
      setOut(t("pf.rep.released", { v: d.version, sha: d.manifestSha256.slice(0, 12) }));
      router.refresh();
    },
  );
  const stage = ["tech_review", "customer_review", "management_signoff"].includes(status);
  return (
    <div className="flex flex-col gap-3">
      {status === "drafting" && canRequest && (
        <div>
          <Button type="button" size="sm" variant="primary" onClick={() => request.submit()} disabled={request.busy}>
            <Send size={14} aria-hidden /> {t("pf.rep.requestReview")}
          </Button>
        </div>
      )}
      {stage && canDecide && (
        <div className="flex flex-col gap-2">
          <Input label={t("pf.rep.stageComment")} name="stage-comment" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={2000} />
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="primary" onClick={() => approve.submit()} disabled={approve.busy}>
              {t(`pf.rep.approveStage.${status}`)}
            </Button>
            <Button type="button" size="sm" onClick={() => changes.submit()} disabled={changes.busy || comment.trim().length < 10}>
              {t("pf.rep.requestChanges")}
            </Button>
          </div>
        </div>
      )}
      {status === "management_signoff" && canRelease && (
        <div className="flex flex-col gap-2 rounded-[12px] border border-[var(--rule)] bg-[var(--paper)] p-3">
          <p className="text-[13px] text-[var(--ink-2)]">{t("pf.rep.releaseLead")}</p>
          {released && <Input label={t("pf.rep.amendmentReason")} name="amend" value={reason} onChange={(e) => setReason(e.target.value)} minLength={20} maxLength={2000} />}
          <div>
            <Button type="button" size="sm" variant="primary" onClick={() => release.submit()} disabled={release.busy || (released && reason.trim().length < 20)}>
              <Rocket size={14} aria-hidden /> {t(released ? "pf.rep.amend" : "pf.rep.release")}
            </Button>
          </div>
        </div>
      )}
      <ErrorNote code={request.error ?? approve.error ?? changes.error ?? release.error} />
      {out && <OkNote>{out}</OkNote>}
    </div>
  );
}

export function ProofUpload({ releaseId }: { releaseId: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const s = useSubmit(
    () => {
      const form = new FormData();
      form.set("file", file!);
      return api("POST", `/api/v1/releases/${releaseId}/proofs`, undefined, { form });
    },
    () => {
      setFile(null);
      router.refresh();
    },
  );
  return (
    <form onSubmit={s.submit} className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-[13px] font-medium">
        {t("pf.rep.proofFile")}
        <input type="file" accept="application/pdf,.pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-[13px]" />
      </label>
      <SubmitButton busy={s.busy} disabled={!file}>
        <Upload size={14} aria-hidden /> {t("pf.rep.uploadProof")}
      </SubmitButton>
      <ErrorNote code={s.error} />
    </form>
  );
}

export function ProofDecision({ proofId }: { proofId: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [note, setNote] = useState("");
  const ok = useSubmit(() => api("POST", `/api/v1/design-proofs/${proofId}/decision`, { decision: "approved", note: note || null }), () => router.refresh());
  const no = useSubmit(() => api("POST", `/api/v1/design-proofs/${proofId}/decision`, { decision: "changes_requested", note }), () => router.refresh());
  return (
    <div className="flex flex-col gap-2">
      <Input label={t("pf.rep.proofNote")} name={`pn-${proofId}`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} />
      <div className="flex gap-2">
        <Button type="button" size="sm" variant="primary" onClick={() => ok.submit()} disabled={ok.busy}>
          {t("pf.calc.approve")}
        </Button>
        <Button type="button" size="sm" onClick={() => no.submit()} disabled={no.busy || note.trim().length < 10}>
          {t("pf.rep.requestChanges")}
        </Button>
      </div>
      <ErrorNote code={ok.error ?? no.error} />
    </div>
  );
}
