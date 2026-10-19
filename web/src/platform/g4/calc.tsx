"use client";

/**
 * DATA-17..20 (G4): run a calculation, review quality findings, approve or reject facts, reproduce a run, choose a
 * project factor and add a tenant factor set. Every action is checked again on the server; buttons only hide what
 * the person cannot do.
 */
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Calculator, CheckCheck, RefreshCcw } from "lucide-react";
import { useI18n } from "@/i18n/provider";
import { Button } from "@/components/ui";
import { api } from "../client";
import { Badge, Check, ErrorNote, Input, OkNote, Select, SubmitButton, useSubmit } from "../ui";

export const RUN_KINDS = ["ghg", "environment", "workforce", "finance", "cbam", "ets"] as const;
const BOUNDARIES: Record<string, string[]> = {
  ghg: ["ghg_operational_control", "ghg_financial_control", "ghg_equity_share"],
  environment: ["ghg_operational_control", "ghg_financial_control", "ghg_equity_share"],
  workforce: ["ghg_operational_control", "ghg_financial_control", "ghg_equity_share"],
  finance: [],
  cbam: ["cbam_facility_product"],
  ets: ["ghg_operational_control"],
};

export function RunPanel({ cycleId, approved }: { cycleId: string; approved: string[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const [kind, setKind] = useState<string>("ghg");
  const options = BOUNDARIES[kind].filter((b) => approved.includes(b));
  const [boundary, setBoundary] = useState<string>("");
  const chosen = options.includes(boundary) ? boundary : (options[0] ?? "");
  const [done, setDone] = useState<{ reused: boolean; facts: number; blockers: number; warnings: number } | null>(null);
  const s = useSubmit(
    () => api<{ runId: string; reused: boolean; facts: number; blockers: number; warnings: number }>("POST", `/api/v1/cycles/${cycleId}/calculations`, { kind, boundaryKind: BOUNDARIES[kind].length ? chosen || null : null }),
    (d) => {
      setDone(d);
      router.refresh();
    },
  );
  const needsBoundary = BOUNDARIES[kind].length > 0;
  return (
    <form onSubmit={s.submit} className="flex flex-col gap-3">
      <div className="grid gap-3 md:grid-cols-[220px_minmax(0,1fr)_auto] md:items-end">
        <Select label={t("pf.calc.kind")} name="calc-kind" value={kind} onChange={(e) => setKind(e.target.value)} options={RUN_KINDS.map((k) => ({ value: k, label: t(`pf.calc.kinds.${k}`) }))} />
        {needsBoundary ? (
          options.length ? (
            <Select label={t("pf.calc.boundary")} name="calc-boundary" value={chosen} onChange={(e) => setBoundary(e.target.value)} options={options.map((b) => ({ value: b, label: t(`pf.scope.kind.${b}`) }))} />
          ) : (
            <p className="text-[13px] text-[var(--warn)]">{t("pf.calc.noBoundary")}</p>
          )
        ) : (
          <p className="text-[13px] text-[var(--ink-3)]">{t("pf.calc.financeNoBoundary")}</p>
        )}
        <SubmitButton busy={s.busy} disabled={needsBoundary && !options.length}>
          <Calculator size={15} aria-hidden /> {t("pf.calc.run")}
        </SubmitButton>
      </div>
      <p className="text-[12.5px] leading-relaxed text-[var(--ink-3)]">{t(`pf.calc.kindHint.${kind}`)}</p>
      <ErrorNote code={s.error} />
      {done && <OkNote>{done.reused ? t("pf.calc.reused") : t("pf.calc.done", { facts: done.facts, blockers: done.blockers, warnings: done.warnings })}</OkNote>}
    </form>
  );
}

export type IssueView = { id: string; rule_id: string; severity: string; status: string; target_type: string; target_id: string; observed: unknown; resolution: string | null; resolved_by_name?: string | null; run_kind?: string | null };

export function IssueRow({ issue, canReview, lang }: { issue: IssueView; canReview: boolean; lang: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [decision, setDecision] = useState("accepted_exception");
  const [text, setText] = useState("");
  const s = useSubmit(
    () => api("POST", `/api/v1/quality-issues/${issue.id}/resolve`, { decision, resolution: text }),
    () => {
      setOpen(false);
      router.refresh();
    },
  );
  const detail = issue.observed && typeof issue.observed === "object" ? (issue.observed as Record<string, unknown>) : null;
  return (
    <li className="rounded-[12px] border border-[var(--rule)] bg-[var(--paper)] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={issue.severity === "blocker" ? "crit" : "warn"}>{t(`pf.calc.severity.${issue.severity}`)}</Badge>
        {issue.status !== "open" && <Badge tone="ok">{t(`pf.calc.issueStatus.${issue.status}`)}</Badge>}
        {issue.run_kind && <span className="text-[12px] text-[var(--ink-3)]">{t(`pf.calc.kinds.${issue.run_kind}`)}</span>}
        <span className="text-[13.5px] font-medium">{t(`pf.calc.rule.${issue.rule_id}`)}</span>
      </div>
      <p className="mt-1 break-all text-[12px] text-[var(--ink-3)]">
        {issue.target_type === "factor" ? t("pf.calc.factorTarget", { target: issue.target_id }) : issue.target_type === "data_request" ? <a href={`/${lang}/app/tasks/${issue.target_id}`} className="text-[var(--b-700)]">{t("pf.calc.openRequest")}</a> : issue.target_id}
        {detail && (
          <span className="ml-2 font-mono">
            {Object.entries(detail)
              .slice(0, 5)
              .map(([k, v]) => `${k}=${typeof v === "number" ? Number(v.toPrecision(6)) : String(v)}`)
              .join(" · ")}
          </span>
        )}
      </p>
      {issue.resolution && (
        <p className="mt-1 text-[12.5px] text-[var(--ink-2)]">
          {issue.resolution} {issue.resolved_by_name && <span className="text-[var(--ink-3)]">— {issue.resolved_by_name}</span>}
        </p>
      )}
      {issue.status === "open" && issue.severity === "blocker" && <p className="mt-1 text-[12.5px] text-[var(--ink-2)]">{t("pf.calc.blockerHint")}</p>}
      {issue.status === "open" && issue.severity === "warning" && canReview && (
        <div className="mt-2">
          {!open ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}>
              {t("pf.calc.resolve")}
            </Button>
          ) : (
            <form onSubmit={s.submit} className="flex flex-col gap-2">
              <Select label={t("pf.calc.decision")} name={`dec-${issue.id}`} value={decision} onChange={(e) => setDecision(e.target.value)} options={["accepted_exception", "resolved"].map((d) => ({ value: d, label: t(`pf.calc.issueStatus.${d}`) }))} />
              <label htmlFor={`why-${issue.id}`} className="text-[13px] font-medium">
                {t("pf.calc.reason")}
              </label>
              <textarea id={`why-${issue.id}`} className="min-h-[70px] rounded-[10px] border border-[var(--rule)] bg-[var(--paper)] p-2 text-[13.5px]" value={text} onChange={(e) => setText(e.target.value)} minLength={10} maxLength={2000} required />
              <div className="flex gap-2">
                <SubmitButton busy={s.busy} disabled={text.trim().length < 10}>
                  {t("pf.calc.save")}
                </SubmitButton>
                <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
                  {t("pf.calc.cancel")}
                </Button>
              </div>
              <ErrorNote code={s.error} />
            </form>
          )}
        </div>
      )}
    </li>
  );
}

export function FactActions({ factId, status }: { factId: string; status: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const approve = useSubmit(() => api("POST", `/api/v1/facts/${factId}/approve`), () => router.refresh());
  const reject = useSubmit(() => api("POST", `/api/v1/facts/${factId}/reject`, { reason }), () => router.refresh());
  if (!["ready_for_review", "validating"].includes(status)) return null;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {status === "ready_for_review" && (
          <Button type="button" size="sm" onClick={() => approve.submit()} disabled={approve.busy}>
            {t("pf.calc.approve")}
          </Button>
        )}
        <Button type="button" variant="ghost" size="sm" onClick={() => setRejecting(!rejecting)}>
          {t("pf.calc.reject")}
        </Button>
      </div>
      {rejecting && (
        <form onSubmit={reject.submit} className="flex flex-col gap-2">
          <Input label={t("pf.calc.reason")} name={`rej-${factId}`} value={reason} onChange={(e) => setReason(e.target.value)} minLength={10} maxLength={2000} />
          <SubmitButton busy={reject.busy} disabled={reason.trim().length < 10}>
            {t("pf.calc.reject")}
          </SubmitButton>
        </form>
      )}
      <ErrorNote code={approve.error ?? reject.error} />
    </div>
  );
}

export function RunActions({ runId, canReview, ready }: { runId: string; canReview: boolean; ready: number }) {
  const { t } = useI18n();
  const router = useRouter();
  const [rep, setRep] = useState<{ matches: boolean; inputsMatch: boolean; factorsMatch: boolean; observations: number; factors: number; evidence: number } | null>(null);
  const reproduce = useSubmit(() => api<{ matches: boolean; inputsMatch: boolean; factorsMatch: boolean; observations: number; factors: number; evidence: number }>("POST", `/api/v1/calculations/${runId}/reproduce`), setRep);
  const approve = useSubmit(() => api<{ approved: number }>("POST", `/api/v1/calculations/${runId}/approve`), () => router.refresh());
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => reproduce.submit()} disabled={reproduce.busy}>
          <RefreshCcw size={14} aria-hidden /> {t("pf.calc.reproduce")}
        </Button>
        {canReview && ready > 0 && (
          <Button type="button" size="sm" onClick={() => approve.submit()} disabled={approve.busy}>
            <CheckCheck size={14} aria-hidden /> {t("pf.calc.approveAll", { n: ready })}
          </Button>
        )}
      </div>
      {rep && (rep.matches ? <OkNote>{t("pf.calc.reproduced", { o: rep.observations, f: rep.factors, e: rep.evidence })}</OkNote> : <ErrorNote code="reproduce_mismatch" />)}
      <ErrorNote code={reproduce.error ?? approve.error} />
    </div>
  );
}

type SetOption = { id: string; code: string; name: string; edition_year: number | null; licence: string };
type ValueOption = { id: string; kind: string; key: string; label: string | null; value: string; unit: string | null };

/** G4-01: a project's explicit factor for one target, with the reason (kept in the audit trail). */
export function FactorChoiceForm({ projectId, sets, targets }: { projectId: string; sets: SetOption[]; targets: string[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const [target, setTarget] = useState(targets[0] ?? "");
  const [setId, setSetId] = useState("");
  const [values, setValues] = useState<ValueOption[]>([]);
  const [valueId, setValueId] = useState("");
  const [reason, setReason] = useState("");
  const load = async (id: string) => {
    setSetId(id);
    setValueId("");
    setValues([]);
    if (!id) return;
    const r = await api<{ values: ValueOption[] }>("GET", `/api/v1/factor-sets/${id}`);
    if (r.ok) setValues(r.data.values);
  };
  const s = useSubmit(
    () => api("POST", `/api/v1/projects/${projectId}/factor-choices`, { target, factorValueId: valueId, reason: reason || null }),
    () => {
      setReason("");
      router.refresh();
    },
  );
  return (
    <form onSubmit={s.submit} className="flex flex-col gap-3">
      <div className="grid gap-3 md:grid-cols-3">
        <Input label={t("pf.calc.target")} name="fc-target" list="fc-targets" value={target} onChange={(e) => setTarget(e.target.value.trim().toLowerCase())} hint={t("pf.calc.targetHint")} />
        <datalist id="fc-targets">
          {targets.map((x) => (
            <option key={x} value={x} />
          ))}
        </datalist>
        <Select label={t("pf.calc.set")} name="fc-set" value={setId} onChange={(e) => load(e.target.value)} options={[{ value: "", label: "—" }, ...sets.map((x) => ({ value: x.id, label: `${x.name}${x.edition_year ? ` (${x.edition_year})` : ""}` }))]} />
        <Select label={t("pf.calc.value")} name="fc-value" value={valueId} onChange={(e) => setValueId(e.target.value)} options={[{ value: "", label: "—" }, ...values.map((v) => ({ value: v.id, label: `${v.label ?? v.key} — ${Number(v.value)} ${v.unit ?? ""}` }))]} />
      </div>
      <Input label={t("pf.calc.reason")} name="fc-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
      <div>
        <SubmitButton busy={s.busy} disabled={!target || !valueId}>
          {t("pf.calc.choose")}
        </SubmitButton>
      </div>
      <ErrorNote code={s.error} />
    </form>
  );
}

/** A tenant's own factor set in the toolkit CSV format; licensed data only with a rights confirmation. */
export function CustomSetForm() {
  const { t } = useI18n();
  const router = useRouter();
  const [f, setF] = useState({ code: "", name: "", publisher: "", licence: "open", url: "", year: "", csv: "" });
  const [rights, setRights] = useState(false);
  const [done, setDone] = useState<{ factors: number; issues: unknown[] } | null>(null);
  const s = useSubmit(
    () => api<{ setId: string; factors: number; issues: unknown[] }>("POST", "/api/v1/factor-sets", { code: f.code, name: f.name, publisher: f.publisher, licence: f.licence, url: f.url || null, year: f.year ? Number(f.year) : null, csv: f.csv, rightsConfirmed: rights }),
    (d) => {
      setDone(d);
      router.refresh();
    },
  );
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  return (
    <form onSubmit={s.submit} className="flex flex-col gap-3">
      <div className="grid gap-3 md:grid-cols-3">
        <Input label={t("pf.factors.code")} name="fs-code" value={f.code} onChange={set("code")} pattern="[a-z0-9_]{3,40}" hint={t("pf.factors.codeHint")} required />
        <Input label={t("pf.factors.name")} name="fs-name" value={f.name} onChange={set("name")} required />
        <Input label={t("pf.factors.publisher")} name="fs-pub" value={f.publisher} onChange={set("publisher")} required />
        <Select label={t("pf.factors.licence")} name="fs-licence" value={f.licence} onChange={set("licence")} options={["open", "public_sector", "user_licensed"].map((l) => ({ value: l, label: t(`pf.factors.licences.${l}`) }))} />
        <Input label={t("pf.factors.url")} name="fs-url" type="url" value={f.url} onChange={set("url")} />
        <Input label={t("pf.factors.year")} name="fs-year" inputMode="numeric" value={f.year} onChange={set("year")} />
      </div>
      <label htmlFor="fs-csv" className="text-[13px] font-medium">
        {t("pf.factors.csv")}
      </label>
      <textarea id="fs-csv" className="-mt-2 min-h-[120px] rounded-[10px] border border-[var(--rule)] bg-[var(--paper)] p-2 font-mono text-[12.5px]" value={f.csv} onChange={set("csv")} placeholder="kind;key;label;value;unit" required />
      <Check id="fs-rights" checked={rights} onChange={setRights} label={t("pf.factors.rights")} />
      <div>
        <SubmitButton busy={s.busy} disabled={f.licence === "user_licensed" && !rights}>
          {t("pf.factors.add")}
        </SubmitButton>
      </div>
      <ErrorNote code={s.error} />
      {done && <OkNote>{t("pf.factors.added", { n: done.factors, issues: done.issues.length })}</OkNote>}
    </form>
  );
}
