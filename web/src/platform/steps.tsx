"use client";

/**
 * The project's cycle as seven steps (UX review 19.10.2026): a step bar that replaces the twelve tabs, and the step
 * board of the project summary. States come from the server (cycle/steps.ts); here they are only drawn — always
 * as text plus a mark, never colour alone.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertTriangle, Check, Circle, CircleDot, LineChart as ChartIcon, Settings } from "lucide-react";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/components/ui";
import { ANALYSIS_TOOLS, SETUP_PAGES, STEP_PAGES, type StepId, type StepState } from "@/server/cycle/steps";

export type StepChip = { id: StepId; state: StepState; late: boolean };
export type StepCard = StepChip & { summary: string; vars: Record<string, number>; dueOn: string | null; owner: string | null };

const TONE: Record<StepState, string> = {
  done: "border-t-[var(--ok)]",
  active: "border-t-[var(--b-600)]",
  blocked: "border-t-[var(--crit)]",
  ready: "border-t-[var(--b-400)] border-dashed",
  waiting: "border-t-[var(--rule)]",
  not_started: "border-t-[var(--rule)]",
  optional: "border-t-[var(--rule)]",
};
const BAR: Record<StepState, string> = {
  done: "border-b-[var(--ok)]",
  active: "border-b-[var(--b-600)]",
  blocked: "border-b-[var(--crit)]",
  ready: "border-b-[var(--b-400)]",
  waiting: "border-b-[var(--rule)]",
  not_started: "border-b-[var(--rule)]",
  optional: "border-b-[var(--rule)]",
};
const STATE_TEXT: Record<StepState, string> = {
  done: "text-[var(--ok)]",
  active: "text-[var(--b-700)]",
  blocked: "text-[var(--crit)]",
  ready: "text-[var(--b-700)]",
  waiting: "text-[var(--ink-3)]",
  not_started: "text-[var(--ink-3)]",
  optional: "text-[var(--ink-3)]",
};

/** A mark per state, so the state never rests on colour alone. */
function StateMark({ state }: { state: StepState }) {
  if (state === "done") return <Check size={13} strokeWidth={2.6} aria-hidden className="text-[var(--ok)]" />;
  if (state === "blocked") return <AlertTriangle size={12} aria-hidden className="text-[var(--crit)]" />;
  if (state === "active" || state === "ready") return <CircleDot size={12} aria-hidden className="text-[var(--b-600)]" />;
  return <Circle size={11} aria-hidden className="text-[var(--ink-3)]" />;
}

const segmentOf = (pathname: string, base: string) => (pathname === base ? "" : pathname.startsWith(`${base}/`) ? pathname.slice(base.length + 1).split("/")[0] : null);

/** Summary · seven steps · setup, with a second row for a step (or setup) that has more than one page. */
export function ProjectNav({ base, steps, current, query = "", canSetup }: { base: string; steps: StepChip[]; current: StepId | "complete" | null; query?: string; canSetup: boolean }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const seg = segmentOf(pathname, base);
  const activeStep = seg ? (Object.entries(STEP_PAGES).find(([, pages]) => pages.includes(seg))?.[0] as StepId | undefined) : undefined;
  const inSetup = seg !== null && (SETUP_PAGES as readonly string[]).includes(seg);
  const inAnalysis = seg === "analysis";
  const sub: { href: string; label: string; on: boolean }[] = inAnalysis
    ? ANALYSIS_TOOLS.map((x) => ({ href: `${base}/analysis/${x}${query}`, label: t(`pf.an.tools.${x}`), on: pathname.startsWith(`${base}/analysis/${x}`) }))
    : activeStep
    ? STEP_PAGES[activeStep].length > 1
      ? STEP_PAGES[activeStep].map((p) => ({ href: `${base}/${p}${query}`, label: t(`pf.steps.pages.${p}`), on: seg === p }))
      : []
    : inSetup
      ? SETUP_PAGES.map((p) => ({ href: `${base}/${p}${query}`, label: t(`pf.steps.setupNav.${p}`), on: seg === p }))
      : [];
  return (
    <nav aria-label={t("pf.steps.nav")} className="mb-5 flex flex-col gap-2">
      <div className="flex items-stretch gap-1.5 overflow-x-auto p-0.5 pb-1">
        <Link
          href={`${base}${query}`}
          aria-current={seg === "" ? "page" : undefined}
          className={cn("flex h-10 shrink-0 items-center rounded-[10px] px-3.5 text-[13.5px] font-semibold no-underline", seg === "" ? "bg-[var(--b-600)] text-white" : "glass text-[var(--ink-2)] hover:text-[var(--ink)]")}
        >
          {t("pf.steps.overview")}
        </Link>
        <ol className="flex min-w-0 flex-1 gap-1">
          {steps.map((s, i) => {
            const on = activeStep === s.id;
            const isCurrent = current === s.id;
            const label = `${t("pf.steps.step", { n: i + 1 })}: ${t(`pf.steps.name.${s.id}`)} — ${t(`pf.steps.state.${s.state}`)}${s.late ? `, ${t("pf.steps.late")}` : ""}${isCurrent ? ` (${t("pf.steps.current")})` : ""}`;
            return (
              <li key={s.id} className="min-w-[104px] flex-1">
                <Link
                  href={`${base}/${STEP_PAGES[s.id][0]}${query}`}
                  aria-current={on ? "page" : undefined}
                  aria-label={label}
                  title={label}
                  className={cn(
                    "flex h-10 items-center gap-1.5 rounded-[10px] border border-b-[3px] border-[var(--rule)] bg-[var(--glass-strong)] px-2 text-[12.5px] font-medium text-[var(--ink-2)] no-underline transition-colors hover:bg-[var(--paper)] hover:text-[var(--ink)]",
                    BAR[s.state],
                    isCurrent && "ring-2 ring-[var(--b-600)] ring-offset-0",
                    on && "bg-[var(--paper)] font-semibold text-[var(--ink)]",
                  )}
                >
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--b-50)] text-[11px] font-semibold text-[var(--b-700)]">{i + 1}</span>
                  <span className="min-w-0 truncate">{t(`pf.steps.name.${s.id}`)}</span>
                  <span className="ml-auto shrink-0">
                    <StateMark state={s.state} />
                  </span>
                  {s.late && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--crit)]" aria-hidden />}
                </Link>
              </li>
            );
          })}
        </ol>
        <Link
          href={`${base}/analysis${query}`}
          aria-current={inAnalysis ? "page" : undefined}
          className={cn("flex h-10 shrink-0 items-center gap-1.5 rounded-[10px] px-3 text-[13px] font-medium no-underline", inAnalysis ? "bg-[var(--b-600)] text-white" : "glass text-[var(--ink-2)] hover:text-[var(--ink)]")}
        >
          <ChartIcon size={14} aria-hidden />
          {t("pf.an.nav")}
        </Link>
        {canSetup && (
          <Link
            href={`${base}/setup${query}`}
            aria-current={inSetup ? "page" : undefined}
            className={cn("flex h-10 shrink-0 items-center gap-1.5 rounded-[10px] px-3 text-[13px] font-medium no-underline", inSetup ? "bg-[var(--b-600)] text-white" : "glass text-[var(--ink-2)] hover:text-[var(--ink)]")}
          >
            <Settings size={14} aria-hidden />
            {t("pf.steps.setup")}
          </Link>
        )}
      </div>
      {sub.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {sub.map((x) => (
            <Link
              key={x.href}
              href={x.href}
              aria-current={x.on ? "page" : undefined}
              className={cn("rounded-[9px] px-3 py-1 text-[13px] no-underline", x.on ? "bg-[var(--paper)] font-semibold text-[var(--ink)] shadow-[0_6px_16px_-12px_rgba(31,52,160,0.7)]" : "text-[var(--ink-2)] hover:text-[var(--ink)]")}
            >
              {x.label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}

/** The summary's step board: every step with its state, what the record says, its due date and owner. */
export function StepBoard({ base, steps, current, query = "", dates }: { base: string; steps: StepCard[]; current: StepId | "complete" | null; query?: string; dates: Record<string, string> }) {
  const { t } = useI18n();
  return (
    <ol className="grid grid-cols-2 gap-2.5 md:grid-cols-4 xl:grid-cols-7">
      {steps.map((s, i) => {
        const isCurrent = current === s.id;
        return (
          <li key={s.id} className={cn("glass flex flex-col gap-1.5 rounded-[14px] border-t-[3px] p-3.5", TONE[s.state], isCurrent && "shadow-[0_0_0_2px_var(--b-600)]")}>
            <span className="flex items-center gap-1.5 text-[11.5px] font-medium text-[var(--ink-3)]">
              {t("pf.steps.step", { n: i + 1 })}
              {isCurrent && <span className="ml-auto rounded-full bg-[var(--b-600)] px-1.5 text-[10.5px] font-semibold text-white">{t("pf.steps.now")}</span>}
            </span>
            <Link href={`${base}/${STEP_PAGES[s.id][0]}${query}`} className="text-[14.5px] font-semibold leading-tight text-[var(--ink)] no-underline hover:text-[var(--b-700)]">
              {t(`pf.steps.name.${s.id}`)}
            </Link>
            <span className={cn("text-[12.5px] font-semibold", STATE_TEXT[s.state])}>{t(`pf.steps.state.${s.state}`)}</span>
            <span className="text-[12.5px] leading-snug text-[var(--ink-2)]">{t(`pf.steps.summary.${s.id}.${s.summary}`, s.vars)}</span>
            <span className="mt-auto flex flex-col gap-0.5 pt-1 text-[11.5px] text-[var(--ink-3)]">
              {s.dueOn && (
                <span className={s.late ? "font-semibold text-[var(--crit)]" : undefined}>
                  {t("pf.steps.due", { date: dates[s.dueOn] ?? s.dueOn })}
                  {s.late && ` · ${t("pf.steps.late")}`}
                </span>
              )}
              {s.state !== "optional" && <span>{s.owner ? t("pf.steps.owner", { name: s.owner }) : t("pf.steps.noOwner")}</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
