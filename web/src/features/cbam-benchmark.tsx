"use client";

import { useI18n } from "@/i18n/provider";
import type { CbamProduct } from "@/lib/calc/cbam";
import { formatCn } from "@/lib/factors";
import { useCountryName } from "@/components/factor-picker";
import { benchmarkRowFor, resolveBenchmark, rowRoutes } from "@/lib/calc/cbam-benchmarks";
import { NumberField, SelectField, StatusMark } from "@/components/ui";

/**
 * CBAM benchmark of a product (Impl. Reg. 2025/2620): the official value the free allocation adjustment uses,
 * where it comes from (column, route, production-year period) and, with actual data, the route and the
 * precursors' share. A hand-entered benchmark stays possible but must be chosen.
 */
export function BenchmarkField({ p, year, onChange }: { p: CbamProduct; year: number; onChange: (patch: Partial<CbamProduct>) => void }) {
  const { t, fmt } = useI18n();
  const mode = p.useDefault ? "default" : "actual";
  const r = resolveBenchmark(p, year, mode);
  const row = r.row ?? benchmarkRowFor(p.cn).row ?? undefined;
  const routes = row ? rowRoutes(row) : [];
  const n = (v: number | undefined) => (v === undefined ? "—" : fmt.number(v, 3));
  const manual = p.bmMode === "manual";
  const countryName = useCountryName();

  return (
    <div className="flex flex-col gap-2 rounded-[12px] border border-[var(--rule)] bg-[var(--glass-strong)] p-3">
      <SelectField<"official" | "manual">
        label={t("cbam.bm.mode")}
        value={manual ? "manual" : "official"}
        onChange={(v) => onChange({ bmMode: v })}
        options={[
          { value: "official", label: t("cbam.bm.official") },
          { value: "manual", label: t("cbam.bm.manual") },
        ]}
      />
      {manual ? (
        <NumberField label={t("cbam.benchmark")} unit="t/t" hint={t("cbam.bm.manualHint")} value={p.benchmark} onChange={(v) => onChange({ benchmark: v })} min={0} />
      ) : (
        <>
          {!p.useDefault && routes.length > 0 && (
            <SelectField<string>
              label={t("cbam.bm.route")}
              value={p.bmRoute ?? ""}
              onChange={(v) => onChange({ bmRoute: v || undefined })}
              options={[{ value: "", label: t("cbam.bm.routeTable") }, ...routes.map((x) => ({ value: x, label: `(${x}) ${t(`cbam.bm.routes.${x}`)}` }))]}
            />
          )}
          {!p.useDefault && r.status === "ok" && (
            <NumberField
              label={t("cbam.bm.precursor")}
              unit="t/t"
              hint={t("cbam.bm.precursorHint", { value: n(r.precursorDefault ? r.precursor : (r.b ?? 0) - (r.a ?? 0)) })}
              nullable
              min={0}
              value={p.precursorBm ?? NaN}
              onChange={(v) => onChange({ precursorBm: Number.isFinite(v) ? v : null })}
            />
          )}
          <div className="flex flex-wrap items-baseline justify-between gap-2 text-[13px]">
            <span className="font-medium">
              {t("cbam.bm.value", { year })} <span className="num">{r.status === "ok" ? `${n(r.value)} t/t` : "—"}</span>
            </span>
            <StatusMark kind={r.status === "ok" ? "verified" : "review"} label={t(`cbam.bm.status.${r.status}`)} />
          </div>
          {r.status === "ok" && (
            <p className="text-[12px] leading-relaxed text-[var(--ink-3)]">
              {p.useDefault
                ? t("cbam.bm.explainDefault", { cn: formatCn(p.cn), country: countryName(p.origin ?? "TR"), route: r.routes.length ? r.routes.map((x) => `(${x})`).join("/") : "—" })
                : t("cbam.bm.explainActual", { a: n(r.a), pre: n(r.precursor), route: r.routes.length ? r.routes.map((x) => `(${x})`).join("/") : "—" })}
            </p>
          )}
        </>
      )}
    </div>
  );
}
