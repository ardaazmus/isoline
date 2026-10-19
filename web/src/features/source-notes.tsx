"use client";

import { FileCheck2 } from "lucide-react";
import { useI18n } from "@/i18n/provider";
import type { SectionId } from "@/lib/approval";
import { DATA_POINTS, hasEvidence, setTrack, trackOf, type DataPoint, type TrackPatch } from "@/lib/requests";
import { useActiveClient, useWorkspace } from "@/store/workspace";
import { InputGroup } from "@/components/shell";
import { DraftInput } from "@/components/ui";
import { useQuickMode } from "./quick";

/**
 * Source documents of a section's hand-entered values (workflow step 2, "elle girişte belge notu"): one line
 * per data point with the document's name and date. The note is stored with the data request tracking, so
 * the request list, its file exports and the section lock all see it; in a locked section the inputs
 * panel's fieldset disables the fields. A file import's own evidence (file, SHA-256) is shown once the item
 * has been accepted against it.
 */
export function SourceNotes({ section }: { section: SectionId }) {
  return useQuickMode() ? null : <SectionSourceNotes section={section} />;
}

function SectionSourceNotes({ section }: { section: SectionId }) {
  const { t } = useI18n();
  const client = useActiveClient();
  const update = useWorkspace((s) => s.update);
  const points = DATA_POINTS.filter((d) => d.section === section);
  if (!points.length) return null;
  const done = points.filter((d) => hasEvidence(trackOf(client.requests, d.id))).length;
  const edit = (d: DataPoint, patch: TrackPatch) => update("requests", setTrack(client.requests, d, patch, client.importLog, new Date().toISOString()));
  return (
    <InputGroup title={t("src.title")}>
      <details className="group/src">
        <summary className="cursor-pointer text-[13px] font-medium text-[var(--accent-ink)]">{t("src.summary", { n: done, total: points.length })}</summary>
        <p className="mt-2 text-[12.5px] leading-snug text-[var(--ink-3)]">{t("src.hint")}</p>
        <ul className="mt-3 flex flex-col gap-3">
          {points.map((d) => {
            const tr = trackOf(client.requests, d.id);
            const name = t(`req.items.${d.id}`);
            return (
              <li key={d.id} className="flex flex-col gap-1.5 border-t border-[var(--rule)] pt-3 first:border-t-0 first:pt-0">
                <span className="text-[13px] font-medium leading-snug text-[var(--ink-2)]">{name}</span>
                <span className="text-[11.5px] leading-snug text-[var(--ink-3)]">{t("src.expected", { doc: t(`req.docs.${d.id}`) })}</span>
                <DraftInput value={tr.source?.doc ?? ""} label={`${t("src.doc")}: ${name}`} placeholder={t("src.doc")} onCommit={(v) => edit(d, { sourceDoc: v })} />
                <label className="flex items-center gap-2 text-[12px] text-[var(--ink-3)]">
                  {t("src.date")}
                  <input
                    type="date"
                    aria-label={`${t("src.date")}: ${name}`}
                    value={tr.source?.date ?? ""}
                    onChange={(e) => edit(d, { sourceDate: e.target.value })}
                    className="field-input h-9 text-[13.5px]"
                    style={{ width: "9.5rem" }}
                  />
                </label>
                {tr.evidence && (
                  <span className="inline-flex items-center gap-1.5 text-[11.5px] text-[var(--ink-2)]" title={`SHA-256 ${tr.evidence.sha256}`}>
                    <FileCheck2 size={13} aria-hidden className="shrink-0 text-[var(--b-600)]" />
                    <span className="truncate">{tr.evidence.fileName}</span>
                    <span className="num shrink-0 text-[var(--ink-3)]">{tr.evidence.sha256.slice(0, 12)}…</span>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </details>
    </InputGroup>
  );
}
