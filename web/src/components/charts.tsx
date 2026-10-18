"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { scaleLinear, scaleBand, scaleTime } from "d3-scale";
import { line as d3line, area as d3area, curveMonotoneX } from "d3-shape";
import { max, min } from "d3-array";

/** Width of the chart's container, so SVGs draw at true pixel scale (no stretched strokes or text). */
export function useWidth<T extends HTMLElement>(fallback = 720) {
  const ref = useRef<T>(null);
  const [w, setW] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.floor(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

const AXIS = { fontSize: 11.5, fill: "var(--ink-3)" } as const;

function Tooltip({ x, y, width, children }: { x: number; y: number; width: number; children: ReactNode }) {
  const left = Math.min(Math.max(x + 14, 0), width - 220);
  return (
    <div
      role="status"
      className="glass glass-strong pointer-events-none absolute z-10 w-[210px] rounded-[12px] px-3 py-2 text-[12.5px]"
      style={{ left, top: Math.max(0, y - 10) }}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
export type Series = { id: string; label: string; values: (number | null)[]; color: string; dash?: boolean; width?: number; area?: boolean };
export type Band = { id: string; label: string; lower: number[]; upper: number[]; fill: string };

export function LineChart({
  x,
  series,
  bands = [],
  markers = [],
  height = 320,
  yFormat,
  xFormat = (v) => String(v),
  zeroBased = true,
  label,
}: {
  x: number[];
  series: Series[];
  bands?: Band[];
  markers?: { x: number; label: string }[];
  height?: number;
  yFormat: (v: number) => string;
  xFormat?: (v: number) => string;
  zeroBased?: boolean;
  label: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const m = { t: 16, r: 16, b: 30, l: 64 };
  const all = [...series.flatMap((s) => s.values.filter((v): v is number => v !== null)), ...bands.flatMap((b) => [...b.lower, ...b.upper])];
  const yMax = (max(all) ?? 1) * 1.05 || 1;
  const yMin = zeroBased ? 0 : (min(all) ?? 0) * 0.95;
  const xs = scaleLinear().domain([x[0], x[x.length - 1]]).range([m.l, width - m.r]);
  const ys = scaleLinear().domain([yMin, yMax]).nice(5).range([height - m.b, m.t]);
  const ticks = ys.ticks(5);
  const maxTicks = width < 480 ? 5 : 10;
  const xTicks = x.length > maxTicks ? x.filter((_, i) => i % Math.ceil(x.length / maxTicks) === 0) : x;

  const paths = series.map((s) => {
        const pts = s.values.map((v, i) => [x[i], v] as const).filter((p): p is readonly [number, number] => p[1] !== null);
        const l = d3line<readonly [number, number]>().x((p) => xs(p[0])).y((p) => ys(p[1])).curve(curveMonotoneX)(pts) ?? "";
        const a = s.area ? d3area<readonly [number, number]>().x((p) => xs(p[0])).y0(ys(yMin)).y1((p) => ys(p[1])).curve(curveMonotoneX)(pts) ?? "" : "";
        return { s, l, a };
      });
  const bandPaths = bands.map((b) => ({
    b,
    d:
      d3area<number>()
        .x((_, i) => xs(x[i]))
        .y0((_, i) => ys(b.lower[i]))
        .y1((_, i) => ys(b.upper[i]))
        .curve(curveMonotoneX)(x.map((_, i) => i)) ?? "",
  }));

  const onMove = (e: React.MouseEvent<SVGRectElement>) => {
    const rect = (e.currentTarget as SVGRectElement).getBoundingClientRect();
    const px = e.clientX - rect.left + m.l;
    const v = xs.invert(px);
    let best = 0;
    x.forEach((xv, i) => {
      if (Math.abs(xv - v) < Math.abs(x[best] - v)) best = i;
    });
    setHover(best);
  };

  return (
    <div ref={ref} className="relative min-w-0">
      <svg data-chart width={width} height={height} role="img" aria-label={label} className="block overflow-visible">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={m.l} x2={width - m.r} y1={ys(t)} y2={ys(t)} stroke="var(--rule)" strokeWidth={1} />
            <text x={m.l - 8} y={ys(t)} dy="0.32em" textAnchor="end" {...AXIS} className="num">
              {yFormat(t)}
            </text>
          </g>
        ))}
        {bandPaths.map(({ b, d }) => (
          <path key={b.id} d={d} fill={b.fill} stroke="none" className="anim-fade" />
        ))}
        {markers.map((mk) => (
          <g key={mk.label}>
            <line x1={xs(mk.x)} x2={xs(mk.x)} y1={m.t} y2={height - m.b} stroke="var(--ink-3)" strokeDasharray="2 3" />
            <text x={xs(mk.x) + 4} y={m.t + 10} fontSize={11} fill="var(--ink-2)">
              {mk.label}
            </text>
          </g>
        ))}
        {paths.map(({ s, a }) => a && <path key={s.id + "a"} d={a} fill={s.color} opacity={0.12} className="anim-fade" />)}
        {paths.map(({ s, l }) => (
          s.dash ? (
            <path key={s.id} d={l} fill="none" stroke={s.color} strokeWidth={s.width ?? 2} strokeDasharray="6 5" strokeLinecap="round" className="anim-fade" />
          ) : (
            <path key={s.id} d={l} pathLength={1} fill="none" stroke={s.color} strokeWidth={s.width ?? 2} strokeLinecap="round" className="anim-line" />
          )
        ))}
        {paths.map(({ s }) => {
          const last = [...s.values].reverse().findIndex((v) => v !== null);
          if (last < 0) return null;
          const i = s.values.length - 1 - last;
          return <circle key={s.id + "e"} cx={xs(x[i])} cy={ys(s.values[i] as number)} r={3.2} fill="var(--paper)" stroke={s.color} strokeWidth={2} className="anim-pop" />;
        })}
        <line x1={m.l} x2={width - m.r} y1={height - m.b} y2={height - m.b} stroke="var(--rule-strong)" />
        {xTicks.map((t) => (
          <text key={t} x={xs(t)} y={height - m.b + 18} textAnchor="middle" {...AXIS} className="num">
            {xFormat(t)}
          </text>
        ))}
        {hover !== null && <line x1={xs(x[hover])} x2={xs(x[hover])} y1={m.t} y2={height - m.b} stroke="var(--ink)" strokeWidth={1} />}
        <rect x={m.l} y={m.t} width={Math.max(0, width - m.l - m.r)} height={height - m.t - m.b} fill="transparent" onMouseMove={onMove} onMouseLeave={() => setHover(null)} />
      </svg>
      {hover !== null && (
        <Tooltip x={xs(x[hover])} y={m.t} width={width}>
          <div className="mb-1 font-semibold num">{xFormat(x[hover])}</div>
          {series.map((s) =>
            s.values[hover] === null ? null : (
              <div key={s.id} className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 text-[var(--ink-2)]">
                  <span className="inline-block w-3 border-t-2" style={{ borderColor: s.color, borderTopStyle: s.dash ? "dashed" : "solid" }} />
                  {s.label}
                </span>
                <span className="num font-medium">{yFormat(s.values[hover] as number)}</span>
              </div>
            ),
          )}
        </Tooltip>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
export type Stack = { id: string; label: string; values: number[]; color: string; hatch?: boolean };

export function StackedBars({
  categories,
  stacks,
  overlay,
  height = 300,
  yFormat,
  label,
}: {
  categories: string[];
  stacks: Stack[];
  overlay?: Series[];
  height?: number;
  yFormat: (v: number) => string;
  label: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const m = { t: 14, r: 12, b: 30, l: 64 };
  const totals = categories.map((_, i) => stacks.reduce((s, st) => s + Math.max(0, st.values[i] ?? 0), 0));
  const overMax = max(overlay?.flatMap((s) => s.values.filter((v): v is number => v !== null)) ?? [0]) ?? 0;
  const yMax = Math.max(max(totals) ?? 0, overMax) * 1.08 || 1;
  const xs = scaleBand<string>().domain(categories).range([m.l, width - m.r]).padding(0.28);
  const ys = scaleLinear().domain([0, yMax]).nice(5).range([height - m.b, m.t]);
  return (
    <div ref={ref} className="relative min-w-0">
      <svg data-chart width={width} height={height} role="img" aria-label={label} className="block">
        <defs>
          <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="var(--paper)" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--ink-3)" strokeWidth="2" />
          </pattern>
        </defs>
        {ys.ticks(5).map((t) => (
          <g key={t}>
            <line x1={m.l} x2={width - m.r} y1={ys(t)} y2={ys(t)} stroke="var(--rule)" />
            <text x={m.l - 8} y={ys(t)} dy="0.32em" textAnchor="end" {...AXIS} className="num">
              {yFormat(t)}
            </text>
          </g>
        ))}
        {categories.map((c, i) => {
          const tops = stacks.reduce<number[]>((arr, st) => [...arr, (arr.at(-1) ?? 0) + Math.max(0, st.values[i] ?? 0)], []);
          return (
            <g key={c} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={xs(c)! - 4} y={m.t} width={xs.bandwidth() + 8} height={height - m.t - m.b} fill={hover === i ? "var(--paper-2)" : "transparent"} />
              {stacks.map((st, k) => {
                const y0 = ys(k === 0 ? 0 : tops[k - 1]);
                const y1 = ys(tops[k]);
                return (
                  <rect
                    key={st.id}
                    x={xs(c)}
                    y={y1}
                    width={xs.bandwidth()}
                    height={Math.max(0, y0 - y1)}
                    fill={st.hatch ? "url(#hatch)" : st.color}
                    stroke={st.hatch ? st.color : "var(--paper)"}
                    strokeWidth={st.hatch ? 1 : 0.75}
                    className="anim-bar"
                    style={{ ["--i" as string]: i, transformOrigin: `50% ${ys(0) - y1}px` }}
                  />
                );
              })}
            </g>
          );
        })}
        {overlay?.map((s) => {
          const pts = s.values.map((v, i) => [xs(categories[i])! + xs.bandwidth() / 2, v] as const).filter((p): p is readonly [number, number] => p[1] !== null);
          const d = d3line<readonly [number, number]>().x((p) => p[0]).y((p) => ys(p[1]))(pts) ?? "";
          return <path key={s.id} d={d} fill="none" stroke={s.color} strokeWidth={2} strokeDasharray={s.dash ? "6 5" : undefined} className="anim-fade" />;
        })}
        <line x1={m.l} x2={width - m.r} y1={height - m.b} y2={height - m.b} stroke="var(--rule-strong)" />
        {categories.map((c) => (
          <text key={c} x={xs(c)! + xs.bandwidth() / 2} y={height - m.b + 18} textAnchor="middle" {...AXIS} className="num">
            {c}
          </text>
        ))}
      </svg>
      {hover !== null && (
        <Tooltip x={xs(categories[hover])! + xs.bandwidth()} y={m.t} width={width}>
          <div className="mb-1 font-semibold num">{categories[hover]}</div>
          {[...stacks].reverse().map((st) => (
            <div key={st.id} className="flex justify-between gap-3">
              <span className="inline-flex items-center gap-1.5 text-[var(--ink-2)]">
                <span className="inline-block h-2.5 w-2.5" style={{ background: st.hatch ? "var(--ink-3)" : st.color }} />
                {st.label}
              </span>
              <span className="num">{yFormat(st.values[hover] ?? 0)}</span>
            </div>
          ))}
          {overlay?.map((s) =>
            s.values[hover] === null ? null : (
              <div key={s.id} className="flex justify-between gap-3 border-t border-[var(--rule)] pt-1">
                <span className="text-[var(--ink-2)]">{s.label}</span>
                <span className="num">{yFormat(s.values[hover] as number)}</span>
              </div>
            ),
          )}
        </Tooltip>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
export type Step = { id: string; label: string; value: number; color: string; total?: boolean; dash?: boolean };

/** Waterfall: each step floats from the running total; total bars stand on the axis. */
export function Waterfall({ steps, height = 300, yFormat, label }: { steps: Step[]; height?: number; yFormat: (v: number) => string; label: string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const m = { t: 22, r: 12, b: 44, l: 64 };
  const bars: (Step & { y0: number; y1: number })[] = [];
  for (const s of steps) {
    const prev = bars.length ? bars[bars.length - 1].y1 : 0;
    bars.push(s.total ? { ...s, y0: 0, y1: s.value } : { ...s, y0: prev, y1: prev + s.value });
  }
  const yMax = (max(bars.map((b) => Math.max(b.y0, b.y1))) ?? 1) * 1.1 || 1;
  const yMin = Math.min(0, min(bars.map((b) => Math.min(b.y0, b.y1))) ?? 0);
  const xs = scaleBand<string>().domain(steps.map((s) => s.id)).range([m.l, width - m.r]).padding(0.25);
  const ys = scaleLinear().domain([yMin, yMax]).nice(5).range([height - m.b, m.t]);
  return (
    <div ref={ref} className="min-w-0">
      <svg data-chart width={width} height={height} role="img" aria-label={label} className="block">
        {ys.ticks(5).map((t) => (
          <g key={t}>
            <line x1={m.l} x2={width - m.r} y1={ys(t)} y2={ys(t)} stroke="var(--rule)" />
            <text x={m.l - 8} y={ys(t)} dy="0.32em" textAnchor="end" {...AXIS} className="num">
              {yFormat(t)}
            </text>
          </g>
        ))}
        {bars.map((b, i) => {
          const top = ys(Math.max(b.y0, b.y1));
          const h = Math.max(1, Math.abs(ys(b.y0) - ys(b.y1)));
          const x = xs(b.id)!;
          const next = bars[i + 1];
          return (
            <g key={b.id}>
              <rect
                x={x}
                y={top}
                width={xs.bandwidth()}
                height={h}
                fill={b.color}
                stroke={b.dash ? "var(--ink)" : "none"}
                strokeDasharray={b.dash ? "4 3" : undefined}
                fillOpacity={b.dash ? 0.55 : 1}
                className={b.y1 < b.y0 ? "anim-bar down" : "anim-bar"}
                style={{ ["--i" as string]: i }}
              />
              <text x={x + xs.bandwidth() / 2} y={top - 6} textAnchor="middle" fontSize={11.5} fill="var(--ink)" className="num">
                {yFormat(b.total ? b.value : b.y1 - b.y0)}
              </text>
              {next && !next.total && <line x1={x + xs.bandwidth()} x2={xs(next.id)!} y1={ys(b.y1)} y2={ys(b.y1)} stroke="var(--ink-3)" strokeDasharray="2 2" />}
            </g>
          );
        })}
        <line x1={m.l} x2={width - m.r} y1={ys(0)} y2={ys(0)} stroke="var(--rule-strong)" />
        {bars.map((b) => (
          <foreignObject key={b.id + "l"} x={xs(b.id)! - 8} y={height - m.b + 6} width={xs.bandwidth() + 16} height={m.b - 6}>
            <div className="text-center text-[11px] leading-tight text-[var(--ink-2)]">{b.label}</div>
          </foreignObject>
        ))}
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
export type Point = { id: string; label: string; x: number; y: number; color: string; material: boolean };

/** Double materiality matrix: financial (x) vs impact (y) on 0–5, threshold lines split the quadrants. */
export function MaterialityMatrix({
  points,
  threshold,
  xLabel,
  yLabel,
  label,
  onSelect,
  selected,
}: {
  points: Point[];
  threshold: number;
  xLabel: string;
  yLabel: string;
  label: string;
  onSelect?: (id: string) => void;
  selected?: string | null;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const size = Math.min(width, 560);
  const m = { t: 14, r: 34, b: 42, l: 48 };
  const xs = scaleLinear().domain([0, 5]).range([m.l, size - m.r]);
  const ys = scaleLinear().domain([0, 5]).range([size - m.b, m.t]);
  return (
    <div ref={ref} className="min-w-0">
      <svg data-chart width={size} height={size} role="img" aria-label={label} className="block">
        <rect x={xs(threshold)} y={m.t} width={xs(5) - xs(threshold)} height={ys(threshold) - m.t} fill="var(--th-energy-wash)" />
        <rect x={m.l} y={m.t} width={xs(threshold) - m.l} height={ys(threshold) - m.t} fill="var(--paper-2)" />
        <rect x={xs(threshold)} y={ys(threshold)} width={xs(5) - xs(threshold)} height={ys(0) - ys(threshold)} fill="var(--paper-2)" />
        {[1, 2, 3, 4, 5].map((t) => (
          <g key={t}>
            <line x1={xs(t)} x2={xs(t)} y1={m.t} y2={size - m.b} stroke="var(--rule)" />
            <line x1={m.l} x2={size - m.r} y1={ys(t)} y2={ys(t)} stroke="var(--rule)" />
            <text x={xs(t)} y={size - m.b + 16} textAnchor="middle" {...AXIS}>
              {t}
            </text>
            <text x={m.l - 10} y={ys(t)} dy="0.32em" textAnchor="end" {...AXIS}>
              {t}
            </text>
          </g>
        ))}
        <line x1={xs(threshold)} x2={xs(threshold)} y1={m.t} y2={size - m.b} stroke="var(--ink)" strokeDasharray="5 4" />
        <line x1={m.l} x2={size - m.r} y1={ys(threshold)} y2={ys(threshold)} stroke="var(--ink)" strokeDasharray="5 4" />
        <line x1={m.l} x2={size - m.r} y1={size - m.b} y2={size - m.b} stroke="var(--rule-strong)" />
        <line x1={m.l} x2={m.l} y1={m.t} y2={size - m.b} stroke="var(--rule-strong)" />
        <text x={(m.l + size - m.r) / 2} y={size - 6} textAnchor="middle" fontSize={12} fill="var(--ink-2)">
          {xLabel}
        </text>
        <text transform={`translate(14 ${(m.t + size - m.b) / 2}) rotate(-90)`} textAnchor="middle" fontSize={12} fill="var(--ink-2)">
          {yLabel}
        </text>
        {points.map((p) => (
          <g key={p.id} className="anim-pop cursor-pointer" style={{ ["--i" as string]: points.indexOf(p) }} onClick={() => onSelect?.(p.id)} tabIndex={0} role="button" aria-label={`${p.label}: ${p.x.toFixed(1)} / ${p.y.toFixed(1)}`} onKeyDown={(e) => e.key === "Enter" && onSelect?.(p.id)}>
            <circle cx={xs(p.x)} cy={ys(p.y)} r={selected === p.id ? 9 : 7} fill={p.material ? p.color : "var(--paper)"} stroke={p.color} strokeWidth={2} strokeDasharray={p.material ? undefined : "3 2"} />
            <text x={xs(p.x) + 11} y={ys(p.y)} dy="0.32em" fontSize={12} fontWeight={600} fill="var(--ink)">
              {p.id}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
export type TimelineEvent = { id: string; lane: string; date: string; label: string; confidence: "official" | "secondary" | "unverified"; approx?: boolean };

export function Timeline({
  lanes,
  events,
  from,
  to,
  today,
  label,
  fmtDate,
}: {
  lanes: { id: string; label: string; color: string }[];
  events: TimelineEvent[];
  from: string;
  to: string;
  /** Today's day; omitted while it is not known (static render), then no "today" line is drawn. */
  today?: string;
  label: string;
  fmtDate: (iso: string) => string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>(960);
  const inner = Math.max(width, 760);
  const laneH = 92;
  const m = { t: 28, r: 20, b: 8, l: 132 };
  const height = m.t + lanes.length * laneH + m.b;
  const xs = scaleTime().domain([new Date(from), new Date(to)]).range([m.l, inner - m.r]);
  const [hover, setHover] = useState<TimelineEvent | null>(null);
  const years = xs.ticks(8);
  return (
    <div ref={ref} className="relative min-w-0 overflow-x-auto">
      <svg data-chart width={inner} height={height} role="img" aria-label={label} className="block">
        {years.map((y) => (
          <g key={y.toISOString()}>
            <line x1={xs(y)} x2={xs(y)} y1={m.t - 6} y2={height - m.b} stroke="var(--rule)" />
            <text x={xs(y) + 4} y={m.t - 12} {...AXIS} className="num">
              {y.getFullYear()}
            </text>
          </g>
        ))}
        {lanes.map((l, i) => {
          const y = m.t + i * laneH;
          const evs = events.filter((e) => e.lane === l.id).sort((a, b) => a.date.localeCompare(b.date));
          const rows: number[] = [];
          evs.forEach((e, k) => {
            const gap = k === 0 ? Infinity : xs(new Date(e.date)) - xs(new Date(evs[k - 1].date));
            rows.push(gap < 26 ? (rows[k - 1] + 1) % 3 : 0);
          });
          return (
            <g key={l.id}>
              <line x1={m.l} x2={inner - m.r} y1={y + laneH - 0.5} y2={y + laneH - 0.5} stroke="var(--rule)" />
              <circle cx={5} cy={y + laneH / 2} r={4} fill={l.color} />
              <text x={16} y={y + laneH / 2} dy="0.32em" fontSize={13} fontWeight={600} fill="var(--ink)">
                {l.label}
              </text>
              <line x1={m.l} x2={inner - m.r} y1={y + laneH / 2} y2={y + laneH / 2} stroke={l.color} strokeOpacity={0.35} strokeWidth={1.5} />
              {evs.map((e, k) => {
                const x = xs(new Date(e.date));
                const row = rows[k];
                const cy = y + laneH / 2 + (row === 0 ? 0 : row === 1 ? -22 : 22);
                const past = today !== undefined && e.date < today;
                return (
                  <g key={e.id} onMouseEnter={() => setHover(e)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(e)} onBlur={() => setHover(null)} tabIndex={0} role="button" aria-label={`${fmtDate(e.date)} — ${e.label}`}>
                    {row !== 0 && <line x1={x} x2={x} y1={y + laneH / 2} y2={cy} stroke={l.color} strokeOpacity={0.5} />}
                    <circle
                      cx={x}
                      cy={cy}
                      r={6}
                      fill={past ? "var(--paper)" : e.confidence === "official" ? l.color : "var(--paper)"}
                      stroke={l.color}
                      strokeWidth={2}
                      strokeDasharray={e.confidence === "official" ? undefined : e.confidence === "secondary" ? "3 2" : "1 2"}
                      opacity={past ? 0.55 : 1}
                      className="anim-pop"
                      style={{ ["--i" as string]: k }}
                    />
                  </g>
                );
              })}
            </g>
          );
        })}
        {today && <line x1={xs(new Date(today))} x2={xs(new Date(today))} y1={m.t - 6} y2={height - m.b} stroke="var(--crit)" strokeWidth={1.5} />}
      </svg>
      {hover && (
        <Tooltip x={xs(new Date(hover.date))} y={m.t + lanes.findIndex((l) => l.id === hover.lane) * laneH + 10} width={inner}>
          <div className="num font-semibold">
            {hover.approx ? "≈ " : ""}
            {fmtDate(hover.date)}
          </div>
          <div className="text-[var(--ink-2)]">{hover.label}</div>
        </Tooltip>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
export function MaccChart({
  segments,
  height = 300,
  label,
  xFormat,
  yFormat,
  carbonPrice,
  carbonPriceLabel,
}: {
  segments: { id: string; name: string; x0: number; x1: number; cost: number; color: string }[];
  height?: number;
  label: string;
  xFormat: (v: number) => string;
  yFormat: (v: number) => string;
  carbonPrice?: number;
  carbonPriceLabel?: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<string | null>(null);
  const m = { t: 18, r: 16, b: 30, l: 64 };
  const xMax = max(segments.map((s) => s.x1)) ?? 1;
  const costs = segments.map((s) => s.cost).concat(carbonPrice ?? 0, 0);
  const xs = scaleLinear().domain([0, xMax || 1]).range([m.l, width - m.r]);
  const ys = scaleLinear().domain([Math.min(...costs) * 1.15, Math.max(...costs) * 1.15]).nice(5).range([height - m.b, m.t]);
  const hs = segments.find((s) => s.id === hover);
  return (
    <div ref={ref} className="relative min-w-0">
      <svg data-chart width={width} height={height} role="img" aria-label={label} className="block">
        {ys.ticks(5).map((t) => (
          <g key={t}>
            <line x1={m.l} x2={width - m.r} y1={ys(t)} y2={ys(t)} stroke="var(--rule)" />
            <text x={m.l - 8} y={ys(t)} dy="0.32em" textAnchor="end" {...AXIS} className="num">
              {yFormat(t)}
            </text>
          </g>
        ))}
        {segments.map((s) => (
          <rect
            key={s.id}
            x={xs(s.x0) + 0.5}
            width={Math.max(1, xs(s.x1) - xs(s.x0) - 1)}
            y={Math.min(ys(0), ys(s.cost))}
            height={Math.max(1, Math.abs(ys(0) - ys(s.cost)))}
            fill={s.color}
            opacity={hover && hover !== s.id ? 0.45 : 1}
            className={s.cost < 0 ? "anim-bar down" : "anim-bar"}
            style={{ ["--i" as string]: segments.indexOf(s), transition: "opacity 160ms" }}
            onMouseEnter={() => setHover(s.id)}
            onMouseLeave={() => setHover(null)}
          />
        ))}
        <line x1={m.l} x2={width - m.r} y1={ys(0)} y2={ys(0)} stroke="var(--rule-strong)" />
        {carbonPrice !== undefined && (
          <g>
            <line x1={m.l} x2={width - m.r} y1={ys(carbonPrice)} y2={ys(carbonPrice)} stroke="var(--th-climate-ink)" strokeDasharray="6 4" />
            <text x={width - m.r} y={ys(carbonPrice) - 6} textAnchor="end" fontSize={11.5} fill="var(--th-climate)">
              {carbonPriceLabel}
            </text>
          </g>
        )}
        {xs.ticks(5).map((t) => (
          <text key={t} x={xs(t)} y={height - m.b + 18} textAnchor="middle" {...AXIS} className="num">
            {xFormat(t)}
          </text>
        ))}
      </svg>
      {hs && (
        <Tooltip x={xs(hs.x1)} y={m.t} width={width}>
          <div className="font-semibold">{hs.name}</div>
          <div className="flex justify-between">
            <span className="text-[var(--ink-2)]">€/tCO₂e</span>
            <span className="num">{yFormat(hs.cost)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--ink-2)]">tCO₂e/yr</span>
            <span className="num">{xFormat(hs.x1 - hs.x0)}</span>
          </div>
        </Tooltip>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
export type SankeyNode = { id: string; label: string; column: 0 | 1 };
export type SankeyLink = { from: string; to: string; value: number; color: string; dash?: boolean };

/** Two-column flow diagram (sources → scopes): ribbon width follows the value. Light-theme SVG. */export function Sankey({
  nodes,
  links,
  height = 340,
  label,
  valueFormat,
}: {
  nodes: SankeyNode[];
  links: SankeyLink[];
  height?: number;
  label: string;
  valueFormat: (v: number) => string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const m = { t: 14, r: 176, b: 14, l: 176 };
  const plotH = height - m.t - m.b;
  const gap = 10;
  const flows = links.filter((l) => l.value > 0);
  const val = (id: string, col: 0 | 1) => flows.filter((l) => (col === 0 ? l.from === id : l.to === id)).reduce((s, l) => s + l.value, 0);
  const live = nodes.filter((n) => val(n.id, n.column) > 0);
  const total = Math.max(1e-9, ...([0, 1] as const).map((c) => live.filter((n) => n.column === c).reduce((s, n) => s + val(n.id, c), 0)));
  const k = (plotH - gap * Math.max(0, live.length - 1)) / total;
  const bars = new Map<string, { y: number; h: number }>();
  ([0, 1] as const).forEach((c) => {
    let y = m.t;
    for (const n of live.filter((x) => x.column === c)) {
      const h = Math.max(2, val(n.id, c) * k);
      bars.set(n.id, { y, h });
      y += h + gap;
    }
  });
  const off = new Map<string, number>();
  const ribbons = flows.map((l) => {
    const a = bars.get(l.from)!;
    const b = bars.get(l.to)!;
    const ya = a.y + (off.get(l.from) ?? 0) + (l.value * k) / 2;
    const yb = b.y + (off.get(l.to) ?? 0) + (l.value * k) / 2;
    off.set(l.from, (off.get(l.from) ?? 0) + l.value * k);
    off.set(l.to, (off.get(l.to) ?? 0) + l.value * k);
    const x0 = m.l;
    const x1 = width - m.r;
    const mx = (x0 + x1) / 2;
    return { l, ya, yb, d: `M ${x0} ${ya} C ${mx} ${ya}, ${mx} ${yb}, ${x1} ${yb}`, w: Math.max(1.5, l.value * k) };
  });
  return (
    <div ref={ref} className="min-w-0">
      <svg data-chart width={width} height={height} role="img" aria-label={label} className="block">
        {ribbons.map(({ l, d, w }) => (
          <path key={l.from + l.to} d={d} fill="none" stroke={l.color} strokeWidth={w} strokeOpacity={0.45} strokeDasharray={l.dash ? "5 4" : undefined} strokeLinecap="round" />
        ))}
        {live.map((n) => {
          const b = bars.get(n.id)!;
          const left = n.column === 0;
          const x = left ? m.l - 9 : width - m.r + 1;
          return (
            <g key={n.id}>
              <rect x={x} y={b.y} width={8} height={b.h} rx={2} fill="var(--ink)" />
              <text x={left ? x - 6 : x + 14} y={b.y + Math.max(11, b.h / 2)} dy="0.32em" textAnchor={left ? "end" : "start"} fontSize={11} fill="var(--ink-2)">
                {n.label} · <tspan className="num">{valueFormat(val(n.id, n.column))}</tspan>
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Horizontal proportion bar used in KPI rows (taxonomy, recovery rates). */
export function ShareBar({ parts, label }: { parts: { value: number; color: string; label: string; hatch?: boolean }[]; label: string }) {
  return (
    <div role="img" aria-label={label} className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full bg-[var(--paper-3)]">
      {parts.map((p) => (
        <div
          key={p.label}
          title={p.label}
          className="anim-bar-x"
          style={{
            ["--i" as string]: parts.indexOf(p),
            width: `${Math.max(0, Math.min(1, p.value)) * 100}%`,
            background: p.hatch ? `repeating-linear-gradient(45deg, ${p.color} 0 2px, transparent 2px 6px)` : p.color,
          }}
        />
      ))}
    </div>
  );
}
