"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/provider";
import type { EnvInput, SafetyInput, WorkforceInput } from "@/lib/calc/indicators";
import { importIndicatorsFile, lastImport, logImport, type FileRead } from "@/lib/imports";
import { INDICATOR_TEMPLATE_ROWS, INDICATORS, STRESSED_WITHDRAWAL, type IndicatorGroup, type IndicatorImport, type IndicatorValue } from "@/lib/indicators-import";
import { xlsxWorkbook, XLSX_MIME } from "@/lib/spreadsheet";
import { FileImport, ImportPreview, IssueList } from "@/components/file-import";
import { Button } from "@/components/ui";
import { useActiveClient, useWorkspace } from "@/store/workspace";
import { useTool } from "./common";

type Indicators = { env: EnvInput; safety: SafetyInput; workforce: WorkforceInput };

const labelKey = (group: IndicatorGroup, field: string) => (group === "env" ? `env.${field}` : `work.${field}`);

/** Unit the app stores per field, for the preview. */
function useUnit() {
  const { t } = useI18n();
  return (field: string): string =>
    ({
      energyGj: "GJ",
      renewableGj: "GJ",
      waterWithdrawalM3: "m³",
      waterDischargeM3: "m³",
      wasteTotalT: "t",
      wasteRecoveredT: "t",
      wasteHazardousT: "t",
      revenueMillionTry: t("units.mTryShort"),
      hoursWorked: t("units.hours"),
      trainingHours: t("units.hours"),
      lostDays: t("units.days"),
      avgPayMen: "TL",
      avgPayWomen: "TL",
    })[field] ?? "";
}

/**
 * Indicator import shared by the environment and workforce screens: one file can carry energy, water,
 * waste, safety and workforce rows; applying it updates every indicator present and nothing else.
 */
export function IndicatorImport() {
  const { t, fmt } = useI18n();
  const [ind, set] = useTool("indicators");
  const client = useActiveClient();
  const update = useWorkspace((s) => s.update);
  const unit = useUnit();
  const [result, setResult] = useState<{ read: FileRead<IndicatorImport>; name: string } | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const read = result?.read.ok ? result.read : null;
  const values = read?.result.values ?? [];

  const show = (v: number, field: string) => (field === "waterStressShare" ? fmt.percent(v, 1) : `${fmt.number(v, Number.isInteger(v) ? 0 : 2)} ${unit(field)}`.trim());
  const current = (v: IndicatorValue) => (ind as Indicators)[v.group][v.field as never] as number;

  const apply = () => {
    if (!read || !result) return;
    const p = read.result.patch;
    set({ ...ind, env: { ...ind.env, ...p.env }, safety: { ...ind.safety, ...p.safety }, workforce: { ...ind.workforce, ...p.workforce } });
    update("importLog", logImport(client.importLog, { tool: "indicators", fileName: result.name, sha256: read.sha256, importedAt: new Date().toISOString(), sheet: read.sheet, rows: read.result.rows, applied: values.length }));
    setDone(t("imp.ind.applied", { n: values.length }));
    setResult(null);
  };

  const listRows = (): string[][] => [
    [t("imp.ind.listKey"), t("imp.ind.listName"), t("imp.ind.listUnits"), t("imp.ind.listKind")],
    ...INDICATORS.map((d) => [d.key, t(labelKey(d.group, d.field)), Object.keys(d.units).filter(Boolean).join(", ") || "—", t(`imp.ind.kind.${d.kind}`)]),
    [STRESSED_WITHDRAWAL.key, t("imp.ind.stressed"), Object.keys(STRESSED_WITHDRAWAL.units).join(", "), t("imp.ind.kind.flow")],
  ];

  return (
    <FileImport
      title={t("imp.ind.title")}
      hint={t("imp.ind.hint")}
      templates={[
        { label: t("imp.templateCsv"), fileName: "isoline-gosterge-sablonu.csv", mime: "text/csv;charset=utf-8", make: () => "﻿" + INDICATOR_TEMPLATE_ROWS.map((r) => r.join(";")).join("\r\n") },
        {
          label: t("imp.templateXlsx"),
          fileName: "isoline-gosterge-sablonu.xlsx",
          mime: XLSX_MIME,
          excel: true,
          make: () => xlsxWorkbook([{ name: t("imp.ind.sheet"), rows: INDICATOR_TEMPLATE_ROWS, widths: [26, 14, 10, 14, 8, 26] }, { name: t("imp.ind.listSheet"), rows: listRows(), widths: [26, 40, 44, 44] }]),
        },
      ]}
      last={lastImport(client.importLog, "indicators")}
      done={done}
      onFile={async (f) => {
        setDone(null);
        setResult({ read: await importIndicatorsFile(await f.arrayBuffer(), f.name), name: f.name });
      }}
    >
      {result && (
        <ImportPreview>
          {!result.read.ok ? (
            <>
              <p className="font-semibold">{result.name}</p>
              <IssueList items={[t(`imp.err.${result.read.error}`, { mb: 15 })]} />
            </>
          ) : (
            <>
              <p className="font-semibold">{t("imp.ind.preview", { file: result.read.sheet ? `${result.name} · ${result.read.sheet}` : result.name, rows: result.read.result.rows, n: values.length })}</p>
              {values.length > 0 && (
                <div className="max-h-56 overflow-auto">
                  <table className="report-table text-[12.5px]">
                    <thead>
                      <tr>
                        <th>{t("imp.ind.col.indicator")}</th>
                        <th className="r">{t("imp.ind.col.current")}</th>
                        <th className="r">{t("imp.ind.col.new")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {values.map((v) => (
                        <tr key={v.key}>
                          <td>
                            {t(labelKey(v.group, v.field))}
                            <span className="block text-[11px] text-[var(--ink-3)]">{v.sites ? t("imp.ind.rowsSites", { rows: v.rows, sites: v.sites }) : t("imp.ind.rowsOnly", { rows: v.rows })}</span>
                          </td>
                          <td className="r num text-[var(--ink-3)]">{show(current(v), v.field)}</td>
                          <td className="r num font-medium">{show(v.value, v.field)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <IssueList items={result.read.result.issues.map((i) => `${t("ghg.import.row", { row: i.row })} ${t(`imp.ind.err.${i.key}`, i.vars)}`)} />
            </>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            {values.length > 0 && (
              <Button variant="primary" size="sm" onClick={apply}>
                {t("imp.ind.apply", { n: values.length })}
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setResult(null)}>
              {t("clients.cancel")}
            </Button>
          </div>
        </ImportPreview>
      )}
    </FileImport>
  );
}
