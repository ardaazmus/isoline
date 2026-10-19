"use client";

/** G7: industry pack switches, pack requests, the assurance room's question and answer forms, the engagement. */
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/i18n/provider";
import { Button } from "@/components/ui";
import { api } from "../client";
import { Check, ErrorNote, OkNote, Select, SubmitButton, useSubmit } from "../ui";

export function PackForm({ projectId, packId, facilities, initial, enabled }: { projectId: string; packId: string; facilities: { id: string; name: string }[]; initial: string[]; enabled: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [chosen, setChosen] = useState<string[]>(initial);
  const save = useSubmit(() => api("POST", `/api/v1/projects/${projectId}/industry-packs`, { packId, facilityIds: chosen }), () => router.refresh());
  const off = useSubmit(() => api("POST", `/api/v1/projects/${projectId}/industry-packs/disable`, { packId }), () => router.refresh());
  return (
    <form onSubmit={save.submit} className="flex flex-col gap-2">
      <fieldset className="flex flex-wrap gap-x-5 gap-y-2">
        <legend className="mb-1 text-[12.5px] font-semibold text-[var(--ink-3)]">{t("pf.ind.facilities")}</legend>
        {facilities.map((f) => (
          <Check key={f.id} id={`${packId}-${f.id}`} checked={chosen.includes(f.id)} onChange={(v) => setChosen(v ? [...chosen, f.id] : chosen.filter((x) => x !== f.id))} label={f.name} />
        ))}
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <SubmitButton busy={save.busy}>{t(enabled ? "pf.ind.update" : "pf.ind.enable")}</SubmitButton>
        {enabled && (
          <Button type="button" size="sm" variant="ghost" onClick={() => off.submit()} disabled={off.busy}>
            {t("pf.ind.disable")}
          </Button>
        )}
      </div>
      <ErrorNote code={save.error ?? off.error} />
    </form>
  );
}

export function PackRequestsForm({ campaigns }: { campaigns: { id: string; title: string }[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const [campaign, setCampaign] = useState(campaigns[0]?.id ?? "");
  const [done, setDone] = useState<number | null>(null);
  const s = useSubmit(
    () => api<{ created: number }>("POST", `/api/v1/campaigns/${campaign}/pack-requests`),
    (d) => {
      setDone(d.created);
      router.refresh();
    },
  );
  if (!campaigns.length) return <p className="text-[13px] text-[var(--ink-3)]">{t("pf.ind.noCampaign")}</p>;
  return (
    <form onSubmit={s.submit} className="flex flex-wrap items-end gap-3">
      <Select label={t("pf.ind.campaign")} name="pk-campaign" value={campaign} onChange={(e) => setCampaign(e.target.value)} options={campaigns.map((c) => ({ value: c.id, label: c.title }))} />
      <SubmitButton busy={s.busy}>{t("pf.ind.addRequests")}</SubmitButton>
      <ErrorNote code={s.error} />
      {done !== null && <OkNote>{t("pf.ind.added", { n: done })}</OkNote>}
    </form>
  );
}

export function AskForm({ cycleId, facts }: { cycleId: string; facts: { id: string; label: string }[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const [target, setTarget] = useState("");
  const [question, setQuestion] = useState("");
  const s = useSubmit(
    () => api("POST", `/api/v1/cycles/${cycleId}/assurance/questions`, { targetType: target ? "fact" : "general", targetId: target || null, question }),
    () => {
      setQuestion("");
      router.refresh();
    },
  );
  return (
    <form onSubmit={s.submit} className="flex flex-col gap-2">
      <Select label={t("pf.as.about")} name="as-target" value={target} onChange={(e) => setTarget(e.target.value)} options={[{ value: "", label: t("pf.as.general") }, ...facts.map((f) => ({ value: f.id, label: f.label }))]} />
      <label htmlFor="as-question" className="text-[13px] font-medium">
        {t("pf.as.question")}
      </label>
      <textarea id="as-question" className="min-h-[80px] rounded-[10px] border border-[var(--rule)] bg-[var(--paper)] p-2 text-[13.5px]" value={question} onChange={(e) => setQuestion(e.target.value)} minLength={10} maxLength={4000} required />
      <div>
        <SubmitButton busy={s.busy} disabled={question.trim().length < 10}>
          {t("pf.as.ask")}
        </SubmitButton>
      </div>
      <ErrorNote code={s.error} />
    </form>
  );
}

export function AnswerForm({ questionId, evidence }: { questionId: string; evidence: { id: string; filename: string }[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const [answer, setAnswer] = useState("");
  const [files, setFiles] = useState<string[]>([]);
  const s = useSubmit(() => api("POST", `/api/v1/assurance-questions/${questionId}/answer`, { answer, evidenceIds: files }), () => router.refresh());
  return (
    <form onSubmit={s.submit} className="flex flex-col gap-2">
      <label htmlFor={`ans-${questionId}`} className="text-[13px] font-medium">
        {t("pf.as.answer")}
      </label>
      <textarea id={`ans-${questionId}`} className="min-h-[70px] rounded-[10px] border border-[var(--rule)] bg-[var(--paper)] p-2 text-[13.5px]" value={answer} onChange={(e) => setAnswer(e.target.value)} minLength={10} maxLength={8000} required />
      {evidence.length > 0 && (
        <fieldset className="flex flex-wrap gap-x-4 gap-y-1">
          <legend className="text-[12.5px] text-[var(--ink-3)]">{t("pf.as.attach")}</legend>
          {evidence.slice(0, 30).map((e) => (
            <Check key={e.id} id={`att-${questionId}-${e.id}`} checked={files.includes(e.id)} onChange={(v) => setFiles(v ? [...files, e.id] : files.filter((x) => x !== e.id))} label={e.filename} />
          ))}
        </fieldset>
      )}
      <div>
        <SubmitButton busy={s.busy} disabled={answer.trim().length < 10}>
          {t("pf.as.sendAnswer")}
        </SubmitButton>
      </div>
      <ErrorNote code={s.error} />
    </form>
  );
}

export function EngagementForm({ cycleId }: { cycleId: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [standard, setStandard] = useState("isae3000");
  const [level, setLevel] = useState("limited");
  const s = useSubmit(() => api("POST", `/api/v1/cycles/${cycleId}/assurance/engagements`, { standard, level }), () => router.refresh());
  return (
    <form onSubmit={s.submit} className="flex flex-wrap items-end gap-3">
      <Select label={t("pf.as.standard")} name="eng-standard" value={standard} onChange={(e) => setStandard(e.target.value)} options={["isae3000", "isae3410", "issa5000", "kgk_gds", "other"].map((x) => ({ value: x, label: t(`pf.as.standards.${x}`) }))} />
      <Select label={t("pf.as.level")} name="eng-level" value={level} onChange={(e) => setLevel(e.target.value)} options={["limited", "reasonable"].map((x) => ({ value: x, label: t(`pf.as.levels.${x}`) }))} />
      <SubmitButton busy={s.busy}>{t("pf.as.createEngagement")}</SubmitButton>
      <ErrorNote code={s.error} />
    </form>
  );
}

export function EngagementStatusForm({ engagementId, current, evidence }: { engagementId: string; current: string; evidence: { id: string; filename: string }[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const [status, setStatus] = useState(current);
  const [file, setFile] = useState("");
  const s = useSubmit(() => api("POST", `/api/v1/assurance-engagements/${engagementId}/status`, { status, opinionEvidenceId: file || null }), () => router.refresh());
  return (
    <form onSubmit={s.submit} className="flex flex-wrap items-end gap-3">
      <Select label={t("pf.as.status")} name="eng-status" value={status} onChange={(e) => setStatus(e.target.value)} options={["preparing", "ready", "in_progress", "opinion_received", "withdrawn"].map((x) => ({ value: x, label: t(`pf.as.statuses.${x}`) }))} />
      {status === "opinion_received" && <Select label={t("pf.as.opinionFile")} name="eng-file" value={file} onChange={(e) => setFile(e.target.value)} options={[{ value: "", label: "—" }, ...evidence.map((e) => ({ value: e.id, label: e.filename }))]} />}
      <SubmitButton busy={s.busy}>{t("pf.as.saveStatus")}</SubmitButton>
      <ErrorNote code={s.error} />
    </form>
  );
}

