"use client";

import { useMemo } from "react";
import { Library } from "lucide-react";
import { useI18n } from "@/i18n/provider";
import { findFactors, factorRef, KIND_UNIT, resolveRef, usableSets, type FactorKind, type FactorOption, type FactorSet } from "@/lib/factors";
import { useWorkspace } from "@/store/workspace";
import { Field } from "./ui";

const NO_EXTRA: FactorSet[] = [];

/** Usable factor sets: built-in + extra official sets + custom sets with confirmed rights. */
export function useFactorSets(extra: FactorSet[] = NO_EXTRA): FactorSet[] {
  const custom = useWorkspace((s) => s.customSets);
  return useMemo(() => usableSets(custom ?? [], extra), [custom, extra]);
}

/**
 * Select a factor from the library. Choosing one hands the option to `onPick`; choosing the empty entry
 * hands null (the value stays as typed). The source of the chosen factor is shown under the field.
 */
export function FactorPicker({
  kind,
  matchKey,
  value,
  onPick,
  sets,
}: {
  kind: FactorKind;
  matchKey?: string;
  value?: string;
  onPick: (o: FactorOption | null) => void;
  sets: FactorSet[];
}) {
  const { t, fmt } = useI18n();
  const options = findFactors(sets, kind, matchKey);
  const current = resolveRef(sets, value);
  if (!options.length && !current) return null;
  return (
    <Field label={t("factors.pick")} hint={current ? t("factors.fromLibrary", { set: current.set.name }) : undefined}>
      {(id) => (
        <div className="flex items-center gap-2">
          <Library size={15} aria-hidden className="shrink-0 text-[var(--accent-ink)]" />
          <select
            id={id}
            className="field-input"
            value={current ? factorRef(current) : ""}
            onChange={(e) => {
              const o = options.find((x) => factorRef(x) === e.target.value) ?? null;
              onPick(o);
            }}
          >
            <option value="">{t("factors.pickNone")}</option>
            {options.map((o) => (
              <option key={factorRef(o)} value={factorRef(o)}>
                {o.set.name} — {o.factor.label}: {fmt.number(o.factor.value, o.factor.value < 10 ? 3 : 1)} {o.factor.kind === "scope3" && o.factor.unit ? `tCO₂e/${o.factor.unit}` : KIND_UNIT[o.factor.kind]}
              </option>
            ))}
          </select>
        </div>
      )}
    </Field>
  );
}
