"use client";

/**
 * UX Faz 3: cycle worksheets on screen — the toolkit's calculators, now with a saved, reviewed version per cycle.
 * Results are worked out live from what is on the form (the same pure functions the server uses), so the person
 * sees the effect before saving; only the saved and approved version counts anywhere else.
 */
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useI18n } from "@/i18n/provider";
import { Button, cn } from "@/components/ui";
import { LineChart, MaterialityMatrix, StackedBars } from "@/components/charts";
import { PILLAR_THEME, th } from "@/data/themes";
import { AR_GROUPS } from "@/data/annual-report";
import { taxonomyKpis } from "@/lib/calc/indicators";
import { PILOT_SECTORS } from "@/lib/calc/ets";
import { api } from "../client";
import { Badge, ErrorNote, OkNote } from "../ui";
import { annualReportItems, annualReportStatus, cbamFrom, etsFrom, materialityResult, pathwayFrom, type ApprovedFact } from "@/server/worksheets/compute";
import type { AnnualReportPayload, CbamCostPayload, EtsPayload, MaterialityPayload, PathwayPayload, TaxonomyPayload, WorksheetKind } from "@/server/worksheets/schemas";

export type SheetRow = { id: string; version: number; status: string; entered_by: string; entered_by_name: string | null; approved_by_name: string | null; approved_at: string | null; created_at: string; payload: unknown };

const field = "field-input h-8 w-full min-w-0 text-[12.5px]";
const num = (v: string) => (v.trim() === "" ? 0 : Number(v.replace(/\./g, "").replace(",", ".")));
const newId = () => Math.random().toString(36).slice(2, 10);
/** A short code for a new materiality topic (T1, T2 …): the matrix shows it next to the point. */
const nextCode = (ids: string[]) => {
  let n = 1;
  while (ids.includes(`T${n}`)) n++;
  return `T${n}`;
};

function useSave(cycleId: string, kind: WorksheetKind, reportId?: string) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<number | null>(null);
  const save = async (payload: unknown) => {
    setBusy(true);
    setError(null);
    const r = await api<{ id: string; version: number }>("PUT", `/api/v1/cycles/${cycleId}/worksheets/${kind}`, { payload, reportId: reportId ?? null });
    setBusy(false);
    if (!r.ok) return setError(r.code);
    setSaved(r.data.version);
    router.refresh();
  };
  return { save, busy, error, saved };
}

/** Version, state, who entered and who approved; submit, approve or return (never one's own). */
export function SheetStatus({ current, approved, me, canEdit, canApprove, needsApproval = true }: { current: SheetRow | null; approved: SheetRow | null; me: string; canEdit: boolean; canApprove: boolean; needsApproval?: boolean }) {
  const { t, fmt } = useI18n();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const act = async (path: string, body?: unknown) => {
    setBusy(true);
    setError(null);
    const r = await api("POST", path, body);
    setBusy(false);
    if (!r.ok) return setError(r.code);
    router.refresh();
  };
  if (!current && !approved) return <p className="text-[12.5px] text-[var(--ink-3)]">{t("pf.ws.none")}</p>;
  const tone = (s: string) => (s === "approved" ? "ok" : s === "submitted" ? "info" : "neutral");
  return (
    <div className="flex flex-col gap-2 rounded-[12px] border border-[var(--rule)] bg-[var(--paper)] p-3 text-[13px]">
      {current && (
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={tone(current.status)}>{t(`pf.ws.status.${current.status}`)}</Badge>
          <span>{t("pf.ws.version", { v: current.version })}</span>
          <span className="text-[var(--ink-3)]">· {t("pf.ws.enteredBy", { name: current.entered_by_name ?? "—", date: fmt.date(current.created_at.slice(0, 10)) })}</span>
          {needsApproval && canEdit && current.status === "draft" && (
            <Button size="sm" variant="quiet" disabled={busy} onClick={() => void act(`/api/v1/worksheets/${current.id}/submit`)}>
              {t("pf.ws.submit")}
            </Button>
          )}
          {needsApproval && canApprove && current.status === "submitted" && current.entered_by !== me && (
            <>
              <Button size="sm" variant="primary" disabled={busy} onClick={() => void act(`/api/v1/worksheets/${current.id}/approve`)}>
                {t("pf.ws.approve")}
              </Button>
              <input aria-label={t("pf.ws.returnReason")} placeholder={t("pf.ws.returnReason")} className="field-input h-8 w-56 text-[12.5px]" value={reason} onChange={(e) => setReason(e.target.value)} />
              <Button size="sm" variant="ghost" disabled={busy || reason.trim().length < 10} onClick={() => void act(`/api/v1/worksheets/${current.id}/return`, { reason })}>
                {t("pf.ws.return")}
              </Button>
            </>
          )}
          {needsApproval && current.status === "submitted" && current.entered_by === me && <span className="text-[12px] text-[var(--ink-3)]">{t("pf.ws.waitingOther")}</span>}
        </div>
      )}
      {needsApproval && approved && approved.id !== current?.id && (
        <div className="text-[12.5px] text-[var(--ink-2)]">{t("pf.ws.approvedLine", { v: approved.version, name: approved.approved_by_name ?? "—", date: approved.approved_at ? fmt.date(approved.approved_at.slice(0, 10)) : "—" })}</div>
      )}
      <ErrorNote code={error} />
    </div>
  );
}

function SaveRow({ busy, error, saved, onSave, canEdit }: { busy: boolean; error: string | null; saved: number | null; onSave: () => void; canEdit: boolean }) {
  const { t } = useI18n();
  if (!canEdit) return <p className="text-[12.5px] text-[var(--ink-3)]">{t("pf.state.read_only")}</p>;
  return (
    <div className="flex flex-col gap-2">
      <ErrorNote code={error} />
      {saved !== null && !error && <OkNote>{t("pf.ws.saved", { v: saved })}</OkNote>}
      <div>
        <Button variant="primary" disabled={busy} onClick={onSave}>
          {t("pf.ws.save")}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- materiality (step 1)

const ESRS = ["E1", "E2", "E3", "E4", "E5", "S1", "S2", "S3", "S4", "G1"] as const;
const SCORES = ["scale", "scope", "irremediability", "impactLikelihood", "magnitude", "financialLikelihood"] as const;

export function MaterialityEditor({ cycleId, initial, canEdit }: { cycleId: string; initial: MaterialityPayload | null; canEdit: boolean }) {
  const { t, fmt } = useI18n();
  const [p, setP] = useState<MaterialityPayload>(
    () =>
      initial ?? {
        threshold: 3,
        topics: ESRS.map((id) => ({ id, name: t(`mat.topics.${id}`), pillar: id[0] as "E" | "S" | "G", positive: false, scale: 1, scope: 1, irremediability: 1, impactLikelihood: 1, magnitude: 1, financialLikelihood: 1 })),
      },
  );
  const s = useSave(cycleId, "materiality");
  const r = useMemo(() => materialityResult(p), [p]);
  const set = (i: number, patch: Partial<MaterialityPayload["topics"][number]>) => setP({ ...p, topics: p.topics.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-5">
        <div className="-mx-1 overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-left text-[12.5px]">
            <caption className="sr-only">{t("mat.ranking")}</caption>
            <thead>
              <tr className="border-b border-[var(--rule)] text-[11px] uppercase tracking-[0.05em] text-[var(--ink-3)]">
                <th scope="col" className="px-1.5 py-2">{t("mat.topic")}</th>
                <th scope="col" className="px-1.5 py-2">{t("pf.mat.pillar")}</th>
                <th scope="col" className="px-1.5 py-2">{t("mat.positive")}</th>
                {SCORES.map((k) => (
                  <th key={k} scope="col" className="px-1.5 py-2">{t(`mat.${k}`)}</th>
                ))}
                <th scope="col" className="px-1.5 py-2">{t("mat.result_col")}</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {p.topics.map((x, i) => (
                <tr key={x.id} className="border-b border-[var(--rule)] align-top">
                  <td className="px-1.5 py-1.5">
                    <input aria-label={t("mat.topic")} className={field} value={x.name} disabled={!canEdit} onChange={(e) => set(i, { name: e.target.value })} />
                  </td>
                  <td className="px-1.5 py-1.5">
                    <select aria-label={t("pf.mat.pillar")} className={field} value={x.pillar} disabled={!canEdit} onChange={(e) => set(i, { pillar: e.target.value as "E" | "S" | "G" })}>
                      {["E", "S", "G"].map((v) => (
                        <option key={v} value={v}>
                          {t(`pf.mat.pillars.${v}`)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-1.5 py-1.5 text-center">
                    <input type="checkbox" aria-label={t("mat.positive")} checked={x.positive} disabled={!canEdit} onChange={(e) => set(i, { positive: e.target.checked })} />
                  </td>
                  {SCORES.map((k) => (
                    <td key={k} className="px-1.5 py-1.5">
                      <select aria-label={`${x.name} — ${t(`mat.${k}`)}`} className={cn(field, "w-14")} value={x[k]} disabled={!canEdit || (k === "irremediability" && x.positive)} onChange={(e) => set(i, { [k]: Number(e.target.value) })}>
                        {[1, 2, 3, 4, 5].map((v) => (
                          <option key={v} value={v}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </td>
                  ))}
                  <td className="px-1.5 py-1.5 whitespace-nowrap">
                    <Badge tone={r.rows[i].material ? "warn" : "neutral"}>{t(`mat.kind_${r.rows[i].kind}`)}</Badge>
                    <span className="block text-[11px] text-[var(--ink-3)]">
                      {fmt.number(r.rows[i].impact, 1)} / {fmt.number(r.rows[i].financial, 1)}
                    </span>
                  </td>
                  <td className="px-1 py-1.5">
                    {canEdit && p.topics.length > 1 && (
                      <button type="button" aria-label={t("pf.ws.remove")} className="rounded p-1 text-[var(--ink-3)] hover:text-[var(--crit)]" onClick={() => setP({ ...p, topics: p.topics.filter((_, j) => j !== i) })}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {canEdit && (
            <button type="button" className="mt-2 inline-flex items-center gap-1 text-[13px] font-medium text-[var(--b-700)]" onClick={() => setP({ ...p, topics: [...p.topics, { id: nextCode(p.topics.map((x) => x.id)), name: t("pf.mat.newTopic"), pillar: "E", positive: false, scale: 1, scope: 1, irremediability: 1, impactLikelihood: 1, magnitude: 1, financialLikelihood: 1 }] })}>
              <Plus size={14} /> {t("pf.mat.addTopic")}
            </button>
          )}
        </div>
        <div className="grid gap-5 md:grid-cols-[minmax(0,520px)_minmax(0,1fr)] md:items-start">
          <div className="flex flex-col gap-3">
            <label className="flex items-center gap-2 text-[13px]">
              {t("mat.thresholdLabel")}
              <input type="number" min={1} max={5} step={0.5} className="field-input h-8 w-20 text-[12.5px]" value={p.threshold} disabled={!canEdit} onChange={(e) => setP({ ...p, threshold: Number(e.target.value) || 1 })} />
            </label>
            <MaterialityMatrix
              label={t("mat.chart")}
              threshold={p.threshold}
              xLabel={t("mat.xAxis")}
              yLabel={t("mat.yAxis")}
              points={r.rows.map((x) => ({ id: x.id, label: x.name, x: x.financial, y: x.impact, color: th(PILLAR_THEME[x.pillar]), material: x.material }))}
            />
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="text-[13.5px] font-semibold">{t("pf.mat.materialList", { n: r.material.length })}</h3>
            {r.material.length ? (
              <ol className="flex flex-col gap-1 text-[13px]">
                {r.material.map((m) => (
                  <li key={m.id} className="flex items-baseline justify-between gap-3 border-b border-[var(--rule)] py-1">
                    <span>{m.name}</span>
                    <span className="text-[12px] text-[var(--ink-3)]">{t(`mat.kind_${m.kind}`)} · {fmt.number(m.impact, 1)} / {fmt.number(m.financial, 1)}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-[12.5px] text-[var(--ink-3)]">—</p>
            )}
          </div>
        </div>
      </div>
      <SaveRow {...s} canEdit={canEdit} onSave={() => void s.save(p)} />
    </div>
  );
}

// ---------------------------------------------------------------- taxonomy (step 3)

export function TaxonomyEditor({ cycleId, initial, canEdit }: { cycleId: string; initial: TaxonomyPayload | null; canEdit: boolean }) {
  const { t, fmt } = useI18n();
  const [p, setP] = useState<TaxonomyPayload>(() => initial ?? { totals: { turnover: 0, capex: 0, opex: 0 }, activities: [], notAssessed: [] });
  const s = useSave(cycleId, "taxonomy");
  const k = useMemo(() => taxonomyKpis(p.activities, p.totals, p.notAssessed), [p]);
  const set = (i: number, patch: Partial<TaxonomyPayload["activities"][number]>) =>
    setP({ ...p, activities: p.activities.map((a, j) => (j === i ? { ...a, ...patch, aligned: (patch.eligible ?? a.eligible) && (patch.aligned ?? a.aligned) } : a)) });
  const toggleNa = (id: string, on: boolean) => setP({ ...p, notAssessed: on ? [...p.notAssessed, id] : p.notAssessed.filter((x) => x !== id) });
  return (
    <div className="flex flex-col gap-5">
      <fieldset className="grid gap-3 sm:grid-cols-3" disabled={!canEdit}>
        <legend className="label mb-1">{t("tax.totals")}</legend>
        {(["turnover", "capex", "opex"] as const).map((key) => (
          <label key={key} className="flex flex-col gap-1 text-[12.5px]">
            {t(`tax.${key}`)} (TRY)
            <input inputMode="decimal" className="field-input h-9 text-[13px]" defaultValue={p.totals[key] || ""} onBlur={(e) => setP({ ...p, totals: { ...p.totals, [key]: num(e.target.value) } })} />
          </label>
        ))}
      </fieldset>
      <div className="-mx-1 overflow-x-auto">
        <table className="w-full min-w-[860px] border-collapse text-left text-[12.5px]">
          <caption className="sr-only">{t("tax.activity")}</caption>
          <thead>
            <tr className="border-b border-[var(--rule)] text-[11px] uppercase tracking-[0.05em] text-[var(--ink-3)]">
              <th className="px-1.5 py-2">{t("tax.activity")}</th>
              <th className="px-1.5 py-2">{t("tax.code")}</th>
              <th className="px-1.5 py-2">{t("tax.turnover")}</th>
              <th className="px-1.5 py-2">{t("tax.capex")}</th>
              <th className="px-1.5 py-2">{t("tax.opex")}</th>
              <th className="px-1.5 py-2">{t("tax.eligible")}</th>
              <th className="px-1.5 py-2">{t("tax.aligned")}</th>
              <th className="px-1.5 py-2">{t("tax.notAssessed")}</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {p.activities.map((a, i) => (
              <tr key={a.id} className="border-b border-[var(--rule)]">
                <td className="px-1.5 py-1.5">
                  <input aria-label={t("tax.activity")} className={cn(field, "min-w-[220px]")} value={a.name} disabled={!canEdit} onChange={(e) => set(i, { name: e.target.value })} />
                </td>
                <td className="px-1.5 py-1.5">
                  <input aria-label={t("tax.code")} className={cn(field, "w-20")} value={a.code} disabled={!canEdit} onChange={(e) => set(i, { code: e.target.value })} />
                </td>
                {(["turnover", "capex", "opex"] as const).map((key) => (
                  <td key={key} className="px-1.5 py-1.5">
                    <input aria-label={`${a.name} — ${t(`tax.${key}`)}`} inputMode="decimal" className={cn(field, "w-28")} defaultValue={a[key] || ""} disabled={!canEdit} onBlur={(e) => set(i, { [key]: num(e.target.value) })} />
                  </td>
                ))}
                <td className="px-1.5 py-1.5 text-center">
                  <input type="checkbox" aria-label={t("tax.eligible")} checked={a.eligible} disabled={!canEdit} onChange={(e) => set(i, { eligible: e.target.checked })} />
                </td>
                <td className="px-1.5 py-1.5 text-center">
                  <input type="checkbox" aria-label={t("tax.aligned")} checked={a.aligned} disabled={!canEdit || !a.eligible} onChange={(e) => set(i, { aligned: e.target.checked })} />
                </td>
                <td className="px-1.5 py-1.5 text-center">
                  <input type="checkbox" aria-label={t("tax.notAssessed")} checked={p.notAssessed.includes(a.id)} disabled={!canEdit || !a.eligible} onChange={(e) => toggleNa(a.id, e.target.checked)} />
                </td>
                <td className="px-1 py-1.5">
                  {canEdit && (
                    <button type="button" aria-label={t("pf.ws.remove")} className="rounded p-1 text-[var(--ink-3)] hover:text-[var(--crit)]" onClick={() => setP({ ...p, activities: p.activities.filter((_, j) => j !== i), notAssessed: p.notAssessed.filter((x) => x !== a.id) })}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {canEdit && (
          <button type="button" className="mt-2 inline-flex items-center gap-1 text-[13px] font-medium text-[var(--b-700)]" onClick={() => setP({ ...p, activities: [...p.activities, { id: newId(), name: t("tax.newActivity"), code: "", turnover: 0, capex: 0, opex: 0, eligible: true, aligned: false }] })}>
            <Plus size={14} /> {t("tax.addActivity")}
          </button>
        )}
      </div>
      <div className="-mx-1 overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-left text-[13px]">
          <caption className="label mb-1 text-left">{t("pf.tax.kpis")}</caption>
          <thead>
            <tr className="border-b border-[var(--rule)] text-[11px] uppercase tracking-[0.05em] text-[var(--ink-3)]">
              <th className="px-2 py-2" />
              <th className="px-2 py-2">{t("tax.eligible")}</th>
              <th className="px-2 py-2">{t("tax.aligned")}</th>
              <th className="px-2 py-2">{t("tax.notAssessed")}</th>
              <th className="px-2 py-2">{t("pf.tax.notEligible")}</th>
            </tr>
          </thead>
          <tbody>
            {(["turnover", "capex", "opex"] as const).map((key) => (
              <tr key={key} className="border-b border-[var(--rule)]">
                <th scope="row" className="px-2 py-2 text-left font-medium">{t(`tax.${key}`)}</th>
                <td className="px-2 py-2 tabular-nums">{p.totals[key] > 0 ? fmt.percent(k[key].eligible) : "—"}</td>
                <td className="px-2 py-2 tabular-nums">{p.totals[key] > 0 ? fmt.percent(k[key].aligned) : "—"}</td>
                <td className={cn("px-2 py-2 tabular-nums", p.totals[key] > 0 && !k[key].notAssessedWithinCap && "font-semibold text-[var(--crit)]")}>{p.totals[key] > 0 ? fmt.percent(k[key].notAssessed) : "—"}</td>
                <td className="px-2 py-2 tabular-nums">{p.totals[key] > 0 ? fmt.percent(k[key].notEligible) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-1 text-[12px] text-[var(--ink-3)]">{t("tax.capNote")}</p>
      </div>
      <SaveRow {...s} canEdit={canEdit} onSave={() => void s.save(p)} />
    </div>
  );
}

export function RunTaxonomy({ cycleId }: { cycleId: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ facts: number; reused: boolean; runId: string } | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <div>
        <Button
          variant="primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            const r = await api<{ runId: string; reused: boolean; facts: number }>("POST", `/api/v1/cycles/${cycleId}/taxonomy-run`);
            setBusy(false);
            if (!r.ok) return setError(r.code);
            setDone(r.data);
            router.refresh();
          }}
        >
          {t("pf.tax.run")}
        </Button>
      </div>
      <ErrorNote code={error} />
      {done && <OkNote>{done.reused ? t("pf.tax.runReused") : t("pf.tax.runDone", { n: done.facts })}</OkNote>}
    </div>
  );
}

// ---------------------------------------------------------------- annual report checklist (step 6)

export function ArChecklist({ cycleId, reportId, initial, defaultProfile, canEdit }: { cycleId: string; reportId: string; initial: AnnualReportPayload | null; defaultProfile: AnnualReportPayload["profile"]; canEdit: boolean }) {
  const { t } = useI18n();
  const [p, setP] = useState<AnnualReportPayload>(() => initial ?? { profile: defaultProfile, items: {} });
  const s = useSave(cycleId, "annual_report", reportId);
  const items = annualReportItems(p.profile);
  const st = annualReportStatus(p);
  const set = (id: string, patch: Partial<AnnualReportPayload["items"][string]> | null) => {
    const next = { ...p.items };
    if (patch === null) delete next[id];
    else next[id] = { ...(next[id] ?? { status: "met" as const }), ...patch };
    setP({ ...p, items: next });
  };
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3 text-[13px]">
        <label className="flex items-center gap-2">
          {t("ar.profileLabel")}
          <select className="field-input h-8 text-[12.5px]" value={p.profile} disabled={!canEdit} onChange={(e) => setP({ ...p, profile: e.target.value as AnnualReportPayload["profile"] })}>
            {(["ttk", "listed", "bank"] as const).map((v) => (
              <option key={v} value={v}>
                {t(`ar.profile.${v}`)}
              </option>
            ))}
          </select>
        </label>
        <span>{t("pf.arc.summary", { met: st.met, na: st.na, missing: st.missing, open: st.unmarked + st.naWithoutReason, total: st.total })}</span>
        <Badge tone={st.complete ? "ok" : "warn"}>{st.complete ? t("pf.arc.complete") : t("pf.arc.incomplete")}</Badge>
      </div>
      {AR_GROUPS.map((g) => {
        const rows = items.filter((i) => i.group === g);
        if (!rows.length) return null;
        return (
          <div key={g} className="flex flex-col gap-1">
            <h3 className="text-[13.5px] font-semibold">{t(`ar.groups.${g}`)}</h3>
            <ul className="flex flex-col divide-y divide-[var(--rule)]">
              {rows.map((i) => {
                const v = p.items[i.id];
                return (
                  <li key={i.id} className="grid gap-2 py-2 text-[13px] md:grid-cols-[minmax(0,1fr)_150px_minmax(0,260px)] md:items-center">
                    <span>
                      {t(`ar.items.${i.id}`)} <span className="text-[11.5px] text-[var(--ink-3)]">· {i.ref}</span>
                    </span>
                    <select aria-label={t(`ar.items.${i.id}`)} className={field} value={v?.status ?? ""} disabled={!canEdit} onChange={(e) => set(i.id, e.target.value ? { status: e.target.value as "met" | "na" | "missing" } : null)}>
                      <option value="">{t("pf.arc.unmarked")}</option>
                      {(["met", "na", "missing"] as const).map((x) => (
                        <option key={x} value={x}>
                          {t(`pf.arc.status.${x}`)}
                        </option>
                      ))}
                    </select>
                    <input aria-label={t("pf.arc.note")} placeholder={v?.status === "na" ? t("pf.arc.naReason") : t("pf.arc.note")} className={cn(field, v?.status === "na" && !v.note?.trim() && "border-[var(--crit)]")} value={v?.note ?? ""} disabled={!canEdit || !v} onChange={(e) => set(i.id, { note: e.target.value })} />
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
      <SaveRow {...s} canEdit={canEdit} onSave={() => void s.save(p)} />
    </div>
  );
}

// ---------------------------------------------------------------- analysis (alongside the cycle)

type AnalysisProps = { cycleId: string; canEdit: boolean; facts: ApprovedFact[] };

function NumberIn({ label, value, onChange, step = "any", hint, disabled }: { label: string; value: number | null; onChange: (v: number | null) => void; step?: string; hint?: string; disabled?: boolean }) {
  return (
    <label className="flex flex-col gap-1 text-[12.5px]">
      {label}
      <input type="number" step={step} className="field-input h-9 text-[13px]" value={value ?? ""} disabled={disabled} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} />
      {hint && <span className="text-[11.5px] text-[var(--ink-3)]">{hint}</span>}
    </label>
  );
}

export function PathwayAnalysis({ cycleId, canEdit, facts, baseFacts, year, initial }: AnalysisProps & { baseFacts: ApprovedFact[] | null; year: number; initial: PathwayPayload | null }) {
  const { t, fmt } = useI18n();
  const [p, setP] = useState<PathwayPayload>(() => initial ?? { baseYear: year, baseScope12: null, baseScope3: null, scope2Share: null, targetYear: 2030, bauGrowth: 0.01, measures: [] });
  const s = useSave(cycleId, "pathway");
  const r = useMemo(() => pathwayFrom(p, { year, facts }, baseFacts), [p, year, facts, baseFacts]);
  const setM = (i: number, patch: Partial<PathwayPayload["measures"][number]>) => setP({ ...p, measures: p.measures.map((m, j) => (j === i ? { ...m, ...patch } : m)) });
  const tco2 = (v: number) => `${fmt.number(v, 0)} tCO₂e`;
  return (
    <div className="flex flex-col gap-5">
      <fieldset className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6" disabled={!canEdit}>
        <NumberIn label={t("pathway.baseYear")} value={p.baseYear} step="1" onChange={(v) => setP({ ...p, baseYear: v ?? year })} />
        <NumberIn label={t("pathway.targetYear")} value={p.targetYear} step="1" onChange={(v) => setP({ ...p, targetYear: v ?? 2030 })} />
        <NumberIn label={t("pathway.baseS12")} value={p.baseScope12} hint={t("pf.an.fromBaseCycle")} onChange={(v) => setP({ ...p, baseScope12: v })} />
        <NumberIn label={t("pathway.baseS3")} value={p.baseScope3} hint={t("pf.an.fromBaseCycle")} onChange={(v) => setP({ ...p, baseScope3: v })} />
        <NumberIn label={t("pathway.scope2Share")} value={p.scope2Share} hint={t("pathway.scope2ShareHint")} onChange={(v) => setP({ ...p, scope2Share: v })} />
        <NumberIn label={t("pathway.bau")} value={p.bauGrowth} onChange={(v) => setP({ ...p, bauGrowth: v ?? 0 })} />
      </fieldset>
      <div className="-mx-1 overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left text-[12.5px]">
          <caption className="label mb-1 text-left">{t("pf.an.measures")}</caption>
          <thead>
            <tr className="border-b border-[var(--rule)] text-[11px] uppercase tracking-[0.05em] text-[var(--ink-3)]">
              <th className="px-1.5 py-2">{t("pathway.measureName")}</th>
              <th className="px-1.5 py-2">{t("pathway.abatement")}</th>
              <th className="px-1.5 py-2">{t("pathway.cost")}</th>
              <th className="px-1.5 py-2">{t("pathway.start")}</th>
              <th className="px-1.5 py-2">{t("pathway.ramp")}</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {p.measures.map((m, i) => (
              <tr key={m.id} className="border-b border-[var(--rule)]">
                <td className="px-1.5 py-1.5">
                  <input aria-label={t("pathway.measureName")} className={field} value={m.name} disabled={!canEdit} onChange={(e) => setM(i, { name: e.target.value })} />
                </td>
                {(["abatement", "cost", "startYear", "rampYears"] as const).map((k) => (
                  <td key={k} className="px-1.5 py-1.5">
                    <input type="number" aria-label={`${m.name} — ${k}`} className={cn(field, "w-28")} value={m[k]} disabled={!canEdit} onChange={(e) => setM(i, { [k]: Number(e.target.value) })} />
                  </td>
                ))}
                <td className="px-1 py-1.5">
                  {canEdit && (
                    <button type="button" aria-label={t("pf.ws.remove")} className="rounded p-1 text-[var(--ink-3)] hover:text-[var(--crit)]" onClick={() => setP({ ...p, measures: p.measures.filter((_, j) => j !== i) })}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {canEdit && (
          <button type="button" className="mt-2 inline-flex items-center gap-1 text-[13px] font-medium text-[var(--b-700)]" onClick={() => setP({ ...p, measures: [...p.measures, { id: newId(), name: t("pf.an.newMeasure"), abatement: 0, cost: 0, startYear: year, rampYears: 1 }] })}>
            <Plus size={14} /> {t("pathway.addMeasure")}
          </button>
        )}
      </div>
      {"missing" in r ? (
        <p className="text-[13px] text-[var(--ink-2)]">{t("pf.an.noBase")}</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="glass p-3">
              <span className="text-[12px] text-[var(--ink-3)]">{t("pathway.figBase")}</span>
              <span className="block text-[20px] font-semibold tabular-nums">{tco2(r.base.scope12 + r.base.scope3)}</span>
              <span className="text-[11.5px] text-[var(--ink-3)]">{r.base.fromCycle ? t("pf.an.baseFromCycle") : t("pf.an.baseTyped")}</span>
            </div>
            <div className="glass p-3">
              <span className="text-[12px] text-[var(--ink-3)]">{t("pf.an.actual", { year })}</span>
              <span className="block text-[20px] font-semibold tabular-nums">{r.actual ? tco2(r.actual.value) : "—"}</span>
            </div>
            <div className="glass p-3">
              <span className="text-[12px] text-[var(--ink-3)]">{t("pathway.gapLabel")}</span>
              <span className={cn("block text-[20px] font-semibold tabular-nums", r.gap > 0 ? "text-[var(--crit)]" : "text-[var(--ok)]")}>{tco2(r.gap)}</span>
            </div>
          </div>
          <LineChart
            label={t("pathway.chart")}
            x={r.rows.map((x) => x.year)}
            yFormat={(v) => fmt.compact(v)}
            markers={[{ x: p.targetYear, label: t("pathway.markerTarget") }]}
            series={[
              { id: "bau", label: t("pf.an.bau"), values: r.rows.map((x) => x.bau), color: "var(--ink-3)", dash: true },
              { id: "plan", label: t("pathway.withMeasures"), values: r.rows.map((x) => x.withMeasures), color: "var(--b-600)", width: 2.5 },
              { id: "t15", label: t("pathway.band15"), values: r.rows.map((x) => x.target15), color: "var(--ok)" },
              { id: "nz", label: t("pathway.netZero"), values: r.rows.map((x) => x.netZero), color: "var(--ink-2)", dash: true },
              ...(r.actual ? [{ id: "act", label: t("pathway.actualsLegend"), values: r.rows.map((x) => (x.year === r.actual!.year ? r.actual!.value : null)), color: "var(--crit)", width: 3 }] : []),
            ]}
          />
        </>
      )}
      <SaveRow {...s} canEdit={canEdit} onSave={() => void s.save(p)} />
    </div>
  );
}

export function EtsAnalysis({ cycleId, canEdit, facts, year, initial }: AnalysisProps & { year: number; initial: EtsPayload | null }) {
  const { t, fmt } = useI18n();
  const [p, setP] = useState<EtsPayload>(() => initial ?? { sector: "other", emissions: null, emissionsGrowth: 0, activity: 0, activityGrowth: 0, benchmark: 0, freeRate: 1, coefficient: 1, price: 0, priceGrowth: 0 });
  const s = useSave(cycleId, "ets");
  const r = useMemo(() => etsFrom(p, facts, year), [p, facts, year]);
  return (
    <div className="flex flex-col gap-5">
      <fieldset className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5" disabled={!canEdit}>
        <label className="flex flex-col gap-1 text-[12.5px]">
          {t("ets.sector")}
          <select className="field-input h-9 text-[13px]" value={p.sector} onChange={(e) => setP({ ...p, sector: e.target.value as EtsPayload["sector"] })}>
            {[...PILOT_SECTORS, "other"].map((v) => (
              <option key={v} value={v}>
                {t(`pf.an.sectors.${v}`)}
              </option>
            ))}
          </select>
        </label>
        <NumberIn label={t("ets.emissions")} value={p.emissions} hint={t("pf.an.fromApproved")} onChange={(v) => setP({ ...p, emissions: v })} />
        <NumberIn label={t("ets.emissionsGrowth")} value={p.emissionsGrowth} onChange={(v) => setP({ ...p, emissionsGrowth: v ?? 0 })} />
        <NumberIn label={t("ets.activity")} value={p.activity} onChange={(v) => setP({ ...p, activity: v ?? 0 })} />
        <NumberIn label={t("ets.activityGrowth")} value={p.activityGrowth} onChange={(v) => setP({ ...p, activityGrowth: v ?? 0 })} />
        <NumberIn label={t("ets.benchmark")} value={p.benchmark} hint={t("ets.benchmarkHint")} onChange={(v) => setP({ ...p, benchmark: v ?? 0 })} />
        <NumberIn label={t("ets.rate")} value={p.freeRate} onChange={(v) => setP({ ...p, freeRate: v ?? 0 })} />
        <NumberIn label={t("ets.coefficient")} value={p.coefficient} onChange={(v) => setP({ ...p, coefficient: v ?? 0 })} />
        <NumberIn label={t("ets.priceStart")} value={p.price} hint={t("ets.priceHint")} onChange={(v) => setP({ ...p, price: v ?? 0 })} />
        <NumberIn label={t("ets.priceGrowth")} value={p.priceGrowth} onChange={(v) => setP({ ...p, priceGrowth: v ?? 0 })} />
      </fieldset>
      {"missing" in r ? (
        <p className="text-[13px] text-[var(--ink-2)]">{t("pf.an.noEmissions")}</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="glass p-3">
              <span className="text-[12px] text-[var(--ink-3)]">{t("ets.category")}</span>
              <span className="block text-[20px] font-semibold">{r.category}</span>
              <span className="text-[11.5px] text-[var(--ink-3)]">{r.covered ? t("ets.inEts") : t("ets.mrvOnly")}</span>
            </div>
            <div className="glass p-3">
              <span className="text-[12px] text-[var(--ink-3)]">{t("ets.emissions")}</span>
              <span className="block text-[20px] font-semibold tabular-nums">{fmt.number(r.emissions, 0)} tCO₂e</span>
              <span className="text-[11.5px] text-[var(--ink-3)]">{t(`pf.an.source.${r.source}`)}</span>
            </div>
            <div className="glass p-3">
              <span className="text-[12px] text-[var(--ink-3)]">{t("ets.figCost")}</span>
              <span className="block text-[20px] font-semibold tabular-nums">{fmt.currency(r.years.reduce((x, y) => x + y.cost, 0), "TRY")}</span>
              <span className="text-[11.5px] text-[var(--ink-3)]">{t("pf.an.years", { from: r.years[0].year, to: r.years.at(-1)!.year })}</span>
            </div>
          </div>
          <StackedBars
            label={t("ets.chart")}
            categories={r.years.map((y) => String(y.year))}
            yFormat={(v) => fmt.compact(v)}
            stacks={[
              { id: "alloc", label: t("ets.legendAllocation"), values: r.years.map((y) => Math.min(y.allocation, y.emissions)), color: "var(--b-400)" },
              { id: "deficit", label: t("ets.legendDeficit"), values: r.years.map((y) => y.deficit), color: "var(--crit)" },
            ]}
          />
        </>
      )}
      <SaveRow {...s} canEdit={canEdit} onSave={() => void s.save(p)} />
    </div>
  );
}

export function CbamAnalysis({ cycleId, canEdit, facts, initial }: AnalysisProps & { initial: CbamCostPayload | null }) {
  const { t, fmt } = useI18n();
  const [p, setP] = useState<CbamCostPayload>(() => initial ?? { startPrice: 80, priceGrowth: 0.05, originCarbonPrice: 0, eurTry: 0, growth: 0 });
  const s = useSave(cycleId, "cbam_cost");
  const r = useMemo(() => cbamFrom(p, facts), [p, facts]);
  return (
    <div className="flex flex-col gap-5">
      <fieldset className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5" disabled={!canEdit}>
        <NumberIn label={t("cbam.startPrice")} value={p.startPrice} hint={t("cbam.startPriceHint")} onChange={(v) => setP({ ...p, startPrice: v ?? 0 })} />
        <NumberIn label={t("cbam.priceGrowth")} value={p.priceGrowth} onChange={(v) => setP({ ...p, priceGrowth: v ?? 0 })} />
        <NumberIn label={t("cbam.originPrice")} value={p.originCarbonPrice} hint={t("cbam.originPriceHint")} onChange={(v) => setP({ ...p, originCarbonPrice: v ?? 0 })} />
        <NumberIn label={t("cbam.eurTry")} value={p.eurTry} onChange={(v) => setP({ ...p, eurTry: v ?? 0 })} />
        <NumberIn label={t("cbam.growth")} value={p.growth} onChange={(v) => setP({ ...p, growth: v ?? 0 })} />
      </fieldset>
      {"missing" in r ? (
        <p className="text-[13px] text-[var(--ink-2)]">{t("pf.an.noCbam")}</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="glass p-3">
              <span className="text-[12px] text-[var(--ink-3)]">{t("cbam.fig2026")}</span>
              <span className="block text-[20px] font-semibold tabular-nums">{fmt.currency(r.years[0].cost)}</span>
            </div>
            <div className="glass p-3">
              <span className="text-[12px] text-[var(--ink-3)]">{t("cbam.fig2030")}</span>
              <span className="block text-[20px] font-semibold tabular-nums">{fmt.currency(r.years.find((y) => y.year === 2030)?.cost ?? 0)}</span>
            </div>
            <div className="glass p-3">
              <span className="text-[12px] text-[var(--ink-3)]">{t("cbam.figTotal")}</span>
              <span className="block text-[20px] font-semibold tabular-nums">{fmt.currency(r.years.reduce((x, y) => x + y.cost, 0))}</span>
              {p.eurTry > 0 && <span className="text-[11.5px] text-[var(--ink-3)]">≈ {fmt.currency(r.years.reduce((x, y) => x + y.cost, 0) * p.eurTry, "TRY")}</span>}
            </div>
          </div>
          <LineChart
            label={t("cbam.chartCost")}
            x={r.years.map((y) => y.year)}
            yFormat={(v) => fmt.compact(v)}
            series={[
              { id: "cost", label: t("cbam.legendCost"), values: r.years.map((y) => y.cost), color: "var(--b-600)", width: 2.5 },
              { id: "def", label: t("cbam.legendDefault"), values: r.years.map((y) => y.costDefault), color: "var(--ink-3)", dash: true },
            ]}
          />
          <p className="text-[12px] text-[var(--ink-3)]">{t("pf.an.cbamProducts", { n: r.products.length, cn: r.products.map((x) => x.cn).join(", ") })}</p>
        </>
      )}
      <SaveRow {...s} canEdit={canEdit} onSave={() => void s.save(p)} />
    </div>
  );
}
