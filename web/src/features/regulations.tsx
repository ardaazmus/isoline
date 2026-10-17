"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/provider";
import { EVENTS, LANES, type Lane } from "@/data/regulations";
import { SOURCES } from "@/data/sources";
import { PageHeader } from "@/components/shell";
import { Figure, LegendItem } from "@/components/figure";
import { Timeline } from "@/components/charts";
import { StatusMark, Tabs } from "@/components/ui";
import { SectionTitle } from "./common";

const TODAY = "2026-10-17";

export function RegulationsPage() {
  const { t, fmt } = useI18n();
  const [scope, setScope] = useState<"all" | "tr" | "eu" | "global">("all");
  const lanes = LANES.filter((l) => scope === "all" || l.id.startsWith(scope));
  const events = EVENTS.filter((e) => lanes.some((l) => l.id === e.lane));
  const upcoming = events.filter((e) => e.date >= TODAY).sort((a, b) => a.date.localeCompare(b.date));
  const next90 = upcoming.filter((e) => e.date <= "2027-01-15");
  const src = Array.from(new Set(events.map((e) => e.source)));
  const conf = (c: string) => (c === "official" ? "verified" : c === "secondary" ? "estimated" : "review");

  return (
    <div data-family="compass">
      <PageHeader title={t("nav.regulations")} result={t("reg.result", { n: next90.length, next: next90[0] ? t(`reg.events.${next90[0].id}`) : "—", date: next90[0] ? fmt.date(next90[0].date) : "" })} />
      <div className="flex flex-col gap-10">
        <Tabs
          label={t("reg.scope")}
          value={scope}
          onChange={setScope}
          items={[
            { value: "all", label: t("reg.all") },
            { value: "tr", label: t("reg.tr") },
            { value: "eu", label: t("reg.eu") },
            { value: "global", label: t("reg.global") },
          ]}
        />
        <Figure
          title={t("reg.timeline")}
          caption={t("reg.timelineCaption")}
          meta={{ sources: src }}
          legend={
            <>
              <LegendItem kind="swatch" color="var(--ink-2)" label={t("reg.legendOfficial")} />
              <LegendItem color="var(--ink-2)" dash label={t("reg.legendSecondary")} />
              <LegendItem color="var(--crit)" label={t("reg.today", { date: fmt.date(TODAY) })} />
            </>
          }
          csv={{ header: ["date", "lane", "event", "source", "confidence"], rows: events.map((e) => [e.date, e.lane, t(`reg.events.${e.id}`), SOURCES[e.source]?.cite ?? e.source, e.confidence]) }}
        >
          <Timeline
            label={t("reg.timeline")}
            lanes={lanes.map((l) => ({ id: l.id, label: t(`reg.lanes.${l.id}`), color: l.color }))}
            events={events.map((e) => ({ id: e.id, lane: e.lane, date: e.date, label: t(`reg.events.${e.id}`), confidence: e.confidence, approx: e.approx }))}
            from="2025-07-01"
            to="2034-06-30"
            today={TODAY}
            fmtDate={fmt.date}
          />
        </Figure>
        <div className="glass sheet flex min-w-0 flex-col gap-3 p-5 md:p-6">
          <SectionTitle>{t("reg.upcoming")}</SectionTitle>
          <div className="overflow-x-auto">
            <table className="report-table text-[14px]">
              <thead>
                <tr>
                  <th>{t("reg.date")}</th>
                  <th>{t("reg.event")}</th>
                  <th>{t("reg.lane")}</th>
                  <th>{t("note.source")}</th>
                  <th>{t("note.status")}</th>
                </tr>
              </thead>
              <tbody>
                {upcoming.map((e) => (
                  <tr key={e.id}>
                    <td className="num whitespace-nowrap font-semibold">
                      {e.approx ? "≈ " : ""}
                      {fmt.date(e.date)}
                    </td>
                    <td>{t(`reg.events.${e.id}`)}</td>
                    <td className="whitespace-nowrap text-[13px] text-[var(--ink-3)]">{t(`reg.lanes.${e.lane as Lane}`)}</td>
                    <td className="text-[13px]">
                      <a href={SOURCES[e.source]?.url} target="_blank" rel="noreferrer" className="underline decoration-[var(--rule)] hover:decoration-[var(--ink)]">
                        {SOURCES[e.source]?.cite}
                      </a>
                    </td>
                    <td>
                      <StatusMark kind={conf(e.confidence) as "verified"} label={t(`note.status_${conf(e.confidence)}`)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
