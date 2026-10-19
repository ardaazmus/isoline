"use client";

/**
 * Platform frame (ADR-011): a context bar that always says which workspace, in which role and — when working inside
 * a customer's project through a grant — on whose behalf; and a role-based menu. Light, calm, no gamification.
 */
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Bell, Briefcase, Building2, ClipboardCheck, FileInput, History, Package, FlaskConical, FolderKanban, Handshake, Home, Inbox, KeyRound, LayoutGrid, LogOut, Menu, ScrollText, ShieldCheck, UserPlus, Users, Wrench, X, type LucideIcon } from "lucide-react";
import { useI18n } from "@/i18n/provider";
import { LOCALES } from "@/i18n/generated";
import { cn, SampleFlag } from "@/components/ui";
import type { MemberRole } from "@/server/policy/policy";
import { authClient, api } from "./client";
import { visibleNav } from "./nav";

export type ShellMembership = { tenantId: string; tenantName: string; kind: string; lifecycle: string; role: MemberRole; sample: boolean };
export type ShellContext = { user: { name: string; email: string } | null; memberships: ShellMembership[]; current: ShellMembership | null; onBehalfOf?: string | null; unread?: number };

const ICONS: Record<string, LucideIcon> = {
  home: Home,
  projects: FolderKanban,
  relationships: Handshake,
  clientsNew: UserPlus,
  members: Users,
  security: ShieldCheck,
  audit: ScrollText,
  account: KeyRound,
  organization: Building2,
  import: FileInput,
  portfolio: LayoutGrid,
  engagements: Briefcase,
  tasks: Inbox,
  notifications: Bell,
  factors: FlaskConical,
  review: ClipboardCheck,
  handoff: Package,
  reference: History,
};

function Mark() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
      <path d="M2 14c3-5 6-7 9-7s6 2 9 7" fill="none" stroke="var(--b-600)" strokeWidth="2" strokeLinecap="round" />
      <path d="M5 16c2-3 4-4.5 6-4.5s4 1.5 6 4.5" fill="none" stroke="var(--b-400)" strokeWidth="2" strokeLinecap="round" />
      <circle cx="11" cy="17" r="1.8" fill="var(--b-800)" />
    </svg>
  );
}

function ContextBar({ ctx, onMenu }: { ctx: ShellContext; onMenu: () => void }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const [busy, setBusy] = useState(false);
  const rest = pathname.split("/").slice(2).join("/");

  const choose = async (tenantId: string) => {
    setBusy(true);
    const r = await api("POST", "/api/v1/session/tenant", { tenantId });
    setBusy(false);
    if (r.ok) {
      router.push(`/${locale}/app/home`);
      router.refresh();
    } else if (r.code === "mfa_required") router.push(`/${locale}/app/account/security?reason=mfa_required`);
  };

  const signOut = async () => {
    await authClient.signOut();
    router.push(`/${locale}/auth/login`);
    router.refresh();
  };

  return (
    <header className="no-print sticky top-0 z-30 pt-3" style={{ paddingLeft: "max(16px, env(safe-area-inset-left, 0px))", paddingRight: "max(16px, env(safe-area-inset-right, 0px))" }}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="glass flex h-12 items-center gap-2.5 rounded-[16px] px-3.5">
          {ctx.current && (
            <button type="button" className="-ml-1 rounded-lg p-1 lg:hidden" onClick={onMenu} aria-label={t("shell.menu")}>
              <Menu size={19} />
            </button>
          )}
          <Link href={`/${locale}/app`} className="flex items-center gap-2 no-underline">
            <Mark />
            <span className="hidden text-[17px] font-semibold tracking-[-0.02em] text-[var(--ink)] sm:inline">Isoline</span>
          </Link>
        </div>

        {ctx.current && (
          <div className="glass flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-[16px] px-3.5 sm:flex-none" aria-label={t("pf.shell.context")}>
            <Building2 size={16} aria-hidden className="shrink-0 text-[var(--accent-ink)]" />
            <label htmlFor="ws-switch" className="sr-only">
              {t("pf.shell.workspace")}
            </label>
            <select
              id="ws-switch"
              disabled={busy}
              value={ctx.current.tenantId}
              onChange={(e) => void choose(e.target.value)}
              className="w-full min-w-0 truncate rounded-md bg-transparent pr-1 text-[14px] font-semibold text-[var(--ink)] sm:w-auto sm:max-w-[280px]"
            >
              {ctx.memberships.map((m) => (
                <option key={m.tenantId} value={m.tenantId}>
                  {m.tenantName}
                </option>
              ))}
            </select>
            <span className="hidden whitespace-nowrap text-[12.5px] text-[var(--ink-3)] md:inline">
              {t(`pf.kind.${ctx.current.kind}`)} · {t(`pf.role.${ctx.current.role}`)}
            </span>
            {ctx.current.sample && (
              <span className="hidden md:inline-flex">
                <SampleFlag text={t("shell.sample")} />
              </span>
            )}
          </div>
        )}

        {ctx.onBehalfOf && (
          <div className="flex h-12 items-center rounded-[16px] border border-[var(--b-300)] bg-[var(--b-50)] px-3.5 text-[13px] font-medium text-[var(--b-800)]" role="status">
            {t("pf.shell.onBehalf", { name: ctx.onBehalfOf })}
          </div>
        )}

        <div className="glass ml-auto flex h-12 shrink-0 items-center gap-3 rounded-[16px] px-3">
          <Link href={`/${locale}`} className="hidden items-center gap-1.5 text-[13px] font-medium text-[var(--ink-2)] no-underline hover:text-[var(--ink)] md:inline-flex">
            <Wrench size={14} aria-hidden />
            {t("pf.shell.toolkit")}
          </Link>
          <label htmlFor="pf-lang" className="sr-only">
            {t("shell.language")}
          </label>
          <select
            id="pf-lang"
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
          {ctx.user && (
            <>
              <span className="hidden max-w-[180px] truncate text-[13px] text-[var(--ink-2)] lg:inline" title={ctx.user.email}>
                {ctx.user.name}
              </span>
              <button type="button" onClick={() => void signOut()} className="rounded-lg p-1.5 text-[var(--ink-2)] hover:bg-[var(--b-50)] hover:text-[var(--ink)]" aria-label={t("pf.shell.signOut")} title={t("pf.shell.signOut")}>
                <LogOut size={17} />
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function Rail({ ctx, open, onClose }: { ctx: ShellContext; open: boolean; onClose: () => void }) {
  const { t, locale } = useI18n();
  const pathname = usePathname();
  if (!ctx.current) return null;
  const groups = visibleNav(ctx.current.kind, ctx.current.role);
  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-[var(--b-900)]/30 backdrop-blur-[2px] lg:hidden" onClick={onClose} aria-hidden />}
      <nav
        aria-label={t("pf.shell.nav")}
        className={cn(
          "no-print glass fixed bottom-3 left-3 top-[76px] z-40 w-[240px] overflow-y-auto rounded-[20px] pb-6 pt-5 transition-transform duration-200 motion-reduce:transition-none",
          "lg:sticky lg:top-[76px] lg:z-0 lg:h-[calc(100dvh-88px)] lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-[110%]",
        )}
      >
        <button type="button" className="absolute right-3 top-3 rounded-lg p-1 lg:hidden" onClick={onClose} aria-label={t("shell.close")}>
          <X size={18} />
        </button>
        {groups.map((g) => (
          <div key={g.id} className="mb-4">
            <div className="label mb-1.5 px-5">{t(`pf.nav.group.${g.id}`)}</div>
            <ul className="px-2.5">
              {g.items.map((it) => {
                const href = `/${locale}${it.href}`;
                const on = pathname === href || pathname.startsWith(`${href}/`);
                const Icon = ICONS[it.id] ?? FolderKanban;
                return (
                  <li key={it.id}>
                    <Link
                      href={href}
                      onClick={onClose}
                      aria-current={on ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-[11px] px-2.5 py-[7px] text-[14px] no-underline transition-colors",
                        on ? "bg-[var(--paper)] font-semibold text-[var(--ink)] shadow-[0_8px_20px_-14px_rgba(31,52,160,0.7)]" : "text-[var(--ink-2)] hover:bg-[color-mix(in_srgb,var(--paper)_60%,transparent)] hover:text-[var(--ink)]",
                      )}
                    >
                      <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-[8px]", on ? "bg-[var(--b-600)] text-white" : "bg-[var(--b-50)] text-[var(--b-700)]")}>
                        <Icon size={15} strokeWidth={1.9} aria-hidden />
                      </span>
                      {t(`pf.nav.${it.id}`)}
                      {it.id === "notifications" && (ctx.unread ?? 0) > 0 && (
                        <span className="ml-auto rounded-full bg-[var(--b-600)] px-1.5 text-[11px] font-semibold text-white" aria-label={t("pf.notify.unread", { n: ctx.unread ?? 0 })}>
                          {ctx.unread}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        {ctx.current.lifecycle === "provisional" && <p className="mx-5 mt-2 text-[12px] leading-snug text-[var(--warn)]">{t("pf.shell.provisional")}</p>}
      </nav>
    </>
  );
}

export function PlatformShell({ ctx, children }: { ctx: ShellContext; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative z-[1] min-h-dvh pb-10">
      <ContextBar ctx={ctx} onMenu={() => setOpen(true)} />
      <div className="flex gap-6 pt-4" style={{ paddingLeft: "max(16px, env(safe-area-inset-left, 0px))", paddingRight: "max(16px, env(safe-area-inset-right, 0px))" }}>
        <Rail ctx={ctx} open={open} onClose={() => setOpen(false)} />
        <main id="main" className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-[1200px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
