"use client";

import { useMemo, useState } from "react";
import { FileDown } from "lucide-react";
import { useI18n } from "@/i18n/provider";
import { AR_GROUPS, AR_ITEMS } from "@/data/annual-report";
import { SOURCES } from "@/data/sources";
import type { ArStatus } from "@/data/sample";
import { buildDocx } from "@/lib/docx";
import { docApproval } from "./approval";
import { download, slug } from "@/lib/export";
import { netSales } from "@/lib/trial-balance";
import { FiguresRow, PageHeader } from "@/components/shell";
import { SourceNote } from "@/components/figure";
import { ShareBar } from "@/components/charts";
import { Button, Tabs } from "@/components/ui";
import { Hydrated, SectionTitle, useTool } from "./common";

const STATUSES: ArStatus[] = ["todo", "draft", "review", "approved", "na"];
/** Check-box mark per status in the Word checklist: done, not applicable, still open. */
const MARK: Record<ArStatus, string> = { approved: "☑", na: "—", todo: "☐", draft: "☐", review: "☐" };
const STATUS_COLOR: Record<ArStatus, string> = { todo: "var(--paper-3)", draft: "var(--b-400)", review: "var(--warn)", approved: "var(--ink)", na: "var(--rule)" };

export function AnnualReportTool() {
  return (
    <Hydrated>
      <Inner />
    </Hydrated>
  );
}

function Inner() {
  const { t, fmt } = useI18n();
  const [ar, set, client] = useTool("annualReport");
  const [busy, setBusy] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const items = useMemo(() => AR_ITEMS.filter((i) => i.profiles.includes(ar.profile)), [ar.profile]);
  const st = (id: string): ArStatus => ar.status[id] ?? "todo";
  const counts = STATUSES.reduce((m, s) => ({ ...m, [s]: items.filter((i) => st(i.id) === s).length }), {} as Record<ArStatus, number>);
  const applicable = items.length - counts.na;
  const done = applicable ? counts.approved / applicable : 0;
  const groups = AR_GROUPS.filter((g) => items.some((i) => i.group === g));

  const exportDocx = async () => {
    setBusy(true);
    setExportError(null);
    try {
      const blob = await buildDocx({
        title: t("ar.docTitle"),
        subtitle: t(`ar.profile.${ar.profile}`),
        client: client.name,
        intro: t("ar.docIntro"),
        labels: { refs: t("tpl.refs"), figures: t("tpl.figures"), draft: t("tpl.draftHere"), sources: t("note.source") },
        sources: Array.from(new Set(items.map((i) => i.source)))
          .map((s) => SOURCES[s])
          .filter(Boolean)
          .map((s) => `${s.cite} — ${s.url}`),
        approval: docApproval(client, client.trialBalance ? ["trialBalance"] : [], t, fmt),
        sections: groups.map((g) => {
          const own = items.filter((i) => i.group === g);
          const applicableHere = own.filter((i) => st(i.id) !== "na").length;
          const net = g === "financial" && client.trialBalance ? netSales(client.trialBalance) : null;
          return {
            title: t(`ar.groups.${g}`),
            guide: own.map((i) => `${MARK[st(i.id)]} ${t(`ar.items.${i.id}`)} — ${t(`ar.status.${st(i.id)}`)}${ar.owners[i.id] ? ` (${ar.owners[i.id]})` : ""}`).join("\n"),
            refs: Array.from(new Set(own.map((i) => i.ref))),
            figures: [
              { label: t("ar.docApproved"), value: `${own.filter((i) => st(i.id) === "approved").length} / ${applicableHere}` },
              ...(net ? [{ label: `${t("tb.figNet")} (${t("tb.figNetNote")}; ${client.trialBalance!.fileName})`, value: fmt.currency(net.net, "TRY") }] : []),
            ],
            status: client.sample ? t("tpl.sampleFigures") : undefined,
          };
        }),
      });
      download(`${slug(client.name)}-${t("ar.docFile")}.docx`, blob, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    } catch (e) {
      setExportError(t("tpl.exportError", { msg: e instanceof Error ? e.message : String(e) }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-family="reporting">
      <PageHeader
        title={t("nav.annualReport")}
        result={t("ar.result", { done: counts.approved, total: applicable, pct: fmt.percent(done, 0) })}
        actions={
          <Button variant="onBandPrimary" onClick={exportDocx} disabled={busy}>
            <FileDown size={15} aria-hidden /> {busy ? t("tpl.preparing") : t("ar.exportDocx")}
          </Button>
        }
      />
      <div className="flex flex-col gap-10">
        {exportError && (
          <p role="alert" className="text-[13.5px] text-[var(--crit)]">
            {exportError}
          </p>
        )}
        <Tabs
          label={t("ar.profileLabel")}
          value={ar.profile}
          onChange={(v) => set({ ...ar, profile: v })}
          items={(["ttk", "listed", "bank"] as const).map((p) => ({ value: p, label: t(`ar.profile.${p}`) }))}
        />
        <FiguresRow
          pulseKey={counts.approved}
          items={[
            { label: t("ar.status.approved"), value: String(counts.approved), tone: "fam" },
            { label: t("ar.status.review"), value: String(counts.review) },
            { label: t("ar.status.draft"), value: String(counts.draft) },
            { label: t("ar.status.todo"), value: String(counts.todo) },
          ]}
        />
        <ShareBar label={t("ar.progress")} parts={STATUSES.filter((s) => s !== "na").reverse().map((s) => ({ value: applicable ? counts[s] / applicable : 0, color: STATUS_COLOR[s], label: t(`ar.status.${s}`) }))} />
        {groups.map((g) => (
          <section key={g} className="glass sheet flex min-w-0 flex-col gap-2 p-5 md:p-6">
            <SectionTitle>{t(`ar.groups.${g}`)}</SectionTitle>
            <div className="overflow-x-auto">
              <table className="report-table text-[14px]">
                <thead>
                  <tr>
                    <th className="w-[46%]">{t("ar.item")}</th>
                    <th>{t("ar.ref")}</th>
                    <th className="w-[150px]">{t("ar.owner")}</th>
                    <th className="w-[160px]">{t("note.status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {items
                    .filter((i) => i.group === g)
                    .map((i, k) => (
                      <tr key={i.id} className="anim-row" style={{ ["--i" as string]: k }}>
                        <td>
                          <span className={st(i.id) === "na" ? "text-[var(--ink-3)] line-through" : "font-medium"}>{t(`ar.items.${i.id}`)}</span>
                          <span className="mt-0.5 block text-[12.5px] text-[var(--ink-3)]">{t(`ar.hints.${i.id}`)}</span>
                        </td>
                        <td className="whitespace-nowrap text-[13px] text-[var(--ink-2)]">{i.ref}</td>
                        <td>
                          <label className="sr-only" htmlFor={`own-${i.id}`}>
                            {t("ar.owner")}
                          </label>
                          <input id={`own-${i.id}`} className="field-input text-[13.5px]" value={ar.owners[i.id] ?? ""} placeholder={t("ar.ownerPh")} onChange={(e) => set({ ...ar, owners: { ...ar.owners, [i.id]: e.target.value } })} />
                        </td>
                        <td>
                          <label className="sr-only" htmlFor={`st-${i.id}`}>
                            {t("note.status")}
                          </label>
                          <span className="flex items-center gap-2">
                            <span aria-hidden className="h-2.5 w-2.5 shrink-0" style={{ background: STATUS_COLOR[st(i.id)], outline: "1px solid var(--rule)" }} />
                            <select id={`st-${i.id}`} className="field-input text-[13.5px]" value={st(i.id)} onChange={(e) => set({ ...ar, status: { ...ar.status, [i.id]: e.target.value as ArStatus } })}>
                              {STATUSES.map((s) => (
                                <option key={s} value={s}>
                                  {t(`ar.status.${s}`)}
                                </option>
                              ))}
                            </select>
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
        <SourceNote meta={{ sources: Array.from(new Set(items.map((i) => i.source))) }} />
        <p className="max-w-[72ch] text-[13.5px] text-[var(--ink-3)]">{t("ar.timingNote")}</p>
      </div>
    </div>
  );
}
