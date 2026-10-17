"use client";

import Link from "next/link";
import { useState } from "react";
import { useI18n } from "@/i18n/provider";
import { CROSSWALK } from "@/data/crosswalk";
import { NAV } from "@/data/nav";
import { PageHeader } from "@/components/shell";
import { SourceNote } from "@/components/figure";
import { downloadCsv } from "@/lib/export";
import { Button, cn } from "@/components/ui";
import { ThemeIcon } from "@/components/data";
import { Download } from "lucide-react";

const COLS = ["tsrs", "gri", "esrs", "vss", "cdp"] as const;

export function CrosswalkPage() {
  const { t, locale } = useI18n();
  const [focus, setFocus] = useState<(typeof COLS)[number] | null>(null);
  const href = (tool?: string) => (tool ? NAV.flatMap((g) => g.items).find((i) => i.id === tool)?.href : undefined);
  return (
    <div data-family="reporting">
      <PageHeader
        title={t("nav.crosswalk")}
        result={t("cw.result", { n: CROSSWALK.length })}
        actions={
          <Button variant="onBand" onClick={() => downloadCsv("isoline-crosswalk.csv", ["datapoint", ...COLS], CROSSWALK.map((r) => [t(`cw.rows.${r.id}`), ...COLS.map((c) => r[c])]))}>
            <Download size={15} aria-hidden /> CSV
          </Button>
        }
      />
      <p className="mb-6 max-w-[72ch] text-[14px] text-[var(--ink-2)]">{t("cw.intro")}</p>
      <div className="glass sheet flex min-w-0 flex-col gap-4 p-5 md:p-6">
      <div className="overflow-x-auto">
        <table className="report-table min-w-[880px] text-[13.5px]">
          <thead>
            <tr>
              <th className="w-[22%]">{t("cw.datapoint")}</th>
              {COLS.map((c) => (
                <th key={c}>
                  <button type="button" onClick={() => setFocus(focus === c ? null : c)} aria-pressed={focus === c} className={cn("uppercase tracking-[0.06em]", focus === c && "text-[var(--ink)] underline")}>
                    {t(`cw.cols.${c}`)}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CROSSWALK.map((r, i) => (
              <tr key={r.id} className="anim-row group" style={{ ["--i" as string]: i }}>
                <td className="font-medium">
                  <span className="inline-flex items-center gap-2.5">
                    <ThemeIcon theme={r.theme} size="sm" title={t(`theme.${r.theme}`)} />
                    {href(r.tool) !== undefined ? (
                      <Link href={`/${locale}${href(r.tool)}`}>{t(`cw.rows.${r.id}`)}</Link>
                    ) : (
                      t(`cw.rows.${r.id}`)
                    )}
                  </span>
                </td>
                {COLS.map((c) => (
                  <td key={c} className={cn("whitespace-nowrap", r[c] === "—" && "text-[var(--ink-3)]", focus && focus !== c && "opacity-35", focus === c && "bg-[var(--paper-2)] font-semibold")}>
                    {r[c]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
        <SourceNote meta={{ sources: ["tsrs2", "gri_standards", "esrs_topics", "vss_2026", "cdp_2026"], status: "review" }} />
      </div>
      <p className="mt-4 max-w-[72ch] text-[13px] text-[var(--ink-3)]">{t("cw.caveat")}</p>
    </div>
  );
}
