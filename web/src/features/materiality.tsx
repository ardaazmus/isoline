"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/i18n/provider";
import { classify, type MaterialityTopic } from "@/lib/calc/indicators";
import { FiguresRow, InputGroup, PageHeader, ToolLayout } from "@/components/shell";
import { Figure, LegendItem } from "@/components/figure";
import { MaterialityMatrix } from "@/components/charts";
import { NumberField, StatusMark, Toggle } from "@/components/ui";
import { Hydrated, NoteList, SectionTitle, ToolActions, useTool } from "./common";

const TOPIC_COLOR: Record<string, string> = { E: "var(--hydro)", S: "var(--forest)", G: "var(--report)" };

export function MaterialityTool() {
  return (
    <Hydrated>
      <Inner />
    </Hydrated>
  );
}

function Inner() {
  const { t, fmt } = useI18n();
  const [m, set, client] = useTool("materiality");
  const [sel, setSel] = useState<string | null>(m.topics[0]?.id ?? null);
  const scored = useMemo(() => m.topics.map((tp) => ({ tp, c: classify(tp, m.threshold) })), [m]);
  const material = scored.filter((s) => s.c.material);
  const selected = m.topics.find((x) => x.id === sel);
  const setTopic = (id: string, p: Partial<MaterialityTopic>) => set({ ...m, topics: m.topics.map((x) => (x.id === id ? { ...x, ...p } : x)) });
  const meta = { sources: ["esrs_topics", "esrs_2026", "tsrs1"], boundary: t("mat.boundary"), unit: t("mat.unit"), status: client.sample ? ("sample" as const) : ("review" as const) };
  const score = (k: keyof MaterialityTopic, hint?: string) =>
    selected && <NumberField key={k} label={t(`mat.${k}`)} hint={hint} value={selected[k] as number} min={1} max={5} onChange={(v) => setTopic(selected.id, { [k]: Math.round(v) } as Partial<MaterialityTopic>)} />;

  return (
    <>
      <PageHeader
        family="forest"
        title={t("nav.materiality")}
        result={t("mat.result", { n: material.length, total: m.topics.length, double: scored.filter((s) => s.c.kind === "double").length })}
        actions={<ToolActions tool="materiality" />}
      />
      <ToolLayout
        family="forest"
        inputs={
          <>
            <InputGroup title={t("mat.threshold")}>
              <NumberField label={t("mat.thresholdLabel")} hint={t("mat.thresholdHint")} value={m.threshold} min={1} max={5} onChange={(v) => set({ ...m, threshold: v })} />
            </InputGroup>
            <InputGroup title={t("mat.topic")}>
              <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t("mat.topic")}>
                {m.topics.map((tp) => (
                  <button
                    key={tp.id}
                    type="button"
                    role="radio"
                    aria-checked={sel === tp.id}
                    onClick={() => setSel(tp.id)}
                    className={`h-8 min-w-11 border px-2 text-[13px] font-semibold ${sel === tp.id ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)]" : "border-[var(--rule)] hover:border-[var(--ink-3)]"}`}
                  >
                    {tp.id}
                  </button>
                ))}
              </div>
              {selected && (
                <>
                  <p className="text-[15px] font-semibold">{t(`mat.topics.${selected.id}`)}</p>
                  <Toggle label={t("mat.positive")} checked={selected.positive} onChange={(v) => setTopic(selected.id, { positive: v })} />
                  <p className="label pt-2">{t("mat.impactSide")}</p>
                  {score("scale")}
                  {score("scope")}
                  {!selected.positive && score("irremediability")}
                  {score("impactLikelihood", t("mat.likelihoodHint"))}
                  <p className="label pt-2">{t("mat.financialSide")}</p>
                  {score("magnitude")}
                  {score("financialLikelihood")}
                </>
              )}
            </InputGroup>
          </>
        }
      >
        <FiguresRow
          pulseKey={material.length}
          items={[
            { label: t("mat.figMaterial"), value: String(material.length), tone: "fam", trend: scored.map((x) => Math.max(x.c.impact, x.c.financial)) },
            { label: t("mat.figDouble"), value: String(scored.filter((s) => s.c.kind === "double").length), trend: scored.map((x) => Math.min(x.c.impact, x.c.financial)) },
            { label: t("mat.figImpact"), value: String(scored.filter((s) => s.c.kind === "impact").length), trend: scored.map((x) => x.c.impact) },
            { label: t("mat.figFinancial"), value: String(scored.filter((s) => s.c.kind === "financial").length), trend: scored.map((x) => x.c.financial) },
          ]}
        />
        <div className="grid gap-10 2xl:grid-cols-[minmax(0,560px)_minmax(0,1fr)]">
          <Figure
            title={t("mat.chart")}
            caption={t("mat.chartCaption")}
            meta={meta}
            legend={
              <>
                <LegendItem kind="swatch" color="var(--hydro)" label={t("mat.env")} />
                <LegendItem kind="swatch" color="var(--forest)" label={t("mat.soc")} />
                <LegendItem kind="swatch" color="var(--report)" label={t("mat.gov")} />
                <LegendItem kind="band" color="var(--forest-wash)" label={t("mat.doubleZone")} />
              </>
            }
            csv={{ header: ["topic", "impact", "financial", "material", "kind"], rows: scored.map((s) => [s.tp.id, s.c.impact.toFixed(2), s.c.financial.toFixed(2), s.c.material ? 1 : 0, s.c.kind]) }}
            table={rankTable(scored)}
          >
            <MaterialityMatrix
              label={t("mat.chart")}
              threshold={m.threshold}
              xLabel={t("mat.xAxis")}
              yLabel={t("mat.yAxis")}
              selected={sel}
              onSelect={setSel}
              points={scored.map((s) => ({ id: s.tp.id, label: t(`mat.topics.${s.tp.id}`), x: s.c.financial, y: s.c.impact, color: TOPIC_COLOR[s.tp.id[0]] ?? "var(--ink)", material: s.c.material }))}
            />
          </Figure>
          <div className="glass flex min-w-0 flex-col gap-3 p-5 md:p-6">
            <SectionTitle>{t("mat.ranking")}</SectionTitle>
            {rankTable(scored)}
          </div>
        </div>
        <NoteList prefix="mat.notes" keys={["method", "topdown", "evidence", "tsrs"]} />
      </ToolLayout>
    </>
  );

  function rankTable(rows: typeof scored) {
    return (
      <div className="overflow-x-auto">
        <table className="report-table text-[14px]">
          <thead>
            <tr>
              <th>{t("mat.topic")}</th>
              <th className="r">{t("mat.impact")}</th>
              <th className="r">{t("mat.financial")}</th>
              <th>{t("mat.result_col")}</th>
            </tr>
          </thead>
          <tbody>
            {[...rows]
              .sort((a, b) => Math.max(b.c.impact, b.c.financial) - Math.max(a.c.impact, a.c.financial))
              .map((s) => (
                <tr key={s.tp.id} onClick={() => setSel(s.tp.id)} className="cursor-pointer">
                  <td>
                    <span className="font-semibold">{s.tp.id}</span> {t(`mat.topics.${s.tp.id}`)}
                  </td>
                  <td className="r num">{fmt.number(s.c.impact, 1)}</td>
                  <td className="r num">{fmt.number(s.c.financial, 1)}</td>
                  <td>
                    <StatusMark kind={s.c.material ? "required" : "na"} label={t(`mat.kind_${s.c.kind}`)} />
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    );
  }
}
