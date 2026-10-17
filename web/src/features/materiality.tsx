"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/i18n/provider";
import { classify, type MaterialityTopic } from "@/lib/calc/indicators";
import { FiguresRow, InputGroup, PageHeader, ToolLayout } from "@/components/shell";
import { Figure, LegendItem } from "@/components/figure";
import { MaterialityMatrix } from "@/components/charts";
import { NumberField, StatusMark, Toggle } from "@/components/ui";
import { PillarLegend, ScoreScale, ThemeIcon, ThemeRing } from "@/components/data";
import { ESRS_THEME, PILLAR_THEME, th, type Pillar, type ThemeId } from "@/data/themes";
import { Hydrated, NoteList, SectionTitle, ToolActions, useTool } from "./common";

const pillarOf = (id: string): Pillar => (id[0] === "E" || id[0] === "S" || id[0] === "G" ? id[0] : "X");
const themeOf = (id: string): ThemeId => ESRS_THEME[id] ?? PILLAR_THEME[pillarOf(id)];

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
        family="people"
        title={t("nav.materiality")}
        result={t("mat.result", { n: material.length, total: m.topics.length, double: scored.filter((s) => s.c.kind === "double").length })}
        actions={<ToolActions tool="materiality" />}
      />
      <ToolLayout
        family="people"
        inputs={
          <>
            <InputGroup title={t("mat.threshold")}>
              <NumberField label={t("mat.thresholdLabel")} hint={t("mat.thresholdHint")} value={m.threshold} min={1} max={5} onChange={(v) => set({ ...m, threshold: v })} />
            </InputGroup>
            <InputGroup title={t("mat.topic")}>
              <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t("mat.topic")}>
                {m.topics.map((tp) => {
                  const on = sel === tp.id;
                  const tm = themeOf(tp.id);
                  return (
                    <button
                      key={tp.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setSel(tp.id)}
                      className="h-8 min-w-11 rounded-[9px] border px-2 text-[13px] font-semibold transition-colors duration-150"
                      style={{ background: on ? th(tm, "ink") : th(tm, "wash"), borderColor: on ? th(tm, "ink") : th(tm, "light"), color: on ? "#fff" : th(tm, "ink") }}
                    >
                      {tp.id}
                    </button>
                  );
                })}
              </div>
              {selected && (
                <>
                  <p className="group flex items-center gap-2.5 text-[15px] font-semibold">
                    <ThemeIcon theme={themeOf(selected.id)} />
                    {t(`mat.topics.${selected.id}`)}
                  </p>
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
        <div className="grid gap-6 2xl:grid-cols-[minmax(0,560px)_minmax(0,1fr)]">
          <Figure
            title={t("mat.chart")}
            caption={t("mat.chartCaption")}
            meta={meta}
            legend={
              <>
                <PillarLegend pillars={["E", "S", "G"]} />
                <LegendItem kind="band" color="var(--th-energy-wash)" label={t("mat.doubleZone")} />
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
              points={scored.map((s) => ({ id: s.tp.id, label: t(`mat.topics.${s.tp.id}`), x: s.c.financial, y: s.c.impact, color: th(PILLAR_THEME[pillarOf(s.tp.id)]), material: s.c.material }))}
            />
          </Figure>
          <Figure
            title={t("mat.ring")}
            caption={t("mat.ringCaption")}
            meta={meta}
            legend={<PillarLegend pillars={["E", "S", "G"]} />}
            table={rankTable(scored)}
          >
            <ThemeRing
              label={t("mat.ring")}
              max={5}
              selected={sel}
              onSelect={setSel}
              center={{ value: String(material.length), label: t("mat.ringCenter") }}
              items={scored.map((s) => ({ id: s.tp.id, label: t(`mat.topics.${s.tp.id}`), theme: themeOf(s.tp.id), pillar: pillarOf(s.tp.id), value: Math.max(s.c.impact, s.c.financial), strong: s.c.material }))}
            />
          </Figure>
        </div>
        <div className="glass sheet flex min-w-0 flex-col gap-3 p-5 md:p-6">
          <SectionTitle>{t("mat.ranking")}</SectionTitle>
          {rankTable(scored)}
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
              .map((s, i) => (
                <tr key={s.tp.id} onClick={() => setSel(s.tp.id)} className="anim-row group cursor-pointer" style={{ ["--i" as string]: i }} aria-selected={sel === s.tp.id}>
                  <td>
                    <span className="inline-flex items-center gap-2.5">
                      <ThemeIcon theme={themeOf(s.tp.id)} size="sm" solid={sel === s.tp.id} />
                      <span>
                        <span className="font-semibold">{s.tp.id}</span> {t(`mat.topics.${s.tp.id}`)}
                      </span>
                    </span>
                  </td>
                  <td className="r">
                    <ScoreScale value={s.c.impact} theme={themeOf(s.tp.id)} threshold={m.threshold} label={`${t("mat.impact")}: ${fmt.number(s.c.impact, 1)}`} />
                  </td>
                  <td className="r">
                    <ScoreScale value={s.c.financial} theme={themeOf(s.tp.id)} threshold={m.threshold} label={`${t("mat.financial")}: ${fmt.number(s.c.financial, 1)}`} />
                  </td>
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
