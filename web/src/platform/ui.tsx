"use client";

/**
 * Platform building blocks (ADR-011): one state contract for every screen (loading, empty, error, not authorised,
 * read-only, stale version, success, pending review), API error codes in plain language, and small form parts.
 */
import Link from "next/link";
import { useState, type FormEvent, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Clock, Lock, ShieldAlert } from "lucide-react";
import { useI18n } from "@/i18n/provider";
import { resolve } from "@/i18n/core";
import { Button, cn } from "@/components/ui";
import type { ApiResult } from "./client";

export type ScreenState = "loading" | "empty" | "error" | "not_authorized" | "read_only" | "stale_version" | "action_success" | "pending_review";

const STATE_ICON: Partial<Record<ScreenState, typeof Lock>> = {
  error: AlertTriangle,
  not_authorized: Lock,
  read_only: Lock,
  stale_version: Clock,
  action_success: CheckCircle2,
  pending_review: Clock,
};

export function StateBox({ state, title, children, action }: { state: ScreenState; title?: string; children?: ReactNode; action?: ReactNode }) {
  const { t } = useI18n();
  const Icon = STATE_ICON[state];
  return (
    <div
      role={state === "error" || state === "not_authorized" ? "alert" : "status"}
      className={cn(
        "glass flex flex-col items-start gap-2 p-6",
        (state === "error" || state === "stale_version") && "border-[color-mix(in_srgb,var(--crit)_30%,transparent)]",
        state === "action_success" && "border-[color-mix(in_srgb,var(--ok)_35%,transparent)]",
      )}
    >
      <div className="flex items-center gap-2 text-[15px] font-semibold">
        {Icon && <Icon size={17} aria-hidden className={state === "action_success" ? "text-[var(--ok)]" : state === "error" ? "text-[var(--crit)]" : "text-[var(--ink-3)]"} />}
        {title ?? t(`pf.state.${state}`)}
      </div>
      {children && <div className="text-[13.5px] leading-relaxed text-[var(--ink-2)]">{children}</div>}
      {action}
    </div>
  );
}

/** An API error code in the user's language; unknown codes fall back to a generic sentence with the code. */
export function useErrorText() {
  const { t, locale } = useI18n();
  return (code: string) => (typeof resolve(locale, `pf.err.${code}`) === "string" ? t(`pf.err.${code}`) : t("pf.err.generic", { code }));
}

export function ErrorNote({ code }: { code: string | null }) {
  const text = useErrorText();
  if (!code) return null;
  return (
    <p role="alert" className="flex items-start gap-2 rounded-[12px] border border-[color-mix(in_srgb,var(--crit)_35%,transparent)] bg-[var(--crit-wash)] px-3 py-2 text-[13px] text-[var(--ink)]">
      <ShieldAlert size={15} aria-hidden className="mt-[2px] shrink-0 text-[var(--crit)]" />
      {text(code)}
    </p>
  );
}

export function OkNote({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="flex items-start gap-2 rounded-[12px] border border-[color-mix(in_srgb,var(--ok)_35%,transparent)] bg-[color-mix(in_srgb,var(--ok)_8%,var(--paper))] px-3 py-2 text-[13px]">
      <CheckCircle2 size={15} aria-hidden className="mt-[2px] shrink-0 text-[var(--ok)]" />
      {children}
    </p>
  );
}

/** Runs one submit at a time and keeps the last error code; the button disables itself while busy. */
export function useSubmit<T>(fn: () => Promise<ApiResult<T>>, onOk?: (data: T) => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const r = await fn();
    setBusy(false);
    if (r.ok) onOk?.(r.data);
    else setError(r.code);
  };
  return { busy, error, setError, submit };
}

export function Input({ label, hint, ...rest }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  const id = rest.id ?? rest.name;
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-[13px] font-medium text-[var(--ink-2)]">
        {label}
      </label>
      <input id={id} className="field-input" {...rest} />
      {hint && <p className="text-[12px] leading-snug text-[var(--ink-3)]">{hint}</p>}
    </div>
  );
}

export function Select({ label, options, hint, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; hint?: string; options: { value: string; label: string }[] }) {
  const id = rest.id ?? rest.name;
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-[13px] font-medium text-[var(--ink-2)]">
        {label}
      </label>
      <select id={id} className="field-input" {...rest}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && <p className="text-[12px] leading-snug text-[var(--ink-3)]">{hint}</p>}
    </div>
  );
}

export function Check({ label, checked, onChange, id }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void; id: string }) {
  return (
    <label htmlFor={id} className="flex items-start gap-2.5 text-[13.5px] leading-snug text-[var(--ink-2)]">
      <input id={id} type="checkbox" className="mt-[3px] h-4 w-4 accent-[var(--b-600)]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

export function SubmitButton({ busy, children, disabled }: { busy: boolean; children: ReactNode; disabled?: boolean }) {
  const { t } = useI18n();
  return (
    <Button type="submit" variant="primary" disabled={busy || disabled} aria-busy={busy}>
      {busy ? t("pf.common.working") : children}
    </Button>
  );
}

export function Section({ title, aside, children, id }: { title: string; aside?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section id={id} className="glass flex min-w-0 flex-col gap-4 p-5 md:p-6" aria-labelledby={id ? `${id}-h` : undefined}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={id ? `${id}-h` : undefined} className="text-[17px] font-semibold tracking-[-0.01em]">
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function PageTitle({ title, lead, actions }: { title: string; lead?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.025em] md:text-[30px]">{title}</h1>
        {lead && <p className="mt-1.5 max-w-[70ch] text-[15px] leading-snug text-[var(--ink-2)]">{lead}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function Table({ head, children, empty, caption }: { head: string[]; children: ReactNode; empty?: ReactNode; caption?: string }) {
  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse text-left text-[13.5px]">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr className="border-b border-[var(--rule)] text-[12px] uppercase tracking-[0.06em] text-[var(--ink-3)]">
            {head.map((h) => (
              <th key={h} scope="col" className="px-2 py-2 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
      {empty}
    </div>
  );
}

export function Td({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={cn("border-b border-[var(--rule)] px-2 py-2.5 align-top", className)}>{children}</td>;
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "ok" | "warn" | "crit" | "info" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11.5px] font-semibold",
        tone === "neutral" && "border-[var(--rule)] text-[var(--ink-2)]",
        tone === "ok" && "border-[color-mix(in_srgb,var(--ok)_40%,transparent)] text-[var(--ok)]",
        tone === "warn" && "border-[color-mix(in_srgb,var(--warn)_45%,transparent)] text-[var(--warn)]",
        tone === "crit" && "border-[color-mix(in_srgb,var(--crit)_40%,transparent)] text-[var(--crit)]",
        tone === "info" && "border-[var(--b-300)] text-[var(--b-700)]",
      )}
    >
      {children}
    </span>
  );
}

export function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="font-medium text-[var(--b-700)] underline-offset-2 hover:underline">
      {children}
    </Link>
  );
}
