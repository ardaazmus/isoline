"use client";

import { useState } from "react";
import { CircleCheck, Globe, History, Lock, Send, Undo2 } from "lucide-react";
import { useI18n } from "@/i18n/provider";
import { act, allLocked, approvalOf, availableActions, isLocked, type Approval, type ApprovalAction, type ApprovalError, type SectionId } from "@/lib/approval";
import type { DocApproval } from "@/lib/docx";
import type { Formatters } from "@/i18n/core";
import type { ClientData } from "@/data/sample";
import { localDay } from "@/lib/dates";
import { useActiveClient, useWorkspace } from "@/store/workspace";
import { Button, StatusMark } from "@/components/ui";

const MARK = { draft: "estimated", review: "review", approved: "verified", published: "verified" } as const;
const ICON: Record<ApprovalAction, typeof Send> = { submit: Send, sendBack: Undo2, approve: CircleCheck, publish: Globe, reopen: Undo2 };

type T = (key: string, vars?: Record<string, string | number>) => string;

/** The Word sign-off block for the sections a document uses; a draft note when any of them is not approved. */
export function docApproval(client: ClientData, sections: SectionId[], t: T, fmt: Formatters): DocApproval | undefined {
  if (!sections.length) return undefined;
  return {
    labels: { title: t("appr.doc.title"), section: t("appr.doc.section"), status: t("appr.doc.status"), preparedBy: t("appr.doc.preparedBy"), approvedBy: t("appr.doc.approvedBy"), date: t("appr.doc.date") },
    rows: sections.map((s) => {
      const a = approvalOf(client.approvals, s);
      return { section: t(`nav.${s}`), status: t(`appr.status.${a.status}`), preparedBy: a.preparedBy, approvedBy: a.approvedBy, date: a.approvedAt ? fmt.date(localDay(a.approvedAt)) : "" };
    }),
    draftNote: allLocked(client.approvals, sections) ? undefined : t("appr.doc.draft"),
  };
}

/** A section's approval and whether it is locked (approved or published). */
export function useApproval(section: SectionId): { approval: Approval; locked: boolean } {
  const client = useActiveClient();
  const approval = approvalOf(client.approvals, section);
  return { approval, locked: isLocked(approval) };
}

/**
 * Status bar of a tool section: who prepared and approved it, the moves open now, and the history. Approving
 * locks the section's inputs; reopening, with a reason, unlocks them.
 */
export function ApprovalBar({ section }: { section: SectionId }) {
  const { t, fmt } = useI18n();
  const client = useActiveClient();
  const update = useWorkspace((s) => s.update);
  const { approval, locked } = useApproval(section);
  const [by, setBy] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<ApprovalError | null>(null);
  const [showLog, setShowLog] = useState(false);
  const actions = availableActions(approval.status);
  const needsReason = actions.some((a) => a === "sendBack" || a === "reopen");

  const run = (action: ApprovalAction) => {
    const r = act(approval, action, by, new Date().toISOString(), reason);
    if (!r.ok) return setError(r.error);
    setError(null);
    setReason("");
    update("approvals", { ...client.approvals, [section]: r.next });
  };

  const who = [
    approval.preparedBy && t("appr.preparedBy", { name: approval.preparedBy }),
    approval.approvedBy && t("appr.approvedBy", { name: approval.approvedBy, date: approval.approvedAt ? fmt.date(localDay(approval.approvedAt)) : "" }),
  ].filter(Boolean);

  return (
    <section aria-label={t("appr.title")} className="glass sheet mb-6 flex flex-col gap-3 p-4 md:px-5">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <span className="flex items-center gap-2.5">
          {locked && <Lock size={15} aria-hidden className="text-[var(--b-600)]" />}
          <span className="label">{t("appr.title")}</span>
          <StatusMark kind={MARK[approval.status]} label={t(`appr.status.${approval.status}`)} />
        </span>
        {who.length > 0 && <span className="text-[13px] text-[var(--ink-3)]">{who.join(" · ")}</span>}
        <div className="no-print flex flex-wrap items-center gap-2 xl:ml-auto">
          <input
            aria-label={t("appr.by")}
            placeholder={t("appr.by")}
            value={by}
            onChange={(e) => setBy(e.target.value)}
            className="field-input h-9 text-[13.5px]"
            style={{ width: "11rem" }}
          />
          {needsReason && (
            <input
              aria-label={t("appr.reason")}
              placeholder={t("appr.reason")}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="field-input h-9 text-[13.5px]"
              style={{ width: "14rem" }}
            />
          )}
          {actions.map((a) => {
            const Icon = ICON[a];
            return (
              <Button key={a} size="sm" variant={a === "approve" || a === "submit" ? "primary" : "quiet"} onClick={() => run(a)}>
                <Icon size={14} aria-hidden /> {t(`appr.action.${a}`)}
              </Button>
            );
          })}
          {approval.log.length > 0 && (
            <Button size="sm" variant="ghost" aria-expanded={showLog} onClick={() => setShowLog(!showLog)}>
              <History size={14} aria-hidden /> {t("appr.history", { n: approval.log.length })}
            </Button>
          )}
        </div>
      </div>
      {locked && <p className="text-[13px] text-[var(--ink-2)]">{t("appr.lockedNote")}</p>}
      {error && (
        <p role="alert" className="text-[13px] text-[var(--crit)]">
          {t(`appr.error.${error}`)}
        </p>
      )}
      {showLog && (
        <ol className="flex flex-col gap-1.5 border-t border-[var(--rule)] pt-3 text-[13px] text-[var(--ink-2)]">
          {[...approval.log].reverse().map((e, i) => (
            <li key={approval.log.length - i} className="flex flex-wrap gap-x-2">
              <span className="num text-[var(--ink-3)]">{fmt.date(localDay(e.at))}</span>
              <span>{t("appr.logLine", { by: e.by, from: t(`appr.status.${e.from}`), to: t(`appr.status.${e.to}`) })}</span>
              {e.reason && <span className="text-[var(--ink-3)]">— {e.reason}</span>}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
