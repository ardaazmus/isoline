"use client";

import { useMemo } from "react";
import { Library } from "lucide-react";
import { useI18n } from "@/i18n/provider";
import { factorDigits, findFactors, factorRef, factorUnit, formatCn, resolveRef, usableSets, type Factor, type FactorKind, type FactorOption, type FactorSet } from "@/lib/factors";
import { useWorkspace } from "@/store/workspace";
import { setsForYear } from "@/lib/recalc";
import { Field } from "./ui";

const NO_EXTRA: FactorSet[] = [];

/** Usable factor sets: built-in + extra official sets + custom sets with confirmed rights. */
export function useFactorSets(extra: FactorSet[] = NO_EXTRA): FactorSet[] {
  const custom = useWorkspace((s) => s.customSets);
  return useMemo(() => usableSets(custom ?? [], extra), [custom, extra]);
}

const regionNames = new Map<string, Intl.DisplayNames | null>();

function regionName(locale: string, code: string): string | undefined {
  if (!regionNames.has(locale)) {
    try {
      regionNames.set(locale, new Intl.DisplayNames([locale], { type: "region" }));
    } catch {
      regionNames.set(locale, null);
    }
  }
  return regionNames.get(locale)?.of(code);
}

/**
 * Label of a factor in the UI language: CBAM rows lead with their CN code, and built-in grid factors keyed by
 * an ISO country code show the country name in the active language. Custom sets keep their own labels.
 */
export function useFactorLabel(): (f: Factor, set: FactorSet) => string {
  const { locale, t } = useI18n();
  return (f, set) => {
    if (f.kind === "cbam_default") return `${formatCn(f.key)} — ${f.label}`;
    if (f.kind === "grid" && set.origin === "builtin") {
      if (f.key === "EU27") return t("factors.eu27");
      if (/^[A-Z]{2}$/.test(f.key)) return regionName(locale, f.key) ?? f.label;
    }
    return f.label;
  };
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/**
 * Select a factor from the library. Choosing one hands the option to `onPick`; choosing the empty entry
 * hands null (the value stays as typed). The source of the chosen factor and its set's caveat are shown
 * under the field.
 */
export function FactorPicker({
  kind,
  matchKey,
  value,
  onPick,
  sets,
  year,
  filter,
}: {
  kind: FactorKind;
  matchKey?: string;
  value?: string;
  onPick: (o: FactorOption | null) => void;
  sets: FactorSet[];
  /** Offer only the editions for this year (one per family); a pick from another edition stays visible. */
  year?: number;
  /** Narrows the offer further, e.g. to factors suited to a scope 3 category. */
  filter?: (f: Factor) => boolean;
}) {
  const { t, fmt } = useI18n();
  const label = useFactorLabel();
  const matches = findFactors(year === undefined ? sets : setsForYear(sets, year), kind, matchKey).filter((o) => !filter || filter(o.factor));
  const current = resolveRef(sets, value);
  // A pick stays listed even after the key changes, so the field never silently shows another factor.
  const options = current && !matches.some((o) => factorRef(o) === factorRef(current)) ? [current, ...matches] : matches;
  if (!options.length) return null;

  const groups: { set: FactorSet; items: FactorOption[] }[] = [];
  for (const o of options) {
    const g = groups.find((x) => x.set.id === o.set.id);
    if (g) g.items.push(o);
    else groups.push({ set: o.set, items: [o] });
  }
  const hint = current
    ? [t("factors.fromLibrary", { set: current.set.name }), current.factor.otherCountries ? t("factors.otherCountries") : "", current.set.usageNote ? t(current.set.usageNote) : ""]
        .filter(Boolean)
        .join(" ")
    : undefined;

  return (
    <Field label={t("factors.pick")} hint={hint}>
      {(id) => (
        <div className="flex items-center gap-2">
          <Library size={15} aria-hidden className="shrink-0 text-[var(--accent-ink)]" />
          <select id={id} className="field-input" value={current ? factorRef(current) : ""} onChange={(e) => onPick(options.find((x) => factorRef(x) === e.target.value) ?? null)}>
            <option value="">{t("factors.pickNone")}</option>
            {groups.map((g) => (
              <optgroup key={g.set.id} label={g.set.name}>
                {g.items.map((o) => (
                  <option key={factorRef(o)} value={factorRef(o)}>
                    {clip(label(o.factor, o.set), 84)}: {fmt.number(o.factor.value, factorDigits(o.factor.value))} {factorUnit(o.factor)}
                    {o.factor.otherCountries ? ` · ${t("factors.otherCountriesShort")}` : ""}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      )}
    </Field>
  );
}
