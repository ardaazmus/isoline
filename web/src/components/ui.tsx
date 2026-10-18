"use client";

import { clsx } from "clsx";
import { useId, useState, type ButtonHTMLAttributes, type ReactNode } from "react";

export function cn(...v: Parameters<typeof clsx>) {
  return clsx(...v);
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "quiet" | "ghost" | "onBand" | "onBandPrimary"; size?: "sm" | "md" };

export function Button({ variant = "quiet", size = "md", className, type = "button", ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      {...rest}
      className={cn(
        "inline-flex items-center gap-2 whitespace-nowrap rounded-[12px] font-semibold transition-[background,border-color,box-shadow,color] duration-150 disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "h-8 px-3 text-[13px]" : "h-10 px-4 text-[14px]",
        variant === "primary" && "bg-[var(--b-600)] text-white shadow-[0_10px_24px_-12px_rgba(47,79,224,0.8)] hover:bg-[var(--b-700)]",
        variant === "quiet" && "border border-[var(--rule)] bg-[var(--glass-strong)] text-[var(--ink)] hover:border-[var(--b-300)] hover:bg-[var(--paper)]",
        variant === "ghost" && "px-2.5 text-[var(--ink-2)] hover:bg-[color-mix(in_srgb,var(--b-100)_70%,transparent)] hover:text-[var(--ink)]",
        variant === "onBand" && "border border-white/40 bg-white/12 text-white backdrop-blur-md hover:bg-white/22",
        variant === "onBandPrimary" && "bg-white text-[#2443c9] shadow-[0_10px_24px_-12px_rgba(14,26,70,0.6)] hover:bg-[var(--b-50)]",
        className,
      )}
    />
  );
}

export function Field({ label, hint, unit, children, id }: { label: string; hint?: string; unit?: string; children: (id: string) => ReactNode; id?: string }) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={fid} className="text-[13px] font-medium text-[var(--ink-2)]">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">{children(fid)}</div>
        {unit && <span className="shrink-0 text-[12px] text-[var(--ink-3)]">{unit}</span>}
      </div>
      {hint && <p className="text-[12px] leading-snug text-[var(--ink-3)]">{hint}</p>}
    </div>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  unit,
  hint,
  min,
  max,
  percent,
  nullable,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  unit?: string;
  hint?: string;
  min?: number;
  max?: number;
  /** Shows and edits a fraction (0.042) as a percentage (4.2). */
  percent?: boolean;
  /** Emptying the field reports NaN (meaning "not set"). */
  nullable?: boolean;
}) {
  const shown = percent ? round(value * 100, 6) : value;
  const [draft, setDraft] = useState<string | null>(null);
  const invalid = draft !== null && draft.trim() !== "" && !Number.isFinite(Number(draft.replace(",", ".")));
  return (
    <Field label={label} unit={percent ? "%" : unit} hint={hint}>
      {(id) => (
        <input
          id={id}
          inputMode="decimal"
          className="field-input num"
          value={draft ?? (Number.isFinite(shown) ? String(shown) : "")}
          aria-invalid={invalid}
          onFocus={() => setDraft(Number.isFinite(shown) ? String(shown) : "")}
          onChange={(e) => {
            setDraft(e.target.value);
            if (nullable && e.target.value.trim() === "") {
              onChange(NaN);
              return;
            }
            const n = Number(e.target.value.replace(",", "."));
            if (e.target.value.trim() !== "" && Number.isFinite(n)) {
              let v = percent ? n / 100 : n;
              if (min !== undefined) v = Math.max(min, v);
              if (max !== undefined) v = Math.min(max, v);
              onChange(v);
            }
          }}
          onBlur={() => setDraft(null)}
        />
      )}
    </Field>
  );
}

function round(v: number, d: number) {
  const f = Math.pow(10, d);
  return Math.round(v * f) / f;
}

export function TextField({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  return (
    <Field label={label} hint={hint}>
      {(id) => <input id={id} className="field-input" value={value} onChange={(e) => onChange(e.target.value)} />}
    </Field>
  );
}

/** A text field that saves on blur or Enter, so cleaning the stored text (trimming) never fights the typing. */
export function DraftInput({
  value,
  onCommit,
  label,
  placeholder,
  disabled,
  className,
  width,
}: {
  value: string;
  onCommit: (v: string) => void;
  label: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  width?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      aria-label={label}
      placeholder={placeholder}
      disabled={disabled}
      value={draft ?? value}
      onFocus={() => setDraft(value)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== null && draft !== value) onCommit(draft);
        setDraft(null);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      className={cn("field-input h-9 text-[13.5px]", className)}
      style={width ? { width } : undefined}
    />
  );
}

export function SelectField<T extends string>({
  label,
  value,
  onChange,
  options,
  hint,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  hint?: string;
}) {
  return (
    <Field label={label} hint={hint}>
      {(id) => (
        <select id={id} className="field-input" value={value} onChange={(e) => onChange(e.target.value as T)}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

export function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  const id = useId();
  return (
    <div className="flex items-start gap-3">
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn("relative mt-0.5 h-[22px] w-[38px] shrink-0 rounded-full border transition-colors", checked ? "border-[var(--b-600)] bg-[var(--b-600)]" : "border-[var(--rule)] bg-[var(--paper-3)]")}
      >
        <span className={cn("absolute top-[2px] h-4 w-4 rounded-full bg-white shadow transition-[left] duration-150", checked ? "left-[18px]" : "left-[2px]")} />
      </button>
      <label htmlFor={id} className="cursor-pointer text-[14px] leading-snug text-[var(--ink)]">
        {label}
        {hint && <span className="block text-[12px] text-[var(--ink-3)]">{hint}</span>}
      </label>
    </div>
  );
}

/** Segmented pill control. */
export function Tabs<T extends string>({ value, onChange, items, label }: { value: T; onChange: (v: T) => void; items: { value: T; label: string }[]; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex max-w-full flex-wrap gap-1 self-start rounded-[14px] border border-[var(--glass-stroke)] bg-[color-mix(in_srgb,var(--b-100)_70%,transparent)] p-1">
      {items.map((it) => {
        const on = it.value === value;
        return (
          <button
            key={it.value}
            role="tab"
            type="button"
            aria-selected={on}
            onClick={() => onChange(it.value)}
            className={cn(
              "h-8 rounded-[10px] px-3.5 text-[13.5px] font-medium transition-[background,color,box-shadow]",
              on ? "bg-[var(--paper)] text-[var(--accent-ink)] shadow-[0_6px_16px_-10px_rgba(31,52,160,0.6)]" : "text-[var(--ink-2)] hover:text-[var(--ink)]",
            )}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

/** Data status drawn as line form as well as text: solid = verified, dashed = estimated/default, dotted = review, struck = invalid. */
export function StatusMark({ kind, label }: { kind: "verified" | "estimated" | "review" | "invalid" | "critical" | "required" | "voluntary" | "indirect" | "na"; label: string }) {
  const style: Record<string, string> = {
    verified: "border-solid border-[var(--b-600)]",
    required: "border-solid border-[var(--b-600)]",
    estimated: "border-dashed border-[var(--b-400)]",
    indirect: "border-dashed border-[var(--b-400)]",
    review: "border-dotted border-[var(--warn)]",
    voluntary: "border-dotted border-[var(--ink-3)]",
    invalid: "border-solid border-[var(--crit)]",
    critical: "border-solid border-[var(--crit)]",
    na: "border-solid border-[var(--rule)]",
  };
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap text-[12.5px] font-medium text-[var(--ink-2)]">
      <span aria-hidden className={cn("inline-block w-5 border-t-2", style[kind])} />
      <span className={cn(kind === "invalid" && "line-through", kind === "review" && "text-[var(--warn)]", kind === "critical" && "text-[var(--crit)]")}>{label}</span>
    </span>
  );
}

export function Callout({ tone = "note", children }: { tone?: "note" | "warn" | "crit"; children: ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-[14px] border px-4 py-3 text-[13.5px] leading-relaxed",
        tone === "note" && "border-[var(--glass-stroke)] bg-[var(--glass)] text-[var(--ink-2)]",
        tone === "warn" && "border-[color-mix(in_srgb,var(--warn)_35%,transparent)] bg-[var(--warn-wash)] text-[var(--ink)]",
        tone === "crit" && "border-[color-mix(in_srgb,var(--crit)_35%,transparent)] bg-[var(--crit-wash)] text-[var(--ink)]",
      )}
    >
      {children}
    </div>
  );
}

export function SampleFlag({ text, onBand }: { text: string; onBand?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-dashed px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em]",
        onBand ? "border-white/60 text-white" : "border-[var(--warn)] text-[var(--warn)]",
      )}
    >
      {text}
    </span>
  );
}

/** A frosted bento tile. */
export function Tile({ children, className, as: Tag = "div", strong }: { children: ReactNode; className?: string; as?: "div" | "section" | "figure" | "aside" | "li"; strong?: boolean }) {
  return <Tag className={cn("glass min-w-0 p-5 md:p-6", strong && "glass-strong", className)}>{children}</Tag>;
}
