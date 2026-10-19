"use client";

/**
 * Building blocks of the calculators (the toolkit's tools, now Library → quick calculation inside the platform
 * frame): the cobalt result band, the inputs/results layout, input groups, figures and the loading state. The
 * toolkit's own frame (top bar, menu, platform band) was retired with its routes (ADR-008 update, UX Faz 3).
 */
import { type ReactNode } from "react";
import { useI18n } from "@/i18n/provider";
import { type Family } from "@/data/nav";
import { cn } from "./ui";
import { CountUp } from "./data";

/** Cobalt grain band: tool name, the one-sentence result that moves with the data, actions. */
export function PageHeader({ title, result, actions, family = "compass", aside }: { title: string; result?: ReactNode; actions?: ReactNode; family?: Family; aside?: ReactNode }) {
  return (
    <header className="band mb-6 flex flex-col gap-5 p-6 md:p-8 lg:flex-row lg:items-end lg:justify-between" data-family={family}>
      <div className="min-w-0">
        <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.025em] md:text-[34px]">{title}</h1>
        {result && <p className="mt-2.5 max-w-[66ch] text-[16px] leading-snug text-[var(--on-band-2)] md:text-[18px]">{result}</p>}
        {aside && <div className="mt-4">{aside}</div>}
      </div>
      {actions && <div className="no-print flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

/**
 * Inputs in a glass panel on the left, a bento of results on the right; stacks on narrow screens. A locked
 * (approved) section disables every input, button and file picker in the panel at once. `notes` closes the
 * panel (the section's source documents) under the same lock.
 */
export function ToolLayout({ inputs, notes, children, family, locked = false }: { inputs: ReactNode; notes?: ReactNode; children: ReactNode; family: Family; locked?: boolean }) {
  return (
    <div data-family={family} className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
      <aside className="no-print glass order-2 flex min-w-0 flex-col gap-5 self-start p-5 xl:sticky xl:top-[76px] xl:order-1 xl:max-h-[calc(100dvh-90px)] xl:overflow-y-auto">
        <fieldset disabled={locked} className="m-0 flex min-w-0 flex-col gap-5 border-0 p-0">
          {inputs}
          {notes}
        </fieldset>
      </aside>
      <section className="order-1 flex min-w-0 flex-col gap-6 xl:order-2">{children}</section>
    </div>
  );
}

export function InputGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-3.5 border-t border-[var(--rule)] pt-4 first:border-t-0 first:pt-0">
      <legend className="label float-left mb-1 w-full">{title}</legend>
      {children}
    </fieldset>
  );
}

/** Bento of governing figures; the first tile carries the family colour. */
/** Small bar strip under a figure: the figure's own series, highlighted at `mark`. */
function MiniBars({ values, mark, light }: { values: number[]; mark?: number; light?: boolean }) {
  const max = Math.max(...values.map((v) => Math.abs(v)), 1);
  return (
    <span aria-hidden className="mt-1 flex h-7 items-end gap-[3px]">
      {values.map((v, i) => (
        <span
          key={i}
          className="anim-bar flex-1 rounded-[2px]"
          style={{
            ["--i" as string]: i,
            height: `${Math.max(6, (Math.abs(v) / max) * 100)}%`,
            background: light ? (i === mark ? "#fff" : "rgba(255,255,255,0.45)") : i === mark ? "var(--fam-solid, var(--b-600))" : "color-mix(in srgb, var(--fam-solid, var(--b-600)) 28%, transparent)",
          }}
        />
      ))}
    </span>
  );
}

export function FiguresRow({ items, pulseKey }: { items: { label: string; value: string; note?: string; tone?: "fam" | "crit" | "ok"; trend?: number[]; mark?: number }[]; pulseKey?: string | number }) {
  return (
    <div className="@container">
      <div className="grid grid-cols-2 gap-4 @3xl:grid-cols-4">
      {items.map((it, i) => {
        const lead = i === 0;
        return (
          <div
            key={it.label}
            className={cn("glass flex min-w-0 flex-col gap-2 p-4 md:p-5", lead ? "border-transparent text-white" : "sheet")}
            style={lead ? { background: "linear-gradient(150deg, var(--fam-solid, #2f4fe0) 0%, color-mix(in srgb, var(--fam-solid, #2f4fe0) 62%, var(--fam, #4f6ef0)) 100%)" } : undefined}
          >
            <span className={cn("text-[12.5px] font-medium", lead ? "text-white/80" : "text-[var(--ink-3)]")}>{it.label}</span>
            <span
              className="figure-num whitespace-nowrap text-[28px] @md:text-[32px] @5xl:text-[38px]"
              style={{ color: lead ? "#fff" : it.tone === "crit" ? "var(--crit)" : it.tone === "ok" ? "var(--ok)" : it.tone === "fam" ? "var(--fam, var(--ink))" : "var(--ink)" }}
            >
              <CountUp text={it.value} />
            </span>
            {lead && !it.trend && <span key={pulseKey} aria-hidden className="rule-draw block h-[2px] w-12 rounded-full bg-white/80" />}
            {it.trend && <MiniBars values={it.trend} mark={it.mark} light={lead} />}
            {it.note && <span className={cn("text-[12px] leading-snug", lead ? "text-white/75" : "text-[var(--ink-3)]")}>{it.note}</span>}
          </div>
        );
      })}
      </div>
    </div>
  );
}

export function Loading() {
  const { t } = useI18n();
  return <p className="glass p-8 text-[var(--ink-3)]">{t("shell.loading")}</p>;
}
