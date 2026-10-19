"use client";

/**
 * PORT-10/11: reporting boundaries per kind (rule suggestion → reasoned changes → approval; a new revision keeps
 * the approved one in force) and applicability (engine suggestion with sources → named decision → customer
 * confirmation). Suggestions never become legal conclusions on their own (plan 07).
 */
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/i18n/provider";
import { Button, StatusMark } from "@/components/ui";
import { SourceNote } from "@/components/figure";
import type { Profile } from "@/lib/calc/applicability";
import { CBAM_SECTORS } from "@/lib/calc/cbam";
import { PILOT_SECTORS } from "@/lib/calc/ets";
import { api } from "../client";
import { Badge, Check, ErrorNote, Input, OkNote, Select, SubmitButton, useSubmit } from "../ui";

export type BoundaryView = {
  id: string;
  kind: string;
  revision: number;
  status: string;
  as_of: string;
  approved_at: string | Date | null;
  approved_by_name: string | null;
  members: { id: string; legal_entity_id: string | null; facility_id: string | null; included: boolean; inclusion_pct: string; suggested_pct: string | null; reason: string | null; entity_name: string | null; facility_name: string | null }[];
};

const KINDS = ["ghg_operational_control", "ghg_financial_control", "ghg_equity_share", "financial_reporting", "cbam_facility_product"];

function MemberRow({ m, editable }: { m: BoundaryView["members"][number]; editable: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pct, setPct] = useState(Number(m.inclusion_pct));
  const [reason, setReason] = useState("");
  const changed = pct !== Number(m.inclusion_pct);
  const s = useSubmit(() => api("PATCH", `/api/v1/boundary-members/${m.id}`, { inclusionPct: pct, reason: reason.trim() || null }), () => router.refresh());
  const differs = m.suggested_pct !== null && Number(m.inclusion_pct) !== Number(m.suggested_pct);
  const reasonKey = m.reason && /^[a-z_]+$/.test(m.reason) ? `pf.scope.reason.${m.reason}` : null;
  return (
    <tr className="align-top">
      <td className="border-b border-[var(--rule)] px-2 py-2">
        {m.facility_id ? <span className="pl-4 text-[13px]">↳ {m.facility_name}</span> : <span className="font-medium">{m.entity_name}</span>}
      </td>
      <td className="border-b border-[var(--rule)] px-2 py-2 num">{editable ? <input aria-label={t("pf.scope.pct")} type="number" min={0} max={100} step="0.01" className="field-input h-8 w-24 text-[13px]" value={pct} onChange={(e) => setPct(Number(e.target.value))} /> : `%${Number(m.inclusion_pct)}`}</td>
      <td className="border-b border-[var(--rule)] px-2 py-2 text-[12.5px] text-[var(--ink-2)]">
        {reasonKey ? t(reasonKey) : m.reason}
        {differs && <span className="ml-1 text-[var(--warn)]">({t("pf.scope.changedFrom", { pct: Number(m.suggested_pct) })})</span>}
        {editable && changed && (
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <input aria-label={t("pf.scope.reasonLabel")} placeholder={t("pf.scope.reasonLabel")} className="field-input h-8 w-60 text-[12.5px]" value={reason} onChange={(e) => setReason(e.target.value)} />
            <Button size="sm" variant="primary" disabled={s.busy} onClick={() => void s.submit()}>
              {t("pf.common.save")}
            </Button>
          </div>
        )}
        <ErrorNote code={s.error} />
      </td>
    </tr>
  );
}

export function BoundaryPanel({ cycleId, boundaries, canEdit, canApprove }: { cycleId: string; boundaries: BoundaryView[]; canEdit: boolean; canApprove: boolean }) {
  const { t, fmt } = useI18n();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (method: "POST", path: string, body?: unknown) => {
    setBusy(true);
    setError(null);
    const r = await api(method, path, body);
    setBusy(false);
    if (!r.ok) return setError(r.code);
    router.refresh();
  };
  return (
    <div className="flex flex-col gap-5">
      <ErrorNote code={error} />
      {KINDS.map((kind) => {
        const list = boundaries.filter((b) => b.kind === kind);
        const draft = list.find((b) => b.status === "draft");
        const approved = list.find((b) => b.status === "approved");
        const shown = draft ?? approved;
        return (
          <section key={kind} className="rounded-[14px] border border-[var(--rule)] bg-[var(--paper)] p-4" aria-labelledby={`b-${kind}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 id={`b-${kind}`} className="text-[15px] font-semibold">
                {t(`pf.scope.kind.${kind}`)}
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                {approved && <Badge tone="ok">{t("pf.scope.approvedRev", { rev: approved.revision })}</Badge>}
                {draft && <Badge tone="warn">{t("pf.scope.draftRev", { rev: draft.revision })}</Badge>}
                {canEdit && !draft && (
                  <Button size="sm" disabled={busy} onClick={() => void run("POST", `/api/v1/cycles/${cycleId}/boundaries`, { kind })}>
                    {approved ? t("pf.scope.revise") : t("pf.scope.propose")}
                  </Button>
                )}
                {canApprove && draft && (
                  <Button size="sm" variant="primary" disabled={busy} onClick={() => void run("POST", `/api/v1/boundaries/${draft.id}/approve`)}>
                    {t("pf.scope.approve")}
                  </Button>
                )}
              </div>
            </div>
            <p className="mt-1 text-[12.5px] text-[var(--ink-3)]">{t(`pf.scope.kindHint.${kind}`)}</p>
            {shown ? (
              <>
                <p className="mt-2 text-[12px] text-[var(--ink-3)]">
                  {t("pf.scope.asOf", { date: fmt.date(shown.as_of) })}
                  {shown.status === "approved" && shown.approved_by_name && ` · ${t("pf.scope.approvedBy", { name: shown.approved_by_name })}`}
                </p>
                <div className="-mx-1 mt-2 overflow-x-auto">
                  <table className="w-full min-w-[560px] border-collapse text-left text-[13.5px]">
                    <thead>
                      <tr className="border-b border-[var(--rule)] text-[12px] uppercase tracking-[0.06em] text-[var(--ink-3)]">
                        <th scope="col" className="px-2 py-1.5 font-semibold">{t("pf.scope.member")}</th>
                        <th scope="col" className="px-2 py-1.5 font-semibold">{t("pf.scope.pct")}</th>
                        <th scope="col" className="px-2 py-1.5 font-semibold">{t("pf.scope.why")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shown.members
                        .slice()
                        .sort((a, b) => (a.entity_name ?? a.facility_name ?? "").localeCompare(b.entity_name ?? b.facility_name ?? ""))
                        .map((m) => (
                          <MemberRow key={`${m.id}-${m.inclusion_pct}`} m={m} editable={canEdit && shown.status === "draft"} />
                        ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p className="mt-2 text-[13px] text-[var(--ink-3)]">{t("pf.scope.noBoundary")}</p>
            )}
          </section>
        );
      })}
    </div>
  );
}

export type Assessment = {
  id: string;
  regime: string;
  suggestion: string;
  first_year: number | null;
  notes: string[];
  source_ids: string[];
  decision: string | null;
  rationale: string | null;
  decision_source: string | null;
  decided_at: string | Date | null;
  confirmed_at: string | Date | null;
  decided_by_name: string | null;
  confirmed_by_name: string | null;
  framework_title: string | null;
  framework_status: string | null;
  engine_version: string;
};

const ENTITY_TYPES = ["listed", "bank", "bank_tmsf", "nonbank_fi", "insurer", "capital_markets_fi", "precious_metals", "unlisted_company", "public_body"];

function ProfileForm({ cycleId, initial, year }: { cycleId: string; initial: Profile; year: number }) {
  const { t } = useI18n();
  const router = useRouter();
  const [p, setP] = useState<Profile>({ ...initial, reportingYear: year });
  const up = (patch: Partial<Profile>) => setP({ ...p, ...patch });
  const num = (v: string) => (v === "" ? 0 : Number(v));
  const hist = (i: 0 | 1, k: "totalAssetsTry" | "revenueTry" | "employees", v: string) => {
    const h = [...p.history] as Profile["history"];
    h[i] = { ...h[i], [k]: num(v) };
    up({ history: h });
  };
  const s = useSubmit(() => api("POST", `/api/v1/cycles/${cycleId}/applicability`, { profile: p }), () => router.refresh());
  return (
    <form onSubmit={s.submit} className="flex flex-col gap-4">
      <div className="grid gap-3 md:grid-cols-3">
        <Select label={t("app.entityType")} name="p-type" value={p.entityType} onChange={(e) => up({ entityType: e.target.value as Profile["entityType"] })} options={ENTITY_TYPES.map((x) => ({ value: x, label: t(`app.entity.${x}`) }))} />
        <Input label={t("app.branches")} name="p-branches" type="number" min={0} value={p.branches} onChange={(e) => up({ branches: num(e.target.value) })} />
        <Input label={t("app.firstTsrsYear")} name="p-first" type="number" min={2023} max={2100} value={p.firstTsrsYear ?? ""} onChange={(e) => up({ firstTsrsYear: e.target.value ? Number(e.target.value) : null })} />
        <Check id="p-bist" checked={p.bistMainMarkets} onChange={(v) => up({ bistMainMarkets: v })} label={t("app.bistMain")} />
        <Check id="p-watch" checked={p.watchlistMarket} onChange={(v) => up({ watchlistMarket: v })} label={t("app.watchlist")} />
        <Check id="p-shares" checked={p.sharesListed ?? false} onChange={(v) => up({ sharesListed: v })} label={t("app.sharesListed")} />
      </div>
      {([0, 1] as const).map((i) => (
        <fieldset key={i} className="grid gap-3 md:grid-cols-4">
          <legend className="mb-1 text-[13px] font-semibold">{t("app.yearFigures", { year: year - 2 + i })}</legend>
          <Input label={t("app.assets")} name={`p-a${i}`} type="number" min={0} value={p.history[i].totalAssetsTry} onChange={(e) => hist(i, "totalAssetsTry", e.target.value)} />
          <Input label={t("app.revenue")} name={`p-r${i}`} type="number" min={0} value={p.history[i].revenueTry} onChange={(e) => hist(i, "revenueTry", e.target.value)} />
          <Input label={t("app.employees")} name={`p-e${i}`} type="number" min={0} value={p.history[i].employees} onChange={(e) => hist(i, "employees", e.target.value)} />
          <Check id={`p-reg${i}`} checked={p.regulatedStatus[i]} onChange={(v) => up({ regulatedStatus: (i === 0 ? [v, p.regulatedStatus[1]] : [p.regulatedStatus[0], v]) as [boolean, boolean] })} label={t("app.regulatedStatus")} />
        </fieldset>
      ))}
      <div className="grid gap-3 md:grid-cols-3">
        <Check id="p-eu" checked={p.euEntity} onChange={(v) => up({ euEntity: v })} label={t("app.euEntity")} />
        <Input label={t("app.worldwideTurnover")} name="p-ww" type="number" min={0} value={p.worldwideTurnoverEur} onChange={(e) => up({ worldwideTurnoverEur: num(e.target.value) })} />
        <Input label={t("app.euTurnover")} name="p-eut" type="number" min={0} value={p.euTurnoverEur} onChange={(e) => up({ euTurnoverEur: num(e.target.value) })} />
        <Input label={t("app.euSubsidiary")} name="p-eus" type="number" min={0} value={p.euSubsidiaryTurnoverEur} onChange={(e) => up({ euSubsidiaryTurnoverEur: num(e.target.value) })} />
        <Input label={t("app.employeesGroup")} name="p-eg" type="number" min={0} value={p.employeesGroup} onChange={(e) => up({ employeesGroup: num(e.target.value) })} />
        <Check id="p-cust" checked={p.euCsrdCustomers} onChange={(v) => up({ euCsrdCustomers: v })} label={t("app.euCustomers")} />
      </div>
      <fieldset className="flex flex-wrap gap-x-5 gap-y-2">
        <legend className="mb-1 text-[13px] font-semibold">{t("app.cbamSectors")}</legend>
        {CBAM_SECTORS.map((sct) => (
          <Check key={sct} id={`p-c-${sct}`} checked={p.cbamSectors.includes(sct)} onChange={(v) => up({ cbamSectors: v ? [...p.cbamSectors, sct] : p.cbamSectors.filter((x) => x !== sct) })} label={t(`sectors.${sct}`)} />
        ))}
      </fieldset>
      <div className="grid gap-3 md:grid-cols-4">
        <Input label={t("app.euExportTonnes")} name="p-ex" type="number" min={0} value={p.euExportTonnes} onChange={(e) => up({ euExportTonnes: num(e.target.value) })} />
        <Input label={t("app.emissions")} name="p-em" type="number" min={0} value={p.annualEmissionsTco2e} onChange={(e) => up({ annualEmissionsTco2e: num(e.target.value) })} />
        <Select label={t("app.pilotSector")} name="p-pilot" value={p.pilotSector} onChange={(e) => up({ pilotSector: e.target.value as Profile["pilotSector"] })} options={[...PILOT_SECTORS, "other"].map((x) => ({ value: x, label: t(`sectors.${x}`) }))} />
        <Input label={t("app.energyToe")} name="p-toe" type="number" min={0} value={p.energyToe} onChange={(e) => up({ energyToe: num(e.target.value) })} />
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        <Check id="p-eudr" checked={p.eudrCommodities} onChange={(v) => up({ eudrCommodities: v })} label={t("app.eudr")} />
        <Check id="p-small" checked={p.smallOrMicro} onChange={(v) => up({ smallOrMicro: v })} label={t("app.small")} />
        <Check id="p-dpp" checked={p.dppProducts} onChange={(v) => up({ dppProducts: v })} label={t("app.dpp")} />
        <Check id="p-bat" checked={p.batteries} onChange={(v) => up({ batteries: v })} label={t("app.batteries")} />
      </div>
      <ErrorNote code={s.error} />
      <div>
        <SubmitButton busy={s.busy}>{t("pf.scope.run")}</SubmitButton>
      </div>
    </form>
  );
}

function DecisionForm({ a }: { a: Assessment }) {
  const { t } = useI18n();
  const router = useRouter();
  const initial = a.suggestion === "required" ? "in_scope" : a.suggestion === "voluntary" ? "voluntary" : a.suggestion === "not_applicable" ? "not_applicable" : "needs_review";
  const [decision, setDecision] = useState(a.decision ?? initial);
  const [rationale, setRationale] = useState("");
  const [source, setSource] = useState("");
  const s = useSubmit(() => api("POST", `/api/v1/assessments/${a.id}/decision`, { decision, rationale, decisionSource: source.trim() || null }), () => router.refresh());
  return (
    <form onSubmit={s.submit} className="mt-2 grid gap-2 md:grid-cols-[200px_minmax(0,1fr)_200px_auto] md:items-end">
      <Select label={t("pf.scope.decision")} name={`d-${a.id}`} value={decision} onChange={(e) => setDecision(e.target.value)} options={["in_scope", "voluntary", "not_applicable", "needs_review"].map((x) => ({ value: x, label: t(`pf.scope.decisions.${x}`) }))} />
      <Input label={t("pf.scope.rationale")} name={`r-${a.id}`} required minLength={10} value={rationale} onChange={(e) => setRationale(e.target.value)} />
      <Input label={t("pf.scope.decisionSource")} name={`s-${a.id}`} value={source} onChange={(e) => setSource(e.target.value)} />
      <SubmitButton busy={s.busy} disabled={rationale.trim().length < 10}>
        {t("pf.scope.decide")}
      </SubmitButton>
      <div className="md:col-span-4">
        <ErrorNote code={s.error} />
      </div>
    </form>
  );
}

function ConfirmButton({ id }: { id: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const s = useSubmit(() => api("POST", `/api/v1/assessments/${id}/confirm`), () => router.refresh());
  return (
    <span className="inline-flex flex-col gap-1">
      <Button size="sm" variant="primary" disabled={s.busy} onClick={() => void s.submit()}>
        {t("pf.scope.confirm")}
      </Button>
      <ErrorNote code={s.error} />
    </span>
  );
}

export function ApplicabilityPanel({ cycleId, year, assessments, profile, canDecide, canConfirm }: { cycleId: string; year: number; assessments: Assessment[]; profile: Profile; canDecide: boolean; canConfirm: boolean }) {
  const { t, fmt } = useI18n();
  const [open, setOpen] = useState(assessments.length === 0);
  const kind = (s: string) => (s === "required" ? "required" : s === "indirect" ? "indirect" : s === "review" ? "review" : s === "voluntary" ? "voluntary" : "na") as "required";
  return (
    <div className="flex flex-col gap-4">
      {canDecide && (
        <div>
          <button type="button" className="text-[13.5px] font-medium text-[var(--b-700)]" aria-expanded={open} onClick={() => setOpen(!open)}>
            {open ? t("pf.scope.hideProfile") : t("pf.scope.showProfile")}
          </button>
          {open && (
            <div className="mt-3 rounded-[14px] border border-[var(--rule)] bg-[var(--paper)] p-4">
              <ProfileForm cycleId={cycleId} initial={profile} year={year} />
            </div>
          )}
        </div>
      )}
      {assessments.length === 0 ? (
        <p className="text-[13.5px] text-[var(--ink-3)]">{t("pf.scope.noAssessment")}</p>
      ) : (
        <>
          <p className="text-[12px] text-[var(--ink-3)]">{t("pf.scope.engine", { engine: assessments[0].engine_version })}</p>
          <ol className="flex flex-col gap-3">
            {assessments.map((a) => (
              <li key={a.id} className="rounded-[14px] border border-[var(--rule)] bg-[var(--paper)] p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="text-[15px] font-semibold">{t(`app.reg.${a.regime}`)}</h3>
                  <StatusMark kind={kind(a.suggestion)} label={t("pf.scope.suggestion", { s: t(`app.status.${a.suggestion}`) })} />
                  {a.first_year && <span className="text-[12.5px] text-[var(--ink-3)]">{t("app.firstYear", { year: a.first_year })}</span>}
                  {a.framework_title && (
                    <span className="text-[12px] text-[var(--ink-3)]">
                      {a.framework_title}
                      {a.framework_status === "published_future_effective" && ` · ${t("pf.scope.futureEffective")}`}
                    </span>
                  )}
                </div>
                {a.notes.length > 0 && (
                  <ul className="mt-2 flex flex-col gap-1 text-[13.5px] text-[var(--ink-2)]">
                    {a.notes.map((n) => (
                      <li key={n}>— {t(`app.notes.${n}`)}</li>
                    ))}
                  </ul>
                )}
                <div className="mt-2">
                  <SourceNote compact meta={{ sources: a.source_ids, status: a.suggestion === "review" ? "review" : undefined }} />
                </div>
                {a.decision ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2 rounded-[12px] bg-[var(--b-50)] px-3 py-2 text-[13px]">
                    <Badge tone={a.confirmed_at ? "ok" : "warn"}>{t(`pf.scope.decisions.${a.decision}`)}</Badge>
                    <span>{a.rationale}</span>
                    <span className="text-[var(--ink-3)]">
                      — {a.decided_by_name}, {fmt.date(new Date(a.decided_at!).toISOString().slice(0, 10))}
                      {a.decision_source && ` · ${a.decision_source}`}
                    </span>
                    {a.confirmed_at ? <span className="text-[var(--ok)]">{t("pf.scope.confirmedBy", { name: a.confirmed_by_name ?? "" })}</span> : <span className="text-[var(--warn)]">{t("pf.scope.awaitingConfirm")}</span>}
                    {!a.confirmed_at && canConfirm && <ConfirmButton id={a.id} />}
                  </div>
                ) : (
                  canDecide && <DecisionForm a={a} />
                )}
              </li>
            ))}
          </ol>
        </>
      )}
      {assessments.some((a) => a.decision && a.confirmed_at) && <OkNote>{t("pf.scope.note")}</OkNote>}
    </div>
  );
}
