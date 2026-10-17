"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { arc as d3arc } from "d3-shape";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { useI18n } from "@/i18n/provider";
import { localeInfo } from "@/i18n/core";
import { PILLAR_THEME, THEME, th, type Pillar, type ThemeId } from "@/data/themes";
import { easeOut, formatShape, parseShape } from "@/lib/countup";
import { useWidth } from "./charts";
import { cn } from "./ui";

/* Analysis kit: the pieces every table and chart shares so themes read the same on every screen. */

const CHIP = { sm: { box: 22, icon: 13, r: 7 }, md: { box: 28, icon: 15, r: 8 }, lg: { box: 40, icon: 20, r: 12 } } as const;

/** Duotone theme chip: the theme's wash with its ink icon; `solid` inverts it for selected states. */
export function ThemeIcon({ theme, size = "md", solid, className, title }: { theme: ThemeId; size?: keyof typeof CHIP; solid?: boolean; className?: string; title?: string }) {
  const tm = THEME[theme];
  const Icon = tm.icon;
  const s = CHIP[size];
  return (
    <span
      className={cn("th-icon inline-grid shrink-0 place-items-center border", className)}
      data-motion={tm.motion}
      title={title}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      aria-label={title}
      style={{
        width: s.box,
        height: s.box,
        borderRadius: s.r,
        background: solid ? th(theme, "ink") : th(theme, "wash"),
        borderColor: solid ? "transparent" : `color-mix(in srgb, ${th(theme, "light")} 80%, transparent)`,
        color: solid ? "#fff" : th(theme, "ink"),
      }}
    >
      <Icon size={s.icon} strokeWidth={1.8} aria-hidden />
    </span>
  );
}

/** Theme name with its chip, for row labels and legends. */
export function ThemeLabel({ theme, children, size = "sm", className }: { theme: ThemeId; children?: ReactNode; size?: keyof typeof CHIP; className?: string }) {
  const { t } = useI18n();
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2", className)}>
      <ThemeIcon theme={theme} size={size} />
      <span className="min-w-0">{children ?? t(`theme.${theme}`)}</span>
    </span>
  );
}

/** Legend key that carries the theme icon as well as its colour. */
export function ThemeLegend({ themes, labels }: { themes: ThemeId[]; labels?: Partial<Record<ThemeId, string>> }) {
  const { t } = useI18n();
  return (
    <>
      {themes.map((id) => (
        <span key={id} className="group inline-flex items-center gap-1.5">
          <ThemeIcon theme={id} size="sm" />
          {labels?.[id] ?? t(`theme.${id}`)}
        </span>
      ))}
    </>
  );
}

/** Pillar legend: E / S / G keyed to their theme colours. */
export function PillarLegend({ pillars }: { pillars: Pillar[] }) {
  const { t } = useI18n();
  return (
    <>
      {pillars.map((p) => (
        <span key={p} className="inline-flex items-center gap-2">
          <span aria-hidden className="inline-block h-3 w-3 rounded-[3px]" style={{ background: th(PILLAR_THEME[p]) }} />
          {t(`pillar.${p}`)}
        </span>
      ))}
    </>
  );
}

/** A tinted chapter row inside a `.report-table`: theme icon, title and an optional right-hand note. */
export function GroupRow({ theme, colSpan, title, aside }: { theme?: ThemeId; colSpan: number; title: ReactNode; aside?: ReactNode }) {
  const style = theme ? ({ "--row-wash": th(theme, "wash"), "--row-ink": th(theme, "ink") } as CSSProperties) : undefined;
  return (
    <tr className="group-row group" style={style}>
      <td colSpan={aside ? colSpan - 1 : colSpan}>
        <span className="inline-flex items-center gap-2.5">
          {theme && <ThemeIcon theme={theme} size="sm" />}
          {title}
        </span>
      </td>
      {aside && <td className="r text-[12.5px] font-medium">{aside}</td>}
    </tr>
  );
}

/** In-cell proportion bar with an optional target tick; grows in on mount. */
export function InlineBar({ value, color = "var(--fam, var(--b-600))", target, label, index = 0, width = 96 }: { value: number; color?: string; target?: number; label: string; index?: number; width?: number }) {
  const v = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  return (
    <span role="img" aria-label={label} className="relative inline-block h-1.5 shrink-0 rounded-full bg-[var(--b-100)] align-middle" style={{ width }}>
      <span className="anim-bar-x absolute inset-y-0 left-0 rounded-full" style={{ width: `${v * 100}%`, background: color, ["--i" as string]: index }} />
      {target !== undefined && <span aria-hidden className="absolute -top-1 h-3.5 w-[2px] rounded-full bg-[var(--ink)]" style={{ left: `calc(${Math.max(0, Math.min(1, target)) * 100}% - 1px)` }} />}
    </span>
  );
}

/** Segmented 1…max score scale (materiality, readiness): filled steps climb the theme ramp; a chip marks the score. */
export function ScoreScale({ value, max = 5, theme, threshold, label }: { value: number; max?: number; theme: ThemeId; threshold?: number; label: string }) {
  const steps = Array.from({ length: max }, (_, i) => i + 1);
  const tone = (i: number) => (i <= max * 0.4 ? th(theme, "light") : i <= max * 0.8 ? th(theme, "mid") : th(theme, "strong"));
  const pos = Math.max(0, Math.min(1, (value - 0.5) / max));
  return (
    <span role="img" aria-label={label} className="relative inline-flex h-5 w-[118px] shrink-0 items-center gap-[3px] align-middle">
      {steps.map((s) => (
        <span key={s} className="h-1.5 flex-1 rounded-full transition-colors duration-200" style={{ background: s <= Math.round(value) ? tone(s) : "var(--b-100)" }} />
      ))}
      {threshold !== undefined && <span aria-hidden className="absolute top-0 h-5 w-px border-l border-dashed border-[var(--ink-2)]" style={{ left: `${((threshold - 0.5) / max) * 100}%` }} />}
      <span
        aria-hidden
        className="num absolute top-1/2 grid h-[18px] min-w-[18px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-[6px] px-1 text-[10.5px] font-semibold text-white shadow-[0_4px_10px_-6px_rgba(14,26,70,0.7)] transition-[left] duration-300"
        style={{ left: `${pos * 100}%`, background: th(theme, "ink") }}
      >
        {Number.isInteger(value) ? value : value.toFixed(1)}
      </span>
    </span>
  );
}

/** Change against a baseline. Colour says good or bad (not up or down) and always comes with an arrow. */
export function Delta({ value, better, text }: { value: number; better: "up" | "down"; text: string }) {
  const flat = !Number.isFinite(value) || Math.abs(value) < 1e-9;
  const good = !flat && (better === "up" ? value > 0 : value < 0);
  const Icon = flat ? Minus : value > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("num inline-flex items-center gap-0.5 whitespace-nowrap text-[12.5px] font-semibold", flat ? "text-[var(--ink-3)]" : good ? "text-[var(--ok)]" : "text-[var(--crit)]")}>
      <Icon size={14} strokeWidth={2.2} aria-hidden />
      {text}
    </span>
  );
}

function reducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/** Counts a formatted figure up from zero once, on mount; text without a number renders as is. */
export function CountUp({ text, duration = 700 }: { text: string; duration?: number }) {
  const { locale } = useI18n();
  const intl = localeInfo(locale).intl;
  const [shown, setShown] = useState(text);
  const played = useRef(false);
  useLayoutEffect(() => {
    const shape = parseShape(text, intl);
    if (played.current || !shape || reducedMotion()) {
      setShown(text);
      return;
    }
    played.current = true;
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = easeOut((now - t0) / duration);
      setShown(p >= 1 ? text : formatShape(shape, shape.value * p, intl));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    setShown(formatShape(shape, 0, intl));
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text, intl, duration]);
  return (
    <>
      <span aria-hidden>{shown}</span>
      <span className="sr-only">{text}</span>
    </>
  );
}

// ---------------------------------------------------------------------------
export type RingItem = { id: string; label: string; theme: ThemeId; pillar: Pillar; value: number; strong: boolean };

/**
 * Theme ring: the pillar ring outside, one wedge per item inside whose length is its score and whose
 * colour is its theme; strong (e.g. material) items fill solid, the rest stay light with a dashed edge.
 */
export function ThemeRing({ items, max, center, label, selected, onSelect }: { items: RingItem[]; max: number; center: { value: string; label: string }; label: string; selected?: string | null; onSelect?: (id: string) => void }) {
  const { t } = useI18n();
  const [ref, width] = useWidth<HTMLDivElement>(420);
  const [hover, setHover] = useState<string | null>(null);
  const size = Math.min(width, 440);
  const c = size / 2;
  const R = c - 4;
  const ringIn = R - 18;
  const iconR = ringIn - 22;
  const outer = iconR - 18;
  const inner = Math.max(34, R * 0.27);
  const n = Math.max(1, items.length);
  const step = (Math.PI * 2) / n;
  const pad = 0.012;
  const wedge = d3arc<{ i: number; r: number }>()
    .innerRadius(inner)
    .outerRadius((d) => d.r)
    .startAngle((d) => d.i * step + pad)
    .endAngle((d) => (d.i + 1) * step - pad)
    .cornerRadius(3);
  const pillars = items.reduce<{ p: Pillar; from: number; to: number }[]>((acc, it, i) => {
    const last = acc.at(-1);
    if (last && last.p === it.pillar) last.to = i + 1;
    else acc.push({ p: it.pillar, from: i, to: i + 1 });
    return acc;
  }, []);
  const ring = d3arc<{ from: number; to: number }>()
    .innerRadius(ringIn)
    .outerRadius(R)
    .startAngle((d) => d.from * step + 0.01)
    .endAngle((d) => d.to * step - 0.01)
    .cornerRadius(8);
  const at = (i: number, r: number) => {
    const a = (i + 0.5) * step - Math.PI / 2;
    return [c + r * Math.cos(a), c + r * Math.sin(a)] as const;
  };
  const focus = items.find((it) => it.id === (hover ?? selected));
  const origin: CSSProperties = { transformBox: "view-box", transformOrigin: `${c}px ${c}px` };
  return (
    <div ref={ref} className="relative min-w-0">
      <svg data-chart width={size} height={size} role="img" aria-label={label} className="mx-auto block overflow-visible">
        {pillars.map((p, k) => {
          const id = `ring-${p.p}-${k}`;
          const mid = ((p.from + p.to) / 2) * step;
          const flip = mid > Math.PI / 2 && mid < (Math.PI * 3) / 2;
          const r = (ringIn + R) / 2;
          const a0 = p.from * step + 0.03;
          const a1 = p.to * step - 0.03;
          const pt = (a: number) => `${c + r * Math.sin(a)} ${c - r * Math.cos(a)}`;
          const large = a1 - a0 > Math.PI ? 1 : 0;
          const d = flip ? `M ${pt(a1)} A ${r} ${r} 0 ${large} 0 ${pt(a0)}` : `M ${pt(a0)} A ${r} ${r} 0 ${large} 1 ${pt(a1)}`;
          return (
            <g key={id} className="anim-arc" style={{ ...origin, ["--i" as string]: k }}>
              <path d={ring(p) ?? ""} transform={`translate(${c} ${c})`} fill={th(PILLAR_THEME[p.p])} />
              <path id={id} d={d} fill="none" stroke="none" />
              <text fontSize={10.5} fontWeight={700} letterSpacing="0.12em" fill="#fff" dy="0.35em">
                <textPath href={`#${id}`} startOffset="50%" textAnchor="middle">
                  {t(`pillar.${p.p}`).toLocaleUpperCase()}
                </textPath>
              </text>
            </g>
          );
        })}
        {items.map((it, i) => {
          const r = inner + (outer - inner) * Math.max(0.06, Math.min(1, it.value / max));
          const on = it.id === (hover ?? selected);
          const [ix, iy] = at(i, iconR);
          const Icon = THEME[it.theme].icon;
          return (
            <g
              key={it.id}
              className="anim-arc cursor-pointer outline-none"
              style={{ ...origin, ["--i" as string]: i + 2 }}
              role="button"
              tabIndex={0}
              aria-label={`${it.id} ${it.label}: ${it.value.toFixed(1)} / ${max}`}
              onMouseEnter={() => setHover(it.id)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(it.id)}
              onBlur={() => setHover(null)}
              onClick={() => onSelect?.(it.id)}
              onKeyDown={(e) => e.key === "Enter" && onSelect?.(it.id)}
            >
              <path d={wedge({ i, r: outer }) ?? ""} transform={`translate(${c} ${c})`} fill={th(it.theme, "wash")} />
              <path
                d={wedge({ i, r }) ?? ""}
                transform={`translate(${c} ${c})`}
                fill={it.strong ? th(it.theme) : th(it.theme, "light")}
                stroke={it.strong ? "none" : th(it.theme, "ink")}
                strokeWidth={1.2}
                strokeDasharray={it.strong ? undefined : "3 2"}
                opacity={hover && !on ? 0.55 : 1}
                style={{ transition: "opacity 160ms" }}
              />
              <circle cx={ix} cy={iy} r={on ? 14 : 12.5} fill={on ? th(it.theme, "ink") : "var(--paper)"} stroke={th(it.theme, "light")} style={{ transition: "r 160ms" }} />
              <Icon x={ix - 7} y={iy - 7} width={14} height={14} strokeWidth={1.9} color={on ? "#fff" : `var(--th-${it.theme}-ink)`} aria-hidden />
            </g>
          );
        })}
        <circle cx={c} cy={c} r={inner - 4} fill="var(--paper)" stroke="var(--b-100)" />
        <text x={c} y={c - 4} textAnchor="middle" className="figure-num" fontSize={focus ? 22 : 30} fill="var(--ink)">
          {focus ? focus.id : center.value}
        </text>
        <text x={c} y={c + 16} textAnchor="middle" fontSize={10.5} fill="var(--ink-3)">
          {focus ? `${focus.value.toFixed(1)} / ${max}` : center.label}
        </text>
      </svg>
      {focus && (
        <p className="mt-2 flex items-center justify-center gap-2 text-center text-[13px] text-[var(--ink-2)]">
          <ThemeIcon theme={focus.theme} size="sm" />
          <span className="font-semibold text-[var(--ink)]">{focus.id}</span> {focus.label}
        </p>
      )}
    </div>
  );
}
