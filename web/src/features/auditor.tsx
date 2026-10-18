"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/i18n/provider";
import { PageHeader } from "@/components/shell";
import { SourceNote } from "@/components/figure";
import { Button, Callout, StatusMark, TextField } from "@/components/ui";
import { Hydrated } from "./common";
import { useActiveClient, useWorkspace } from "@/store/workspace";
import { approvalOf, SECTION_IDS } from "@/lib/approval";
import { reconcile } from "@/lib/reconcile";
import { DATA_POINTS, generateRequests, suggestTemplates } from "@/lib/requests";
import { evaluate } from "@/lib/calc/applicability";
import { TEMPLATES } from "@/data/templates";
import { buildVaultManifest } from "@/lib/evidence-vault";
import { addEvidenceRequest, addNote, answerNote, openAuditCounts, setEvidenceRequestStatus, setNoteStatus, type AuditNoteStatus } from "@/lib/auditor";
import { localDay } from "@/lib/dates";

export function AuditorPage() {
  return (
    <Hydrated>
      <Inner />
    </Hydrated>
  );
}

function Inner() {
  const { t } = useI18n();
  const client = useActiveClient();
  const update = useWorkspace((s) => s.update);
  const now = () => new Date().toISOString();

  const suggestions = useMemo(() => suggestTemplates(evaluate(client.profile), client.profile).map((s) => s.template), [client.profile]);
  const chosen = useMemo(
    () => (client.requests.templates ?? suggestions).filter((id) => TEMPLATES.some((tp) => tp.id === id)),
    [client.requests.templates, suggestions],
  );
  const items = useMemo(() => generateRequests(client, chosen), [client, chosen]);
  const vault = useMemo(() => buildVaultManifest(client, items, "local"), [client, items]);
  const rec = useMemo(() => reconcile(client), [client]);
  const counts = openAuditCounts(client.audit ?? { notes: [], requests: [] });

  const [target, setTarget] = useState<string>("ghg");
  const [author, setAuthor] = useState("");
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [reqTarget, setReqTarget] = useState<string>("ghg_electricity");
  const [reqNote, setReqNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const audit = client.audit ?? { notes: [], requests: [] };

  const submitNote = () => {
    const isItem = DATA_POINTS.some((d) => d.id === target);
    const r = addNote(audit, { targetType: isItem ? "item" : "section", targetId: target, author, body, at: now() });
    if ("error" in r) return setError(t(`audit.err_${r.error}`));
    setError(null);
    setBody("");
    update("audit", r.next);
  };

  const submitReply = (id: string) => {
    const r = answerNote(audit, id, { by: author || t("audit.auditorFallback"), body: replyBody, at: now() });
    if ("error" in r) return setError(t(`audit.err_${r.error}`));
    setError(null);
    setReplyTo(null);
    setReplyBody("");
    update("audit", r.next);
  };

  const submitRequest = () => {
    const r = addEvidenceRequest(audit, { targetId: reqTarget, requestedBy: author || t("audit.auditorFallback"), note: reqNote, at: now() });
    if ("error" in r) return setError(t(`audit.err_${r.error}`));
    setError(null);
    setReqNote("");
    update("audit", r.next);
  };

  const targetOptions = [...SECTION_IDS.map((s) => ({ id: s, label: `${t(`nav.${s}`)} (${t("audit.targetSection")})` })), ...DATA_POINTS.map((d) => ({ id: d.id, label: `${t(`req.items.${d.id}`)} (${t("audit.targetItem")})` }))];

  return (
    <div data-family="reporting">
      <PageHeader title={t("nav.auditor")} result={t("audit.result", { notes: counts.notes, requests: counts.requests })} />
      <Callout tone="note">{t("audit.readonly")}</Callout>
      {error && <Callout tone="crit">{error}</Callout>}

      <div className="grid gap-12 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-8">
          <section className="glass sheet flex flex-col gap-3 p-5">
            <h2 className="text-[16px] font-semibold">{t("audit.vault")}</h2>
            <p className="text-[13.5px] text-[var(--ink-3)]">{t("audit.vaultHint")}</p>
            <div className="overflow-x-auto">
              <table className="report-table text-[13px]">
                <thead>
                  <tr>
                    <th>{t("audit.file")}</th>
                    <th>SHA-256</th>
                    <th>{t("audit.tools")}</th>
                    <th className="num">{t("audit.rows")}</th>
                  </tr>
                </thead>
                <tbody>
                  {vault.records.map((r) => (
                    <tr key={r.sha256}>
                      <td>{r.fileName}</td>
                      <td className="num" title={r.sha256}>
                        {r.sha256.slice(0, 12)}…
                      </td>
                      <td>{r.tools.join(", ")}</td>
                      <td className="num">{r.rows}</td>
                    </tr>
                  ))}
                  {!vault.records.length && (
                    <tr>
                      <td colSpan={4}>{t("audit.noEvidence")}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {!!vault.missing.length && <p className="text-[13px] text-[var(--crit)]">{t("audit.missing", { n: vault.missing.length, items: vault.missing.map((m) => m.itemId).slice(0, 5).join(", ") })}</p>}
            <SourceNote compact meta={{ sources: ["tr_ets_reg", "kgk_scope_2026"] }} />
          </section>

          <section className="glass sheet flex flex-col gap-3 p-5">
            <h2 className="text-[16px] font-semibold">{t("audit.notes")}</h2>
            <div className="grid gap-2 md:grid-cols-[220px_minmax(0,1fr)]">
              <label className="flex flex-col gap-1 text-[13px]">
                {t("audit.target")}
                <select value={target} onChange={(e) => setTarget(e.target.value)} className="rounded-[10px] border border-[var(--rule)] bg-white px-2 py-2">
                  {targetOptions.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <TextField label={t("audit.author")} value={author} onChange={setAuthor} />
            </div>
            <TextField label={t("audit.body")} value={body} onChange={setBody} hint={t("audit.bodyHint")} />
            <Button variant="primary" size="sm" className="self-start" onClick={submitNote}>
              {t("audit.addNote")}
            </Button>
            <ul className="flex flex-col gap-3">
              {audit.notes.map((n) => (
                <li key={n.id} className="rounded-[12px] border border-[var(--rule)] p-3">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-[var(--ink-3)]">
                    <strong className="text-[var(--ink)]">{n.targetId}</strong>
                    <StatusMark kind={n.status === "open" ? "review" : "verified"} label={t(`audit.noteStatus.${n.status}`)} />
                    <span>
                      {n.author} · {n.createdAt.slice(0, 10)}
                    </span>
                  </div>
                  <p className="mt-1 text-[14px]">{n.body}</p>
                  {n.reply && (
                    <p className="mt-2 border-l-2 border-[var(--b-600)] pl-3 text-[13.5px] text-[var(--ink-2)]">
                      {n.repliedBy}: {n.reply}
                    </p>
                  )}
                  {replyTo === n.id ? (
                    <div className="mt-2 flex flex-col gap-2">
                      <TextField label={t("audit.reply")} value={replyBody} onChange={setReplyBody} />
                      <div className="flex gap-2">
                        <Button variant="primary" size="sm" onClick={() => submitReply(n.id)}>
                          {t("audit.sendReply")}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setReplyTo(null)}>
                          {t("clients.cancel")}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button variant="quiet" size="sm" onClick={() => setReplyTo(n.id)}>
                        {t("audit.reply")}
                      </Button>
                      {(["closed", "open"] as AuditNoteStatus[]).map((s) =>
                        s !== n.status ? (
                          <Button
                            key={s}
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const r = setNoteStatus(audit, n.id, s);
                              if ("next" in r) update("audit", r.next);
                            }}
                          >
                            {t(`audit.mark_${s}`)}
                          </Button>
                        ) : null,
                      )}
                    </div>
                  )}
                </li>
              ))}
              {!audit.notes.length && <li className="text-[13.5px] text-[var(--ink-3)]">{t("audit.noNotes")}</li>}
            </ul>
          </section>

          <section className="glass sheet flex flex-col gap-3 p-5">
            <h2 className="text-[16px] font-semibold">{t("audit.evidenceRequests")}</h2>
            <div className="grid gap-2 md:grid-cols-[220px_minmax(0,1fr)]">
              <label className="flex flex-col gap-1 text-[13px]">
                {t("audit.target")}
                <select value={reqTarget} onChange={(e) => setReqTarget(e.target.value)} className="rounded-[10px] border border-[var(--rule)] bg-white px-2 py-2">
                  {targetOptions.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <TextField label={t("audit.body")} value={reqNote} onChange={setReqNote} />
            </div>
            <Button variant="primary" size="sm" className="self-start" onClick={submitRequest}>
              {t("audit.addRequest")}
            </Button>
            <ul className="flex flex-col gap-2">
              {audit.requests.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[12px] border border-[var(--rule)] p-3 text-[13.5px]">
                  <strong>{r.targetId}</strong>
                  <StatusMark kind={r.status === "open" ? "review" : "verified"} label={t(`audit.reqStatus.${r.status}`)} />
                  <span className="text-[var(--ink-3)]">
                    {r.requestedBy} · {r.requestedAt.slice(0, 10)}
                    {r.note ? ` — ${r.note}` : ""}
                  </span>
                  <span className="ml-auto flex gap-2">
                    {r.status === "open" ? (
                      <>
                        <Button
                          variant="quiet"
                          size="sm"
                          onClick={() => {
                            const x = setEvidenceRequestStatus(audit, r.id, "fulfilled");
                            if ("next" in x) update("audit", x.next);
                          }}
                        >
                          {t("audit.mark_fulfilled")}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const x = setEvidenceRequestStatus(audit, r.id, "waived");
                            if ("next" in x) update("audit", x.next);
                          }}
                        >
                          {t("audit.mark_waived")}
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const x = setEvidenceRequestStatus(audit, r.id, "open");
                          if ("next" in x) update("audit", x.next);
                        }}
                      >
                        {t("audit.reopen")}
                      </Button>
                    )}
                  </span>
                </li>
              ))}
              {!audit.requests.length && <li className="text-[13.5px] text-[var(--ink-3)]">{t("audit.noRequests")}</li>}
            </ul>
          </section>
        </div>

        <aside className="flex flex-col gap-6">
          <section className="glass flex flex-col gap-2 p-5">
            <h2 className="text-[14px] font-semibold">{t("appr.overview")}</h2>
            <ul className="flex flex-col text-[13px]">
              {SECTION_IDS.map((s) => {
                const a = approvalOf(client.approvals, s);
                return (
                  <li key={s} className="flex items-baseline justify-between gap-2 border-b border-[var(--rule)] py-1.5 last:border-b-0">
                    <span>{t(`nav.${s}`)}</span>
                    <StatusMark kind={a.status === "draft" ? "estimated" : a.status === "review" ? "review" : "verified"} label={t(`appr.status.${a.status}`)} />
                  </li>
                );
              })}
            </ul>
          </section>
          <section className="glass flex flex-col gap-2 p-5">
            <h2 className="text-[14px] font-semibold">{t("nav.reconciliation")}</h2>
            <ul className="flex flex-col text-[13px]">
              {rec.rules.map((r) => (
                <li key={r.id} className="flex items-baseline justify-between gap-2 border-b border-[var(--rule)] py-1.5 last:border-b-0">
                  <span className="num font-semibold">{r.id}</span>
                  <span className="text-[var(--ink-3)]">{r.status}</span>
                </li>
              ))}
            </ul>
            <p className="text-[12px] text-[var(--ink-3)]">
              {t("audit.cutoff", { date: client.profile.reportingYear, at: localDay(now()) })}
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
