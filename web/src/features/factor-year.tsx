"use client";

import { useState } from "react";
import Link from "next/link";
import { History, RefreshCw } from "lucide-react";
import { useI18n } from "@/i18n/provider";
import { localDay } from "@/lib/dates";
import type { Inventory } from "@/lib/calc/ghg";
import type { FactorSet } from "@/lib/factors";
import { applyRecalc, gridEdition, isSignificant, pickEdition, planRecalc, SIGNIFICANCE, type RecalcPlan } from "@/lib/recalc";
import { InputGroup } from "@/components/shell";
import { ImportPreview } from "@/components/file-import";
import { Button, Callout, NumberField, StatusMark } from "@/components/ui";

/** Short name of an edition set ("ETKB 2023"), falling back to the set name. */
export function useEditionName(sets: FactorSet[]) {
  const { t } = useI18n();
  return (id: string) => {
    const s = sets.find((x) => x.id === id);
    return s?.family && s.year !== undefined ? t(`factors.family.${s.family}`, { year: s.year }) : (s?.name ?? id);
  };
}

/**
 * Inventory year and factor editions: which ETKB edition the grid factors come from, whether a closer
 * edition exists for the year, and a recalculation preview (lines moved, totals before and after, the
 * GHG Protocol significance check) before anything changes.
 */
export function FactorYear({ inv, year, sets, baseYear, onApply }: { inv: Inventory; year: number; sets: FactorSet[]; baseYear: number; onApply: (next: Inventory) => void }) {
  const { t, fmt, locale } = useI18n();
  const name = useEditionName(sets);
  const [plan, setPlan] = useState<RecalcPlan | null>(null);
  const best = pickEdition(sets, "etkb", year);
  const used = gridEdition(inv);
  const usedSet = sets.find((s) => s.id === used);
  const n = (v: number) => fmt.number(v, 0);
  const pct = (v: number) => `${v > 0 ? "+" : ""}${fmt.percent(v, 1)}`;
  const last = inv.recalcs?.[0];

  return (
    <InputGroup title={t("ghg.ed.title")}>
      <NumberField label={t("ghg.ed.year")} hint={t("ghg.ed.yearHint")} value={year} min={1990} max={2100} onChange={(v) => Number.isFinite(v) && onApply({ ...inv, year: Math.round(v) })} />
      <p className="text-[12.5px] leading-relaxed text-[var(--ink-2)]">
        {t("ghg.ed.used", { edition: name(used), published: usedSet?.published ? fmt.date(usedSet.published) : "—" })}
      </p>
      {best && !best.exact && <p className="text-[12.5px] leading-relaxed text-[var(--ink-3)]">{t("ghg.ed.notYet", { year, edition: name(best.set.id) })}</p>}
      {best && best.set.id !== used && <Callout tone="warn">{t("ghg.ed.better", { edition: name(best.set.id), year })}</Callout>}
      <Button variant="quiet" size="sm" className="self-start" onClick={() => setPlan(planRecalc(inv, sets, year))}>
        <RefreshCw size={14} aria-hidden /> {t("ghg.ed.recalc", { year })}
      </Button>
      {plan && (
        <ImportPreview>
          <p className="font-semibold">{t("ghg.ed.planTitle", { year: plan.year, n: plan.changes.length })}</p>
          <ul className="flex flex-col gap-0.5 text-[12.5px] text-[var(--ink-2)]">
            {Object.entries(plan.targets)
              // Only editions the inventory actually uses: the grid family and families of moved or kept lines.
              .filter(([family, id]) => family === "etkb" || plan.changes.some((c) => c.to.startsWith(`${id}/`)) || plan.missing.some((m) => m.edition === id))
              .map(([, id]) => (
                <li key={id}>{name(id)}</li>
              ))}
          </ul>
          <div className="overflow-x-auto">
            <table className="report-table text-[12.5px]">
              <thead>
                <tr>
                  <th />
                  <th className="r">{t("ghg.ed.before")}</th>
                  <th className="r">{t("ghg.ed.after")}</th>
                </tr>
              </thead>
              <tbody>
                {(["scope1", "scope2Location", "scope2Market", "scope3"] as const).map((k) => (
                  <tr key={k}>
                    <td>{t(`ghg.ed.total.${k}`)}</td>
                    <td className="r num">{n(plan.before[k])}</td>
                    <td className="r num font-medium">{n(plan.after[k])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {plan.changes.length > 0 && (
            <ul className="flex max-h-32 flex-col gap-1 overflow-y-auto text-[12px] text-[var(--ink-2)]">
              {plan.changes.map((c) => (
                <li key={c.kind + c.id}>
                  {c.label || t(`ghg.ed.kind.${c.kind}`)}: {name(c.from.split("/")[0])} → {name(c.to.split("/")[0])} · {n(c.before)} → {n(c.after)} tCO₂e
                </li>
              ))}
            </ul>
          )}
          {plan.missing.length > 0 && (
            <ul className="flex flex-col gap-1 text-[12px] text-[var(--warn)]">
              {plan.missing.map((m) => (
                <li key={m.kind + m.id}>{t("ghg.ed.missing", { label: m.label || t(`ghg.ed.kind.${m.kind}`), edition: name(m.edition) })}</li>
              ))}
            </ul>
          )}
          <p className="text-[12.5px]">
            {t("ghg.ed.delta", { pct: pct(plan.scope12Change) })}{" "}
            <StatusMark kind={isSignificant(plan) ? "review" : "verified"} label={t(isSignificant(plan) ? "ghg.ed.significant" : "ghg.ed.minor", { pct: fmt.percent(SIGNIFICANCE, 0) })} />
          </p>
          {isSignificant(plan) && plan.year === baseYear && (
            <Callout tone="warn">
              {t("ghg.ed.baseYear", { year: baseYear, s12: n(plan.after.scope1 + plan.after.scope2Location) })}{" "}
              <Link href={`/${locale}/tools/pathway`}>{t("nav.pathway")}</Link>
            </Callout>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              variant="primary"
              size="sm"
              disabled={!plan.changes.length && !plan.grid && plan.year === inv.year}
              onClick={() => {
                onApply(applyRecalc(inv, plan));
                setPlan(null);
              }}
            >
              {t("ghg.ed.apply")}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setPlan(null)}>
              {t("clients.cancel")}
            </Button>
          </div>
        </ImportPreview>
      )}
      {last && (
        <p className="flex items-start gap-1.5 text-[11.5px] leading-snug text-[var(--ink-3)]">
          <History size={12} aria-hidden className="mt-[2px] shrink-0" />
          {t("ghg.ed.last", {
            date: fmt.date(localDay(last.at)),
            year: last.year,
            grid: last.grid ? `${name(last.grid.from)} → ${name(last.grid.to)}` : "—",
            pct: pct((last.after.scope1 + last.after.scope2Location) / Math.max(1e-9, last.before.scope1 + last.before.scope2Location) - 1),
          })}
        </p>
      )}
    </InputGroup>
  );
}
