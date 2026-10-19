import { Download } from "lucide-react";
import { ProofDecision, ProofUpload } from "@/platform/g6/report";
import { Badge, PageTitle, Section, StateBox, Table, Td } from "@/platform/ui";
import { attempt, dateTime, titled, tr } from "@/platform/server";
import { requireWorkspace } from "@/server/http/dal";
import { memberCan } from "@/server/policy/policy";
import { releaseAssets } from "@/server/reports/service";

export const generateMetadata = titled("pf.rep.releasePage");

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** REP-08..10: an immutable release — manifest, assets with SHA-256, the hand-off bundle and the design proofs. */
export default async function ReleasePage({ params }: PageProps<"/[lang]/app/releases/[releaseId]">) {
  const { lang, releaseId } = await params;
  const t = tr(lang);
  const ws = await requireWorkspace(lang);
  const r = UUID.test(releaseId) ? await attempt(() => releaseAssets(ws.actor, releaseId)) : ({ ok: false, status: 404, code: "not_found" } as const);
  if (!r.ok) return <StateBox state="empty" title={t("pf.rep.releaseNotFound")} />;
  const { release, assets, proofs } = r.data;
  const m = release.manifest as { report: string; period: { label: string }; snapshot: { version: number; sha256: string }; facts: unknown[]; sections: unknown[]; amendmentOf: string | null; amendmentReason: string | null };
  const designer = ws.tenant.kind !== "company" && ws.actor.role !== null && memberCan(ws.actor.role, "design.handoff");
  const reviewer = ws.actor.role !== null && memberCan(ws.actor.role, "report.review") && ws.tenant.kind === "company";
  return (
    <>
      <PageTitle title={m.report} lead={`${m.period.label} · ${t("pf.rep.versionN", { v: release.version })} · ${dateTime(lang, release.released_at)}`} actions={<Badge tone={release.status === "released" ? "ok" : "neutral"}>{t(`pf.rep.releaseStatus.${release.status}`)}</Badge>} />
      <div className="flex flex-col gap-6">
        <Section title={t("pf.rep.manifest")}>
          <dl className="grid gap-x-6 gap-y-2 text-[13px] md:grid-cols-2">
            <div>
              <dt className="text-[var(--ink-3)]">{t("pf.rep.manifestSha")}</dt>
              <dd className="break-all font-mono text-[11.5px]">{release.manifest_sha256}</dd>
            </div>
            <div>
              <dt className="text-[var(--ink-3)]">{t("pf.rep.snapshot")}</dt>
              <dd className="font-mono text-[11.5px]">
                v{m.snapshot.version} · {m.snapshot.sha256.slice(0, 16)}…
              </dd>
            </div>
            <div>
              <dt className="text-[var(--ink-3)]">{t("pf.rep.contents")}</dt>
              <dd>{t("pf.rep.contentsLine", { s: m.sections.length, f: m.facts.length, a: assets.length })}</dd>
            </div>
            {m.amendmentReason && (
              <div>
                <dt className="text-[var(--ink-3)]">{t("pf.rep.amendmentReason")}</dt>
                <dd>{m.amendmentReason}</dd>
              </div>
            )}
          </dl>
        </Section>
        <Section title={t("pf.rep.assets", { n: assets.length })}>
          <Table head={[t("pf.rep.path"), t("pf.rep.size"), "SHA-256", ""]}>
            {assets.map((a) => (
              <tr key={a.id}>
                <Td className="font-mono text-[12.5px]">{a.path}</Td>
                <Td className="tabular-nums text-[12.5px]">{new Intl.NumberFormat(lang).format(Math.ceil(Number(a.size_bytes) / 1024))} KB</Td>
                <Td className="font-mono text-[11px] text-[var(--ink-3)]">{a.sha256.slice(0, 16)}…</Td>
                <Td>
                  <a href={`/api/v1/release-assets/${a.id}/download`} className="inline-flex items-center gap-1 text-[13px] text-[var(--b-700)]">
                    <Download size={14} aria-hidden /> {t("pf.rep.download")}
                  </a>
                </Td>
              </tr>
            ))}
          </Table>
        </Section>
        <Section title={t("pf.rep.proofs", { n: proofs.length })}>
          {designer && <ProofUpload releaseId={release.id} />}
          {proofs.length === 0 ? (
            <p className="text-[13px] text-[var(--ink-3)]">{t("pf.rep.noProofs")}</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {proofs.map((p) => (
                <li key={p.id} className="rounded-[12px] border border-[var(--rule)] bg-[var(--paper)] p-3 text-[13px]">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">
                      {t("pf.rep.proofN", { v: p.version })} · {p.filename}
                    </span>
                    <Badge tone={p.status === "approved" ? "ok" : p.status === "submitted" ? "info" : "warn"}>{t(`pf.rep.proofStatus.${p.status}`)}</Badge>
                    <span className="text-[12px] text-[var(--ink-3)]">
                      {p.uploaded_by_name} · {dateTime(lang, p.uploaded_at)}
                    </span>
                  </div>
                  {p.decision_note && <p className="mt-1 text-[12.5px] text-[var(--ink-2)]">{p.decision_note}</p>}
                  {p.status === "submitted" && reviewer && (
                    <div className="mt-2">
                      <ProofDecision proofId={p.id} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </>
  );
}
