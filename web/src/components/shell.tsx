"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  BookOpenText,
  Building2,
  CalendarRange,
  Compass,
  Droplets,
  Factory,
  FileSpreadsheet,
  FileStack,
  Flame,
  GitCompareArrows,
  Grid2x2Check,
  MessageSquareWarning,
  Library,
  LayoutDashboard,
  ListTodo,
  Menu,
  Network,
  Palette,
  Route,
  Scale,
  Ship,
  TrendingDown,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { useI18n } from "@/i18n/provider";
import { LOCALES } from "@/i18n/generated";
import { FAMILY_COLOR, NAV, type Family } from "@/data/nav";
import { useActiveClient, useHydrated, useWorkspace } from "@/store/workspace";
import { cn, SampleFlag } from "./ui";
import { CountUp } from "./data";

const ICONS: Record<string, LucideIcon> = {
  overview: LayoutDashboard,
  journey: Route,
  applicability: Compass,
  regulations: CalendarRange,
  ghg: Flame,
  cbam: Ship,
  ets: Factory,
  pathway: TrendingDown,
  environment: Droplets,
  taxonomy: Scale,
  materiality: Grid2x2Check,
  workforce: Users,
  annualReport: BookOpenText,
  templates: FileStack,
  crosswalk: Network,
  claims: MessageSquareWarning,
  factors: Library,
  themes: Palette,
  reconciliation: GitCompareArrows,
  trialBalance: FileSpreadsheet,
  requests: ListTodo,
};

export const BRAND = "Isoline";

/** Brand mark: three nested isolines. */
function Mark() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
      <path d="M2 14c3-5 6-7 9-7s6 2 9 7" fill="none" stroke="var(--b-600)" strokeWidth="2" strokeLinecap="round" />
      <path d="M5 16c2-3 4-4.5 6-4.5s4 1.5 6 4.5" fill="none" stroke="var(--b-400)" strokeWidth="2" strokeLinecap="round" />
      <circle cx="11" cy="17" r="1.8" fill="var(--b-800)" />
    </svg>
  );
}

function TopBar({ onMenu }: { onMenu: () => void }) {
  const { t, locale } = useI18n();
  const hydrated = useHydrated();
  const client = useActiveClient();
  const clients = useWorkspace((s) => s.clients);
  const setActive = useWorkspace((s) => s.setActive);
  const pathname = usePathname();
  const router = useRouter();
  const rest = pathname.split("/").slice(2).join("/");
  return (
    <header
      className="sticky z-30 pt-3"
      style={{ top: "env(safe-area-inset-top, 0px)", paddingLeft: "max(16px, env(safe-area-inset-left, 0px))", paddingRight: "max(16px, env(safe-area-inset-right, 0px))" }}
    >
      <div className="flex items-center gap-3">
        <div className="glass flex h-12 items-center gap-2.5 rounded-[16px] px-3.5">
          <button type="button" className="-ml-1 rounded-lg p-1 lg:hidden" onClick={onMenu} aria-label={t("shell.menu")}>
            <Menu size={19} />
          </button>
          <Link href={`/${locale}`} className="flex items-center gap-2 no-underline">
            <Mark />
            <span className="hidden text-[17px] font-semibold tracking-[-0.02em] text-[var(--ink)] sm:inline">{BRAND}</span>
          </Link>
        </div>
        <div className="glass flex h-12 min-w-0 flex-1 items-center gap-2 rounded-[16px] px-3.5 sm:flex-none">
          <Building2 size={16} aria-hidden className="shrink-0 text-[var(--accent-ink)]" />
          <label htmlFor="client-switch" className="sr-only">
            {t("shell.client")}
          </label>
          {hydrated ? (
            <select
              id="client-switch"
              value={client.id}
              onChange={(e) => setActive(e.target.value)}
              className="w-full min-w-0 truncate rounded-md bg-transparent pr-1 text-[14px] font-semibold text-[var(--ink)] sm:w-auto sm:max-w-[300px]"
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-[14px] font-semibold">…</span>
          )}
          {hydrated && client.sample && (
            <span className="hidden md:inline-flex">
              <SampleFlag text={t("shell.sample")} />
            </span>
          )}
        </div>
        <div className="glass ml-auto flex h-12 shrink-0 items-center gap-3 rounded-[16px] px-3">
          <Link href={`/${locale}/clients`} className="hidden text-[13px] font-medium text-[var(--ink-2)] no-underline hover:text-[var(--ink)] sm:inline">
            {t("shell.manageClients")}
          </Link>
          <label htmlFor="lang-switch" className="sr-only">
            {t("shell.language")}
          </label>
          <select
            id="lang-switch"
            value={locale}
            onChange={(e) => router.push(`/${e.target.value}/${rest}`)}
            className="rounded-lg border border-[var(--rule)] bg-[var(--paper)] px-2 py-1 text-[12.5px] font-semibold uppercase tracking-[0.04em] text-[var(--ink)]"
          >
            {LOCALES.map((l) => (
              <option key={l.code} value={l.code} aria-label={l.nativeName}>
                {l.code.toUpperCase()}
              </option>
            ))}
          </select>
        </div>
      </div>
    </header>
  );
}

function Rail({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, locale } = useI18n();
  const pathname = usePathname();
  const total = NAV.reduce((s, g) => s + g.items.length, 0);
  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-[var(--b-900)]/30 backdrop-blur-[2px] lg:hidden" onClick={onClose} aria-hidden />}
      <nav
        aria-label={t("shell.nav")}
        className={cn(
          "glass fixed bottom-3 left-3 top-[76px] z-40 w-[262px] overflow-y-auto rounded-[20px] pb-6 pt-5 transition-transform duration-200",
          "lg:sticky lg:top-[76px] lg:z-0 lg:h-[calc(100dvh-88px)] lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-[110%]",
        )}
      >
        <button type="button" className="absolute right-3 top-3 rounded-lg p-1 lg:hidden" onClick={onClose} aria-label={t("shell.close")}>
          <X size={18} />
        </button>
        {NAV.map((g) => (
          <div key={g.id} className="mb-4">
            <div className="mb-1.5 flex items-center gap-2.5 px-5">
              <span aria-hidden className="h-[3px] rounded-full" style={{ width: `${8 + (g.items.length / total) * 72}px`, background: FAMILY_COLOR[g.family].strong }} />
              <span className="label">{t(`nav.group.${g.id}`)}</span>
            </div>
            <ul className="px-2.5">
              {g.items.map((it) => {
                const href = `/${locale}${it.href}`;
                const on = it.href === "" ? pathname === `/${locale}` : pathname.startsWith(href);
                const Icon = ICONS[it.id];
                return (
                  <li key={it.id}>
                    <Link
                      href={href}
                      onClick={onClose}
                      aria-current={on ? "page" : undefined}
                      className={cn(
                        "group flex items-center gap-3 rounded-[11px] px-2.5 py-[7px] text-[14px] no-underline transition-colors",
                        on ? "bg-[var(--paper)] font-semibold text-[var(--ink)] shadow-[0_8px_20px_-14px_rgba(31,52,160,0.7)]" : "text-[var(--ink-2)] hover:bg-[color-mix(in_srgb,var(--paper)_60%,transparent)] hover:text-[var(--ink)]",
                      )}
                    >
                      <span
                        className={cn("th-icon grid h-7 w-7 shrink-0 place-items-center rounded-[8px] transition-colors duration-150", on ? "text-white" : "")}
                        data-motion="nudge"
                        style={{ background: on ? FAMILY_COLOR[it.family as Family].strong : FAMILY_COLOR[it.family as Family].wash, color: on ? "#fff" : FAMILY_COLOR[it.family as Family].strong }}
                      >
                        <Icon size={15} strokeWidth={1.9} aria-hidden />
                      </span>
                      {t(`nav.${it.id}`)}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        <p className="mt-4 px-5 text-[11.5px] leading-relaxed text-[var(--ink-3)]">{t("shell.disclaimer")}</p>
      </nav>
    </>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative z-[1] min-h-dvh pb-10">
      <TopBar onMenu={() => setOpen(true)} />
      <div className="flex gap-6 pt-4" style={{ paddingLeft: "max(16px, env(safe-area-inset-left, 0px))", paddingRight: "max(16px, env(safe-area-inset-right, 0px))" }}>
        <Rail open={open} onClose={() => setOpen(false)} />
        <main id="main" className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-[1360px]">{children}</div>
        </main>
      </div>
    </div>
  );
}

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
 * (approved) section disables every input, button and file picker in the panel at once.
 */
export function ToolLayout({ inputs, children, family, locked = false }: { inputs: ReactNode; children: ReactNode; family: Family; locked?: boolean }) {
  return (
    <div data-family={family} className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
      <aside className="glass order-2 flex min-w-0 flex-col gap-5 self-start p-5 xl:sticky xl:top-[76px] xl:order-1 xl:max-h-[calc(100dvh-90px)] xl:overflow-y-auto">
        <fieldset disabled={locked} className="m-0 flex min-w-0 flex-col gap-5 border-0 p-0">
          {inputs}
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
