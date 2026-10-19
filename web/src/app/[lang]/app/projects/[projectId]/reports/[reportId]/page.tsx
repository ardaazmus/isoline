import Link from "next/link";
import { CopyToken, SectionEditor, SectionReview, StageActions } from "@/platform/g6/report";
import { loadProject, ProjectHeader } from "@/platform/project-shell";
import { Badge, Section, StateBox } from "@/platform/ui";
import { attempt, dateTime, titled, tr } from "@/platform/server";
import { grantCan, memberCan, type Action } from "@/server/policy/policy";
import { getReport } from "@/server/reports/service";

export const generateMetadata = titled("pf.rep.studio");

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TONE: Record<string, "neutral" | "ok" | "warn" | "crit" | "info"> = { empty: "neutral", draft: "warn", submitted: "info", approved: "ok" };

/** REP-02..06: outline on the left, the section text in the middle, metrics and checks on the right; the chain on top. */
export default async function ReportStudio({ params, searchParams }: PageProps<"/[lang]/app/projects/[projectId]/reports/[reportId]">) {
  const { lang, projectId, reportId } = await params;
  const sp = await searchParams;
  const t = tr(lang);
  const loaded = await loadProject(lang, projectId);
  if (!loaded.ok) return loaded.view;
  const { ws, data } = loaded.p;
  const r = UUID.test(reportId) ? await attempt(() => getReport(ws.actor, reportId)) : ({ ok: false, status: 404, code: "not_found" } as const);
  if (!r.ok || r.data.report.project_id !== projectId) return <StateBox state="empty" title={t("pf.rep.notFound")} />;
  const rep = r.data;
  const can = (a: Action) => ws.actor.role !== null && memberCan(ws.actor.role, a) && (data.access.via !== "grant" || grantCan(data.access.grantRole!, a));
  const member = data.access.via !== "grant";
  const selected = rep.sections.find((s) => s.id === sp.section) ?? rep.sections[0];
  const stale = rep.sections.flatMap((s) => s.references.filter((x) => x.stale).map((x) => ({ section: s.title, token: x.token })));
  const stage = rep.report.status;
  const canDecide = stage === "tech_review" ? can("report.review") : stage === "customer_review" ? member && can("report.review") : stage === "management_signoff" ? member && can("report.release") : false;
  const base = `/${lang}/app/projects/${projectId}/reports/${reportId}`;
  return (
    <>
      <ProjectHeader lang={lang} p={loaded.p} cycleId={rep.report.cycle_id} />
      <div className="flex flex-col gap-6">
        <Section title={rep.report.title} aside={<Badge tone={stage === "released" ? "ok" : "warn"}>{t(`pf.rep.status.${stage}`)}</Badge>}>
          <ol className="flex flex-wrap gap-2 text-[12.5px]" aria-label={t("pf.rep.chain")}>
            {["drafting", "tech_review", "customer_review", "management_signoff", "released"].map((s, i) => (
              <li key={s} className={`rounded-full border px-2.5 py-0.5 ${s === stage ? "border-[var(--b-600)] font-semibold text-[var(--b-700)]" : "border-[var(--rule)] text-[var(--ink-3)]"}`}>
                {i + 1}. {t(`pf.rep.status.${s}`)}
              </li>
            ))}
          </ol>
          <p className="text-[12.5px] text-[var(--ink-3)]">
            {t("pf.rep.coverageLine", { met: rep.coverage.met, partial: rep.coverage.partial, pending: rep.coverage.pending, total: rep.coverage.total })} · {rep.cycle.label} · {t(`pf.close.cycleStatus.${rep.cycle.status}`)} · <span className="font-mono">{t("pf.rep.candidate", { sha: rep.candidate.slice(0, 12) })}</span>
          </p>
          <StageActions reportId={reportId} status={stage} canRequest={can("report.write")} canDecide={canDecide} canRelease={member && can("report.release")} released={rep.releases.length > 0} />
          {stale.length > 0 && (
            <p className="rounded-[10px] border border-[color-mix(in_srgb,var(--warn)_45%,transparent)] px-3 py-2 text-[13px]">
              {t("pf.rep.staleWarn", { n: stale.length })} {stale.map((s) => `${s.section}: ${s.token}`).join(" · ")}
            </p>
          )}
          {rep.claims.length > 0 && (
            <ul className="flex flex-col gap-1 text-[12.5px]">
              {rep.claims.flatMap((c) =>
                c.hits.map((h, i) => (
                  <li key={`${c.section}-${i}`}>
                    <Badge tone={h.rule === "offset" || h.rule === "future" ? "crit" : "warn"}>{t(`pf.rep.claim.${h.rule}`)}</Badge> “{h.text}” — {rep.sections.find((s) => s.key === c.section)?.title}
                  </li>
                )),
              )}
            </ul>
          )}
        </Section>

        <div className="grid gap-6 xl:grid-cols-[260px_minmax(0,1fr)_300px]">
          <Section title={t("pf.rep.outline")}>
            <ol className="flex flex-col gap-1">
              {rep.sections.map((s, i) => (
                <li key={s.id}>
                  <Link href={`${base}?section=${s.id}`} aria-current={s.id === selected?.id ? "true" : undefined} className={`flex items-start justify-between gap-2 rounded-[10px] px-2 py-1.5 text-[13px] ${s.id === selected?.id ? "bg-[var(--b-50)] font-semibold" : "hover:bg-[var(--b-50)]"}`}>
                    <span>
                      {i + 1}. {s.title}
                    </span>
                    <Badge tone={TONE[s.status]}>{t(`pf.rep.sectionStatus.${s.status}`)}</Badge>
                  </Link>
                </li>
              ))}
            </ol>
          </Section>

          {selected && (
            <Section title={selected.title} aside={selected.version ? <span className="text-[12px] text-[var(--ink-3)]">{t("pf.rep.versionN", { v: selected.version })}</span> : undefined}>
              <p className="text-[12px] text-[var(--ink-3)]">{selected.refs.join(" · ")}</p>
              {selected.authorName && (
                <p className="text-[12.5px] text-[var(--ink-2)]">
                  {t("pf.rep.author", { name: selected.authorName })}
                  {selected.reviewerName ? ` · ${t("pf.rep.reviewer", { name: selected.reviewerName })}` : ""}
                </p>
              )}
              <SectionEditor key={selected.versionId ?? selected.id} sectionId={selected.id} body={selected.body} version={selected.version} canWrite={can("report.write")} canSubmit={selected.status === "draft"} />
              {selected.status === "submitted" && can("report.review") && selected.authorId !== ws.actor.userId && <SectionReview sectionId={selected.id} />}
            </Section>
          )}

          <Section title={t("pf.rep.metrics")}>
            {selected && selected.references.length > 0 && (
              <div>
                <h3 className="mb-1 text-[12.5px] font-semibold uppercase tracking-[0.05em] text-[var(--ink-3)]">{t("pf.rep.bound")}</h3>
                <ul className="flex flex-col gap-1 text-[12.5px]">
                  {selected.references.map((x) => (
                    <li key={x.token}>
                      <span className="font-mono">{x.token}</span> → {x.factId ? <Link href={`/${lang}/app/facts/${x.factId}`} className="text-[var(--b-700)]">{x.rendered}</Link> : <Badge tone="crit">{t("pf.rep.unbound")}</Badge>} {x.stale && <Badge tone="warn">{t("pf.rep.stale")}</Badge>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div>
              <h3 className="mb-1 text-[12.5px] font-semibold uppercase tracking-[0.05em] text-[var(--ink-3)]">{t("pf.rep.available")}</h3>
              {rep.available.length === 0 ? (
                <p className="text-[12.5px] text-[var(--ink-3)]">{t("pf.rep.noFacts")}</p>
              ) : (
                <ul className="flex max-h-[420px] flex-col gap-1 overflow-y-auto text-[12.5px]">
                  {rep.available.map((a) => (
                    <li key={a.token} className="flex flex-col">
                      <CopyToken token={a.token} />
                      <span className="pl-1.5 text-[var(--ink-2)]">
                        {a.value} <span className="text-[11px] text-[var(--ink-3)]">({t(`pf.calc.factStatus.${a.status}`)})</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Section>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Section title={t("pf.rep.approvals")}>
            {rep.approvals.length === 0 ? (
              <p className="text-[13px] text-[var(--ink-3)]">—</p>
            ) : (
              <ul className="flex flex-col gap-1.5 text-[13px]">
                {rep.approvals.map((a) => (
                  <li key={a.id}>
                    <Badge tone={a.decision === "approved" ? "ok" : "warn"}>{t(`pf.rep.stage.${a.stage}`)}</Badge> {a.user_name} · {dateTime(lang, a.decided_at)} <span className="font-mono text-[11px] text-[var(--ink-3)]">{a.candidate_sha256.slice(0, 10)}</span>
                    {a.comment && <span className="block text-[12.5px] text-[var(--ink-2)]">{a.comment}</span>}
                  </li>
                ))}
              </ul>
            )}
          </Section>
          <Section title={t("pf.rep.releases")}>
            {rep.releases.length === 0 ? (
              <p className="text-[13px] text-[var(--ink-3)]">{t("pf.rep.noReleases")}</p>
            ) : (
              <ul className="flex flex-col gap-1.5 text-[13px]">
                {rep.releases.map((x) => (
                  <li key={x.id}>
                    <Link href={`/${lang}/app/releases/${x.id}`} className="font-medium text-[var(--b-700)]">
                      {t("pf.rep.versionN", { v: x.version })}
                    </Link>{" "}
                    <Badge tone={x.status === "released" ? "ok" : "neutral"}>{t(`pf.rep.releaseStatus.${x.status}`)}</Badge> {x.released_by_name} · {dateTime(lang, x.released_at)} <span className="font-mono text-[11px] text-[var(--ink-3)]">{x.manifest_sha256.slice(0, 12)}</span>
                    {x.amendment_reason && <span className="block text-[12.5px] text-[var(--ink-2)]">{t("pf.rep.amendmentOf", { reason: x.amendment_reason })}</span>}
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>
    </>
  );
}
