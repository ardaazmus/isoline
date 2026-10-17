"use client";

import { useMemo } from "react";
import { useI18n } from "@/i18n/provider";
import { classify } from "@/lib/calc/indicators";
import { contrast, deltaE, simulate, type Vision } from "@/lib/color";
import { ESRS_THEME, PILLAR_THEME, THEME, THEMES, UI_COLORS, th, type Pillar, type ThemeId, type Tone } from "@/data/themes";
import { PageHeader } from "@/components/shell";
import { Figure } from "@/components/figure";
import { Delta, GroupRow, InlineBar, PillarLegend, ScoreScale, ThemeIcon, ThemeRing } from "@/components/data";
import { StatusMark } from "@/components/ui";
import { useActiveClient } from "@/store/workspace";
import { Hydrated, NoteList, SectionTitle } from "./common";

const TONES: Tone[] = ["strong", "mid", "light", "wash", "ink"];
const VISIONS: Vision[] = ["normal", "protan", "deutan", "tritan"];

export function ThemesPage() {
  const { t } = useI18n();
  const pillars = new Set(THEMES.map((x) => x.pillar)).size;
  return (
    <div data-family="compass">
      <PageHeader title={t("nav.themes")} result={t("guide.result", { n: THEMES.length, p: pillars })} />
      <div className="flex flex-col gap-6">
        <ThemeGrid />
        <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_minmax(0,520px)]">
          <Specimen />
          <Hydrated>
            <Ring />
          </Hydrated>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <SeparationCheck />
          <div className="glass sheet flex min-w-0 flex-col gap-3 p-5 md:p-6">
            <SectionTitle>{t("guide.rules")}</SectionTitle>
            <NoteList prefix="guide.rule" keys={["layers", "sheet", "count", "order", "status", "line", "motion"]} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ThemeGrid() {
  const { t } = useI18n();
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-[18px] font-semibold">{t("guide.themes")}</h2>
        <p className="mt-0.5 max-w-[80ch] text-[13px] text-[var(--ink-3)]">{t("guide.themesCaption")}</p>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
        {THEMES.map((tm, i) => (
          <li key={tm.id} className="glass sheet lift group anim-row flex min-w-0 flex-col gap-3 p-4" style={{ ["--i" as string]: i }}>
            <div className="flex items-center gap-3">
              <ThemeIcon theme={tm.id} size="lg" />
              <div className="min-w-0">
                <p className="text-[15px] font-semibold leading-tight">{t(`theme.${tm.id}`)}</p>
                <p className="text-[12px] text-[var(--ink-3)]">{t(`pillar.${tm.pillar}`)}</p>
              </div>
            </div>
            <div className="flex overflow-hidden rounded-[10px] border border-[var(--rule)]">
              {TONES.filter((x) => x !== "ink").map((tone) => (
                <span key={tone} className="h-9 flex-1" style={{ background: tm.ramp[tone] }} title={`${t(`guide.tones.${tone}`)} ${tm.ramp[tone]}`} />
              ))}
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[11.5px]">
              {TONES.map((tone) => (
                <div key={tone} className="contents">
                  <dt className="text-[var(--ink-3)]">{t(`guide.tones.${tone}`)}</dt>
                  <dd className="num font-medium" style={{ color: tone === "ink" ? tm.ramp.ink : "var(--ink-2)" }}>
                    {tm.ramp[tone]}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-auto border-t border-[var(--rule)] pt-2 text-[12.5px] leading-snug text-[var(--ink-2)]">
              <span className="label mr-1.5">{t("guide.usedFor")}</span>
              {t(`guide.use.${tm.id}`)}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Format specimen: illustrative values, labelled as such, showing every table pattern at once. */
function Specimen() {
  const { t, fmt } = useI18n();
  const groups: { pillar: Pillar; rows: { theme: ThemeId; key: string; value: string; share?: number; score: number; change: number; better: "up" | "down"; status: "verified" | "estimated" | "review" }[] }[] = [
    {
      pillar: "E",
      rows: [
        { theme: "climate", key: "scope12", value: `${fmt.number(48200)} tCO₂e`, score: 5, change: -0.061, better: "down", status: "verified" },
        { theme: "energy", key: "renewable", value: fmt.percent(0.31, 0), share: 0.31, score: 3, change: 0.04, better: "up", status: "verified" },
        { theme: "water", key: "water", value: `${fmt.number(182000)} m³`, score: 2, change: 0.02, better: "down", status: "estimated" },
        { theme: "circularity", key: "recovery", value: fmt.percent(0.86, 0), share: 0.86, score: 3, change: 0.05, better: "up", status: "review" },
      ],
    },
    {
      pillar: "S",
      rows: [
        { theme: "people", key: "ltifr", value: fmt.number(1.42, 2), score: 4, change: -0.12, better: "down", status: "verified" },
        { theme: "people", key: "women", value: fmt.percent(0.24, 0), share: 0.24, score: 3, change: 0.02, better: "up", status: "estimated" },
      ],
    },
    { pillar: "G", rows: [{ theme: "governance", key: "board", value: fmt.percent(0.42, 0), share: 0.42, score: 2, change: 0, better: "up", status: "verified" }] },
  ];
  const label = (s: "verified" | "estimated" | "review") => t(`note.status_${s}`);
  let n = 0;
  return (
    <div className="glass sheet flex min-w-0 flex-col gap-3 p-5 md:p-6">
      <SectionTitle aside={<span className="rounded-full border border-dashed border-[var(--warn)] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--warn)]">{t("guide.specimen")}</span>}>
        {t("guide.table")}
      </SectionTitle>
      <p className="max-w-[80ch] text-[13px] text-[var(--ink-3)]">{t("guide.tableCaption")}</p>
      <div className="overflow-x-auto">
        <table className="report-table min-w-[720px] text-[14px]">
          <thead>
            <tr>
              <th>{t("guide.col.indicator")}</th>
              <th className="r">{t("guide.col.value")}</th>
              <th>{t("guide.col.share")}</th>
              <th>{t("guide.col.score")}</th>
              <th className="r">{t("guide.col.change")}</th>
              <th>{t("guide.col.status")}</th>
            </tr>
          </thead>
          {groups.map((g) => (
            <tbody key={g.pillar}>
              <GroupRow theme={PILLAR_THEME[g.pillar]} colSpan={6} title={t(`pillar.${g.pillar}`)} />
              {g.rows.map((r) => {
                const i = n++;
                return (
                  <tr key={r.key} className="anim-row group" style={{ ["--i" as string]: i }}>
                    <td>
                      <span className="inline-flex items-center gap-2.5">
                        <ThemeIcon theme={r.theme} size="sm" title={t(`theme.${r.theme}`)} />
                        {t(`guide.rows.${r.key}`)}
                      </span>
                    </td>
                    <td className="r num whitespace-nowrap">{r.value}</td>
                    <td>{r.share !== undefined ? <InlineBar value={r.share} color={th(r.theme)} label={`${t(`guide.rows.${r.key}`)}: ${r.value}`} index={i} /> : <span className="text-[var(--ink-3)]">—</span>}</td>
                    <td>
                      <ScoreScale value={r.score} theme={r.theme} threshold={3} label={`${t("guide.col.score")}: ${r.score} / 5`} />
                    </td>
                    <td className="r">
                      <Delta value={r.change} better={r.better} text={fmt.percent(Math.abs(r.change), 1)} />
                    </td>
                    <td>
                      <StatusMark kind={r.status} label={label(r.status)} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          ))}
        </table>
      </div>
      <p className="text-[12px] text-[var(--warn)]">{t("guide.specimenNote")}</p>
    </div>
  );
}

function Ring() {
  const { t } = useI18n();
  const c = useActiveClient();
  const m = c.materiality;
  const scored = useMemo(() => m.topics.map((tp) => ({ tp, c: classify(tp, m.threshold) })), [m]);
  const pillar = (id: string): Pillar => (id[0] === "E" || id[0] === "S" || id[0] === "G" ? id[0] : "X");
  return (
    <Figure
      title={t("guide.ring")}
      caption={t("guide.ringCaption")}
      meta={{ sources: ["esrs_topics", "esrs_2026"], unit: t("mat.unit"), status: c.sample ? "sample" : "review" }}
      legend={<PillarLegend pillars={["E", "S", "G"]} />}
    >
      <ThemeRing
        label={t("guide.ring")}
        max={5}
        center={{ value: String(scored.filter((s) => s.c.material).length), label: t("guide.ringCenter") }}
        items={scored.map((s) => ({ id: s.tp.id, label: t(`mat.topics.${s.tp.id}`), theme: ESRS_THEME[s.tp.id] ?? PILLAR_THEME[pillar(s.tp.id)], pillar: pillar(s.tp.id), value: Math.max(s.c.impact, s.c.financial), strong: s.c.material }))}
      />
    </Figure>
  );
}

/** Live proof that the palette stays apart, computed from the same values the charts use. */
function SeparationCheck() {
  const { t, fmt } = useI18n();
  const rows = useMemo(
    () =>
      VISIONS.map((v) => {
        let best = { d: Infinity, a: THEMES[0].id, b: THEMES[1].id };
        THEMES.forEach((a, i) =>
          THEMES.slice(i + 1).forEach((b) => {
            const d = deltaE(simulate(a.ramp.strong, v), simulate(b.ramp.strong, v));
            if (d < best.d) best = { d, a: a.id, b: b.id };
          }),
        );
        return { v, ...best };
      }),
    [],
  );
  const ui = useMemo(() => {
    let best = { d: Infinity, id: THEMES[0].id };
    for (const tm of THEMES) for (const u of Object.values(UI_COLORS)) {
      const d = deltaE(tm.ramp.strong, u);
      if (d < best.d) best = { d, id: tm.id };
    }
    return best;
  }, []);
  const minContrast = Math.min(...THEMES.map((x) => contrast(x.ramp.strong, "#ffffff")));
  return (
    <div className="glass sheet flex min-w-0 flex-col gap-3 p-5 md:p-6">
      <SectionTitle>{t("guide.check")}</SectionTitle>
      <p className="max-w-[80ch] text-[13px] text-[var(--ink-3)]">{t("guide.checkCaption")}</p>
      <div className="overflow-x-auto">
      <table className="report-table text-[14px]">
        <thead>
          <tr>
            <th>{t("guide.check")}</th>
            <th>{t("guide.worstPair")}</th>
            <th className="r">{t("guide.minDelta")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.v} className="anim-row" style={{ ["--i" as string]: i }}>
              <td>{t(`guide.vision.${r.v}`)}</td>
              <td>
                <span className="inline-flex items-center gap-1.5">
                  <Swatch hex={simulate(THEME[r.a].ramp.strong, r.v)} />
                  <Swatch hex={simulate(THEME[r.b].ramp.strong, r.v)} />
                  <span className="ml-1 text-[13px] text-[var(--ink-2)]">
                    {t(`theme.${r.a}`)} · {t(`theme.${r.b}`)}
                  </span>
                </span>
              </td>
              <td className="r num font-semibold">{fmt.number(r.d, 1)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>{t("guide.fromUi")}</td>
            <td>
              <span className="inline-flex items-center gap-1.5">
                <Swatch hex={THEME[ui.id].ramp.strong} />
                <Swatch hex={UI_COLORS.cobalt} />
                <span className="ml-1 text-[13px] font-normal text-[var(--ink-2)]">{t(`theme.${ui.id}`)}</span>
              </span>
            </td>
            <td className="r num">{fmt.number(ui.d, 1)}</td>
          </tr>
        </tfoot>
      </table>
      </div>
      <p className="num text-[12px] text-[var(--ink-3)]">WCAG ≥ {fmt.number(minContrast, 2)}:1</p>
    </div>
  );
}

function Swatch({ hex }: { hex: string }) {
  return <span aria-hidden className="inline-block h-4 w-4 rounded-[4px] border border-black/5" style={{ background: hex }} />;
}
