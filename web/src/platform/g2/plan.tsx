"use client";

/**
 * PORT-09: the cycle's work packages as a timeline (visual) and as a table (the accessible, editable form). The
 * timeline only explains the dates in the table; the critical path is drawn as a solid bar, float as a light one.
 * Since the UX review (19.10.2026) a package's state is not set by hand: it shows the state of the cycle step the
 * package belongs to, derived from the records (cycle/steps.ts). People change dates and owners here.
 */
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/i18n/provider";
import { Button, cn } from "@/components/ui";
import { api } from "../client";
import { Badge, ErrorNote, Input } from "../ui";
import { stepOfGate, type StepState } from "@/server/cycle/steps";

export type Wp = {
  id: string;
  gate: string;
  title: string;
  status: string;
  starts_on: string;
  due_on: string;
  critical: boolean;
  blocked_reason: string | null;
  row_version: number;
  responsible_user_id: string | null;
  accountable_user_id: string | null;
  responsible_name: string | null;
  deps: string[];
};

/** The derived state of each step (cycle/steps.ts), by step id. */
export type StepStates = Record<string, StepState>;

const toMs = (d: string) => new Date(`${d}T00:00:00Z`).getTime();
const tone = (s: StepState) => (s === "done" ? "ok" : s === "blocked" ? "crit" : s === "active" || s === "ready" ? "info" : "neutral");
const stateOf = (gate: string, steps: StepStates): StepState => steps[stepOfGate(gate) ?? ""] ?? "not_started";

export function PlanTimeline({ items, today, publishDue, periodEnd, steps }: { items: Wp[]; today: string; publishDue: string | null; periodEnd: string; steps: StepStates }) {
  const { t, fmt } = useI18n();
  if (!items.length) return null;
  const min = Math.min(...items.map((i) => toMs(i.starts_on)));
  const max = Math.max(...items.map((i) => toMs(i.due_on)), publishDue ? toMs(publishDue) : 0);
  const span = Math.max(1, max - min);
  const pos = (d: string) => `${((toMs(d) - min) / span) * 100}%`;
  const width = (a: string, b: string) => `${Math.max(0.6, ((toMs(b) - toMs(a) + 864e5) / span) * 100)}%`;
  const marks = [
    { d: today, label: t("pf.plan.today"), cls: "bg-[var(--b-600)]" },
    { d: periodEnd, label: t("pf.plan.periodEnd"), cls: "bg-[var(--ink-3)]" },
    ...(publishDue ? [{ d: publishDue, label: t("pf.plan.publishDue"), cls: "bg-[var(--crit)]" }] : []),
  ].filter((m) => toMs(m.d) >= min && toMs(m.d) <= max);
  return (
    <figure className="flex flex-col gap-2" aria-label={t("pf.plan.timelineLabel")}>
      <div className="relative pt-5" aria-hidden>
        {marks.map((m) => (
          <div key={m.label} className="absolute bottom-0 top-0 z-[1] w-px" style={{ left: pos(m.d) }}>
            <div className={cn("h-full w-px opacity-60", m.cls)} />
            <span className="absolute -top-0.5 left-1 whitespace-nowrap text-[10.5px] font-medium text-[var(--ink-3)]">{m.label}</span>
          </div>
        ))}
        <ul className="relative flex flex-col gap-1.5">
          {items.map((i) => (
            <li key={i.id} className="grid grid-cols-[minmax(0,190px)_minmax(0,1fr)] items-center gap-2">
              <span className="truncate text-[11.5px] font-medium text-[var(--ink-2)]" title={t(`pf.plan.gates.${i.gate}`)}>
                {t(`pf.plan.gates.${i.gate}`)}
              </span>
              <span className="relative h-4">
                <span
                  className={cn(
                    "absolute top-0 h-4 rounded-[5px] transition-[left,width] duration-300 motion-reduce:transition-none",
                    stateOf(i.gate, steps) === "done" ? "bg-[color-mix(in_srgb,var(--ok)_55%,transparent)]" : i.critical ? "bg-[var(--b-600)]" : "bg-[color-mix(in_srgb,var(--b-400)_45%,transparent)]",
                    stateOf(i.gate, steps) === "blocked" && "outline outline-2 outline-[var(--crit)]",
                  )}
                  style={{ left: pos(i.starts_on), width: width(i.starts_on, i.due_on) }}
                />
              </span>
            </li>
          ))}
        </ul>
      </div>
      <figcaption className="flex flex-wrap gap-4 text-[11.5px] text-[var(--ink-3)]">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-5 rounded bg-[var(--b-600)]" />
          {t("pf.plan.legendCritical")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-5 rounded bg-[color-mix(in_srgb,var(--b-400)_45%,transparent)]" />
          {t("pf.plan.legendFloat")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-5 rounded bg-[color-mix(in_srgb,var(--ok)_55%,transparent)]" />
          {t("pf.plan.legendDone")}
        </span>
        <span>{t("pf.plan.range", { from: fmt.date(new Date(min).toISOString().slice(0, 10)), to: fmt.date(new Date(max).toISOString().slice(0, 10)) })}</span>
      </figcaption>
    </figure>
  );
}

function Row({ wp, gates, people, canEdit, today, steps }: { wp: Wp; gates: Map<string, string>; people: { id: string; name: string }[]; canEdit: boolean; today: string; steps: StepStates }) {
  const { t, fmt } = useI18n();
  const router = useRouter();
  const [edit, setEdit] = useState(false);
  const [dates, setDates] = useState({ startsOn: wp.starts_on, dueOn: wp.due_on });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const patch = async (body: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    const r = await api("PATCH", `/api/v1/work-packages/${wp.id}`, body, { ifMatch: `"${wp.row_version}"` });
    setBusy(false);
    if (!r.ok) return setError(r.code);
    setEdit(false);
    router.refresh();
  };
  const state = stateOf(wp.gate, steps);
  const step = stepOfGate(wp.gate);
  const late = state !== "done" && state !== "optional" && wp.due_on < today;
  return (
    <tr className="align-top">
      <td className="border-b border-[var(--rule)] px-2 py-2.5">
        <span className="font-semibold">{t(`pf.plan.gates.${wp.gate}`)}</span>
        {step && <span className="block text-[12px] text-[var(--ink-3)]">{t(`pf.steps.name.${step}`)}</span>}
        {wp.deps.length > 0 && <span className="block text-[11.5px] text-[var(--ink-3)]">{t("pf.plan.after", { gates: wp.deps.map((d) => (gates.get(d) ? t(`pf.plan.gates.${gates.get(d)}`) : "?")).join(", ") })}</span>}
      </td>
      <td className="border-b border-[var(--rule)] px-2 py-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={tone(state)}>{t(`pf.steps.state.${state}`)}</Badge>
          {wp.critical && state !== "done" && <Badge tone="info">{t("pf.plan.critical")}</Badge>}
          {late && <Badge tone="crit">{t("pf.plan.late")}</Badge>}
        </div>
      </td>
      <td className="border-b border-[var(--rule)] px-2 py-2.5 whitespace-nowrap text-[13px]">
        {edit ? (
          <div className="flex flex-col gap-1.5">
            <Input label={t("pf.plan.start")} name={`s-${wp.id}`} type="date" value={dates.startsOn} onChange={(e) => setDates({ ...dates, startsOn: e.target.value })} />
            <Input label={t("pf.plan.due")} name={`d-${wp.id}`} type="date" value={dates.dueOn} onChange={(e) => setDates({ ...dates, dueOn: e.target.value })} />
            <div className="flex gap-1">
              <Button size="sm" variant="primary" disabled={busy} onClick={() => void patch(dates)}>
                {t("pf.common.save")}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEdit(false)}>
                {t("pf.common.cancel")}
              </Button>
            </div>
          </div>
        ) : (
          <>
            {fmt.date(wp.starts_on)} – {fmt.date(wp.due_on)}
            {canEdit && (
              <button type="button" className="ml-2 text-[12px] text-[var(--b-700)]" onClick={() => setEdit(true)}>
                {t("pf.plan.editDates")}
              </button>
            )}
          </>
        )}
      </td>
      <td className="border-b border-[var(--rule)] px-2 py-2.5">
        {canEdit ? (
          <select aria-label={t("pf.plan.responsible")} className="field-input h-8 text-[12.5px]" value={wp.responsible_user_id ?? ""} disabled={busy} onChange={(e) => void patch({ responsibleUserId: e.target.value || null })}>
            <option value="">{t("pf.plan.nobody")}</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-[13px]">{wp.responsible_name ?? "—"}</span>
        )}
        <ErrorNote code={error} />
      </td>
    </tr>
  );
}

export function PlanTable({ items, people, canEdit, today, steps }: { items: Wp[]; people: { id: string; name: string }[]; canEdit: boolean; today: string; steps: StepStates }) {
  const { t } = useI18n();
  const gates = new Map(items.map((i) => [i.id, i.gate]));
  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-left text-[13.5px]">
        <caption className="sr-only">{t("pf.plan.tableCaption")}</caption>
        <thead>
          <tr className="border-b border-[var(--rule)] text-[12px] uppercase tracking-[0.06em] text-[var(--ink-3)]">
            <th scope="col" className="px-2 py-2 font-semibold">{t("pf.plan.gate")}</th>
            <th scope="col" className="px-2 py-2 font-semibold">{t("pf.steps.stepState")}</th>
            <th scope="col" className="px-2 py-2 font-semibold">{t("pf.plan.dates")}</th>
            <th scope="col" className="px-2 py-2 font-semibold">{t("pf.plan.responsible")}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((wp) => (
            <Row key={`${wp.id}-${wp.row_version}`} wp={wp} gates={gates} people={people} canEdit={canEdit} today={today} steps={steps} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
