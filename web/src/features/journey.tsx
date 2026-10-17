"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpRight, Check, CircleDashed, LoaderCircle } from "lucide-react";
import { useI18n } from "@/i18n/provider";
import { JOURNEYS, stageStatus, type StageStatus, type Track } from "@/data/journey";
import { NAV } from "@/data/nav";
import { useWidth } from "@/components/charts";
import { PageHeader } from "@/components/shell";
import { Tabs, cn } from "@/components/ui";
import { Hydrated, useTool } from "./common";

const TRACKS: Track[] = ["sustainability", "annual", "cbam"];
const NODE_W = 196;
const NODE_H = 104;

export function JourneyPage() {
  return (
    <Hydrated>
      <Inner />
    </Hydrated>
  );
}

function Inner() {
  const { t, fmt, locale } = useI18n();
  const [journey, setJourney, client] = useTool("journey");
  const [track, setTrack] = useState<Track>("sustainability");
  const stages = JOURNEYS[track];
  const states = stages.map((s) => stageStatus(client, track, s));
  const firstOpen = states.findIndex((s) => s.status !== "done");
  const [selected, setSelected] = useState<number>(Math.max(0, firstOpen));
  const sel = Math.min(selected, stages.length - 1);
  const done = states.filter((s) => s.status === "done").length;
  const navHref = (tool: string) => NAV.flatMap((g) => g.items).find((i) => i.id === tool)?.href ?? "";
  const setStatus = (i: number, st: StageStatus | null) => {
    const key = `${track}.${stages[i].id}`;
    const next = { ...(journey ?? {}) };
    if (st) next[key] = st;
    else delete next[key];
    setJourney(next);
  };

  return (
    <div data-family="compass">
      <PageHeader
        title={t("nav.journey")}
        result={t("journey.result", { track: t(`journey.tracks.${track}`), done, total: stages.length, next: firstOpen >= 0 ? t(`journey.${track}.${stages[firstOpen].id}.title`) : "—" })}
        aside={
          <div className="flex max-w-[520px] items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/25">
              <div className="h-full rounded-full bg-white transition-[width] duration-700" style={{ width: `${(done / stages.length) * 100}%` }} />
            </div>
            <span className="num text-[13px] font-semibold">{fmt.percent(done / stages.length, 0)}</span>
          </div>
        }
      />
      <div className="flex flex-col gap-6">
        <Tabs
          label={t("journey.track")}
          value={track}
          onChange={(v) => {
            setTrack(v);
            setSelected(0);
          }}
          items={TRACKS.map((k) => ({ value: k, label: t(`journey.tracks.${k}`) }))}
        />
        <div className="glass p-4 md:p-6">
          <FlowDiagram
            key={track}
            labels={stages.map((s) => t(`journey.${track}.${s.id}.title`))}
            whens={stages.map((s) => s.when)}
            states={states}
            selected={sel}
            onSelect={setSelected}
          />
        </div>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <section className="glass flex min-w-0 flex-col gap-4 p-5 md:p-6" aria-live="polite">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="text-[20px] font-semibold tracking-[-0.01em]">
                <span className="mr-2 text-[var(--accent-ink)]">{sel + 1}.</span>
                {t(`journey.${track}.${stages[sel].id}.title`)}
              </h2>
              <span className="text-[13px] text-[var(--ink-3)]">{whenLabel(stages[sel].when, t)}</span>
            </div>
            <p className="max-w-[66ch] text-[15px] leading-relaxed text-[var(--ink-2)]">{t(`journey.${track}.${stages[sel].id}.what`)}</p>
            <div className="grid gap-5 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <span className="label">{t("journey.tasks")}</span>
                <ul className="flex flex-col gap-1.5 text-[14px] text-[var(--ink-2)]">
                  {t(`journey.${track}.${stages[sel].id}.tasks`)
                    .split("|")
                    .map((task) => (
                      <li key={task} className="flex gap-2.5">
                        <span aria-hidden className="mt-[0.55em] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--b-400)]" />
                        {task}
                      </li>
                    ))}
                </ul>
              </div>
              <div className="flex flex-col gap-2">
                <span className="label">{t("journey.outputs")}</span>
                <p className="text-[14px] text-[var(--ink-2)]">{t(`journey.${track}.${stages[sel].id}.outputs`)}</p>
                {stages[sel].deadline?.(client) && (
                  <p className="text-[14px]">
                    <span className="label mr-2">{t("journey.deadline")}</span>
                    <span className="num font-semibold">{fmt.date(stages[sel].deadline!(client)!)}</span>
                  </p>
                )}
              </div>
            </div>
          </section>
          <aside className="glass flex min-w-0 flex-col gap-4 p-5 md:p-6">
            <span className="label">{t("journey.status")}</span>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("journey.status")}>
              {(["todo", "doing", "done"] as StageStatus[]).map((st) => (
                <button
                  key={st}
                  type="button"
                  role="radio"
                  aria-checked={states[sel].status === st}
                  onClick={() => setStatus(sel, st)}
                  className={cn(
                    "h-9 rounded-[10px] border px-3.5 text-[13.5px] font-medium transition-colors",
                    states[sel].status === st ? "border-[var(--b-600)] bg-[var(--b-600)] text-white" : "border-[var(--rule)] bg-[var(--glass-strong)] hover:border-[var(--b-300)]",
                  )}
                >
                  {t(`journey.st.${st}`)}
                </button>
              ))}
            </div>
            <p className="text-[12.5px] text-[var(--ink-3)]">
              {states[sel].manual ? t("journey.manual") : states[sel].progress !== null ? t("journey.derived", { pct: fmt.percent(states[sel].progress ?? 0, 0) }) : t("journey.noData")}
              {states[sel].manual && (
                <button type="button" className="ml-2 underline" onClick={() => setStatus(sel, null)}>
                  {t("journey.clearManual")}
                </button>
              )}
            </p>
            <span className="label pt-2">{t("journey.tools")}</span>
            <ul className="flex flex-col gap-1.5">
              {stages[sel].tools.length === 0 && <li className="text-[13.5px] text-[var(--ink-3)]">{t("journey.noTool")}</li>}
              {stages[sel].tools.map((tool) => (
                <li key={tool}>
                  <Link href={`/${locale}${navHref(tool)}`} className="flex items-center justify-between gap-3 rounded-[10px] border border-[var(--rule)] bg-[var(--glass-strong)] px-3 py-2 text-[14px] font-medium no-underline hover:border-[var(--b-300)]">
                    {t(`nav.${tool}`)}
                    <ArrowUpRight size={15} aria-hidden className="text-[var(--accent-ink)]" />
                  </Link>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </div>
    </div>
  );
}

function whenLabel(m: number, t: (k: string, v?: Record<string, string | number>) => string) {
  if (m < 0) return t("journey.whenBefore", { m: Math.abs(m) });
  if (m === 0) return t("journey.whenAt");
  return t("journey.whenAfter", { m });
}

/**
 * Serpentine flow: stages snake across rows; connectors carry moving particles from finished
 * stages toward the open ones. Positions are computed from the container width.
 */
function FlowDiagram({
  labels,
  whens,
  states,
  selected,
  onSelect,
}: {
  labels: string[];
  whens: number[];
  states: { status: StageStatus; progress: number | null }[];
  selected: number;
  onSelect: (i: number) => void;
}) {
  const { t } = useI18n();
  const [ref, width] = useWidth<HTMLDivElement>(1000);
  const narrow = width < 640;
  const perRow = narrow ? 1 : Math.max(2, Math.min(4, Math.floor((width + 40) / (NODE_W + 72))));
  const gapX = narrow ? 0 : (width - perRow * NODE_W) / Math.max(1, perRow - 1);
  const rowH = narrow ? NODE_H + 44 : NODE_H + 76;
  const pos = useMemo(
    () =>
      labels.map((_, i) => {
        const row = Math.floor(i / perRow);
        const col = i % perRow;
        const c = row % 2 === 0 ? col : perRow - 1 - col;
        const x = narrow ? (width - NODE_W) / 2 : c * (NODE_W + gapX);
        return { x, y: row * rowH + 10, row };
      }),
    [labels, perRow, gapX, rowH, narrow, width],
  );
  const height = (Math.ceil(labels.length / perRow) - 1) * rowH + NODE_H + 24;

  const paths = pos.slice(0, -1).map((a, i) => {
    const b = pos[i + 1];
    if (a.row === b.row) {
      const forward = b.x > a.x;
      const x1 = forward ? a.x + NODE_W : a.x;
      const x2 = forward ? b.x : b.x + NODE_W;
      const y = a.y + NODE_H / 2;
      return `M${x1},${y} C${(x1 + x2) / 2},${y} ${(x1 + x2) / 2},${y} ${x2},${y}`;
    }
    // Row change: drop from the bottom of a to the top of b, bowing outward.
    const x1 = a.x + NODE_W / 2;
    const x2 = b.x + NODE_W / 2;
    const y1 = a.y + NODE_H;
    const y2 = b.y;
    const bow = narrow ? 0 : a.x > width / 2 ? 60 : -60;
    return `M${x1},${y1} C${x1 + bow},${y1 + 40} ${x2 + bow},${y2 - 40} ${x2},${y2}`;
  });

  return (
    <div ref={ref} className="relative" style={{ height }}>
      <svg data-chart width={width} height={height} className="absolute inset-0 overflow-visible" aria-hidden>
        <defs>
          <linearGradient id="flow-grad" x1="0" x2="1">
            <stop offset="0" stopColor="var(--b-600)" />
            <stop offset="1" stopColor="var(--b-400)" />
          </linearGradient>
        </defs>
        {paths.map((d, i) => {
          const live = states[i].status === "done";
          const next = states[i + 1].status;
          return (
            <g key={i}>
              <path d={d} fill="none" stroke="var(--b-200)" strokeWidth={6} strokeLinecap="round" />
              <path d={d} fill="none" stroke={live ? "url(#flow-grad)" : "var(--b-300)"} strokeWidth={2.5} strokeLinecap="round" strokeDasharray={live ? undefined : "6 7"} className={live ? undefined : "flow-dash"} />
              {live && (
                <g className="flow-particles">
                  {[0, 1, 2].map((k) => (
                    <circle key={k} r={next === "todo" ? 3 : 3.5} fill="var(--b-600)">
                      <animateMotion dur={next === "done" ? "3.2s" : "2.2s"} begin={`-${k * (next === "done" ? 1.05 : 0.73)}s`} repeatCount="indefinite" path={d} />
                    </circle>
                  ))}
                </g>
              )}
            </g>
          );
        })}
      </svg>
      {labels.map((label, i) => {
        const st = states[i];
        const on = i === selected;
        const Icon = st.status === "done" ? Check : st.status === "doing" ? LoaderCircle : CircleDashed;
        return (
          <button
            key={label}
            type="button"
            onClick={() => onSelect(i)}
            aria-pressed={on}
            aria-label={`${i + 1}. ${label} — ${t(`journey.st.${st.status}`)}`}
            className={cn(
              "flow-node absolute flex flex-col justify-between rounded-[16px] border p-3.5 text-left transition-[transform,box-shadow,border-color] duration-300",
              st.status === "done" && "border-transparent text-white",
              st.status === "doing" && "glass glass-strong border-[var(--b-500)]",
              st.status === "todo" && "glass border-dashed border-[var(--b-300)]",
              on ? "z-10 -translate-y-1 shadow-[0_24px_44px_-20px_rgba(31,52,160,0.75)] ring-2 ring-[var(--b-600)] ring-offset-2 ring-offset-[var(--ground)]" : "hover:-translate-y-0.5",
            )}
            style={{
              left: pos[i].x,
              top: pos[i].y,
              width: NODE_W,
              height: NODE_H,
              animationDelay: `${i * 70}ms`,
              background: st.status === "done" ? "linear-gradient(150deg, #2f4fe0 0%, #5a74f2 100%)" : undefined,
            }}
          >
            <span className="flex items-center justify-between">
              <span className={cn("num text-[12px] font-semibold", st.status === "done" ? "text-white/80" : "text-[var(--accent-ink)]")}>{String(i + 1).padStart(2, "0")}</span>
              <span className={cn("grid h-6 w-6 place-items-center rounded-full", st.status === "done" ? "bg-white/20" : "bg-[var(--b-100)] text-[var(--accent-ink)]")}>
                <Icon size={14} aria-hidden className={st.status === "doing" ? "flow-spin" : undefined} />
              </span>
            </span>
            <span className={cn("text-[14px] font-semibold leading-tight", st.status === "done" ? "text-white" : "text-[var(--ink)]")}>{label}</span>
            <span className="flex items-center gap-2">
              <span className={cn("h-1 flex-1 overflow-hidden rounded-full", st.status === "done" ? "bg-white/30" : "bg-[var(--b-100)]")}>
                <span className={cn("block h-full rounded-full", st.status === "done" ? "bg-white" : "bg-[var(--b-500)]")} style={{ width: `${(st.status === "done" ? 1 : (st.progress ?? (st.status === "doing" ? 0.5 : 0))) * 100}%` }} />
              </span>
              <span className={cn("text-[11px]", st.status === "done" ? "text-white/80" : "text-[var(--ink-3)]")}>{t("journey.whenShort", { m: whens[i] > 0 ? `+${whens[i]}` : String(whens[i]) })}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
