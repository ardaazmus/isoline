import Link from "next/link";
import { FACT_TONE, factValue, metricLabel } from "@/platform/g4/format";
import { Badge, PageTitle, Section, StateBox, Table, Td } from "@/platform/ui";
import { attempt, dateTime, titled, tr } from "@/platform/server";
import { requireWorkspace } from "@/server/http/dal";
import { factLineage } from "@/server/calc/service";

export const generateMetadata = titled("pf.lineage.title");

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** DATA-20: lineage explorer — a fact back to its run, the accepted observation versions, evidence files and factors. */
export default async function LineagePage({ params }: PageProps<"/[lang]/app/facts/[factId]">) {
  const { lang, factId } = await params;
  const t = tr(lang);
  const ws = await requireWorkspace(lang);
  const r = UUID.test(factId) ? await attempt(() => factLineage(ws.actor, factId)) : ({ ok: false, status: 404, code: "not_found" } as const);
  if (!r.ok) return <StateBox state="empty" title={t("pf.lineage.notFound")} />;
  const { fact, run, history, observations, evidence, factors, issues } = r.data;
  return (
    <>
      <PageTitle
        title={metricLabel(t, fact.metric_key)}
        lead={
          <>
            <span className="tabular-nums text-[var(--ink)]">
              {fact.value_text ?? factValue(lang, fact.value_num, fact.unit)} {fact.unit === "ratio" ? "" : fact.unit}
            </span>{" "}
            · {fact.facility_name ?? t("pf.data.organisationLevel")} · r{fact.revision} · <Badge tone={FACT_TONE[fact.status]}>{t(`pf.calc.factStatus.${fact.status}`)}</Badge>
            {fact.suppressed && (
              <>
                {" "}
                <Badge tone="warn">{t("pf.calc.suppressed")}</Badge>
              </>
            )}
            {fact.approved_by_name && <span className="ml-2 text-[13px] text-[var(--ink-3)]">{t("pf.lineage.approvedBy", { name: fact.approved_by_name, at: dateTime(lang, fact.approved_at!) })}</span>}
          </>
        }
        actions={
          <Link href={`/${lang}/app/projects/${fact.project_id}/calculations/${run.id}`} className="text-[13.5px] text-[var(--b-700)]">
            {t("pf.lineage.openRun")}
          </Link>
        }
      />
      <ol className="flex flex-col gap-6" aria-label={t("pf.lineage.chain")}>
        <li>
          <Section title={t("pf.lineage.step.run")}>
            <dl className="grid gap-x-6 gap-y-2 text-[13px] md:grid-cols-3">
              <div>
                <dt className="text-[var(--ink-3)]">{t("pf.calc.kind")}</dt>
                <dd>
                  {t(`pf.calc.kinds.${run.kind}`)} · {run.boundary_kind ? `${t(`pf.scope.kind.${run.boundary_kind}`)} r${run.boundary_revision}` : t("pf.calc.financeNoBoundary")}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--ink-3)]">{t("pf.calc.performed")}</dt>
                <dd>
                  {run.performed_by_name} · {dateTime(lang, run.performed_at)}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--ink-3)]">{t("pf.calc.engine")}</dt>
                <dd className="font-mono text-[12px]">{run.engine_version}</dd>
              </div>
              <div className="md:col-span-3">
                <dt className="text-[var(--ink-3)]">{t("pf.calc.digest.output")}</dt>
                <dd className="break-all font-mono text-[11.5px]">{run.output_digest}</dd>
              </div>
            </dl>
            {issues.length > 0 && (
              <ul className="flex flex-wrap gap-1.5">
                {issues.map((i) => (
                  <li key={i.id}>
                    <Badge tone={i.status === "open" ? (i.severity === "blocker" ? "crit" : "warn") : "ok"}>
                      {t(`pf.calc.rule.${i.rule_id}`)} · {t(`pf.calc.issueStatus.${i.status}`)}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </li>
        <li>
          <Section title={t("pf.lineage.step.observations", { n: observations.length })}>
            <Table head={[t("pf.lineage.item"), t("pf.calc.facility"), t("pf.lineage.entered"), t("pf.lineage.canonical"), t("pf.lineage.people")]}>
              {observations.map((o) => (
                <tr key={o.id}>
                  <Td>
                    <Link href={`/${lang}/app/tasks/${o.request_id}`} className="font-medium text-[var(--b-700)]">
                      {t(`req.items.${o.metric_code}`)}
                    </Link>
                    <div className="text-[11.5px] text-[var(--ink-3)]">
                      v{o.revision} · {t(`pf.task.q.${o.quality}`)}
                      {o.source_ref ? ` · ${o.source_ref}` : ""}
                    </div>
                  </Td>
                  <Td className="text-[12.5px]">{o.facility_name ?? t("pf.data.organisationLevel")}</Td>
                  <Td className="tabular-nums text-[12.5px]">{o.value_num !== null ? `${factValue(lang, o.value_num, "")} ${o.unit_code ?? ""}` : Array.isArray(o.lines) ? (o.lines as { key: string; value: string; unit: string }[]).map((l) => `${l.key}: ${factValue(lang, l.value, "")} ${l.unit}`).join(" · ") : "—"}</Td>
                  <Td className="tabular-nums text-[12.5px]">{o.canonical_value !== null ? `${factValue(lang, o.canonical_value, "")} ${o.canonical_unit ?? ""}` : Array.isArray(o.lines) ? (o.lines as { key: string; canonical: string; canonicalUnit: string }[]).map((l) => `${factValue(lang, l.canonical, "")} ${l.canonicalUnit}`).join(" · ") : "—"}</Td>
                  <Td className="text-[12px]">
                    {t("pf.lineage.enteredBy", { name: o.entered_by_name ?? "—" })}
                    <br />
                    {t("pf.lineage.acceptedBy", { name: o.decided_by_name ?? "—" })}
                  </Td>
                </tr>
              ))}
            </Table>
          </Section>
        </li>
        <li>
          <Section title={t("pf.lineage.step.evidence", { n: evidence.length })}>
            {evidence.length === 0 ? (
              <p className="text-[13.5px] text-[var(--ink-3)]">{t("pf.lineage.noEvidence")}</p>
            ) : (
              <ul className="flex flex-col gap-1 text-[13.5px]">
                {evidence.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{e.filename}</span>
                    <span className="font-mono text-[11.5px] text-[var(--ink-3)]">sha256 {e.sha256.slice(0, 16)}…</span>
                    <Badge tone={e.scan_status === "available" ? "ok" : "warn"}>{t(`pf.evidence.status.${e.scan_status}`)}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </li>
        <li>
          <Section title={t("pf.lineage.step.factors", { n: factors.length })}>
            {factors.length === 0 ? (
              <p className="text-[13.5px] text-[var(--ink-3)]">{t("pf.lineage.noFactors")}</p>
            ) : (
              <Table head={[t("pf.calc.target"), t("pf.lineage.factor"), t("pf.lineage.source"), t("pf.factors.licence")]}>
                {factors.map((f) => (
                  <tr key={f.id}>
                    <Td className="font-mono text-[12px]">
                      {f.target} {f.chosen && <Badge tone="info">{t("pf.lineage.chosen")}</Badge>}
                    </Td>
                    <Td className="tabular-nums text-[12.5px]">
                      {f.label ?? f.key}: {Number(f.value)} {f.unit ?? ""}
                      {f.ncv !== null && <span className="text-[var(--ink-3)]"> · NCV {Number(f.ncv)}</span>}
                    </Td>
                    <Td className="text-[12.5px]">
                      {f.url ? (
                        <a href={f.url} target="_blank" rel="noreferrer" className="text-[var(--b-700)]">
                          {f.set_name}
                        </a>
                      ) : (
                        f.set_name
                      )}
                      <div className="text-[11.5px] text-[var(--ink-3)]">
                        {f.publisher}
                        {f.edition_year ? ` · ${f.edition_year}` : ""} · {f.code} · {f.content_sha256.slice(0, 12)}…
                      </div>
                    </Td>
                    <Td className="text-[12.5px]">{t(`pf.factors.licences.${f.licence}`)}</Td>
                  </tr>
                ))}
              </Table>
            )}
          </Section>
        </li>
        <li>
          <Section title={t("pf.lineage.step.history", { n: history.length })}>
            <ul className="flex flex-col gap-1 text-[13.5px]">
              {history.map((h) => (
                <li key={h.id} className="flex flex-wrap items-center gap-2">
                  {h.id === fact.id ? <span className="font-semibold">r{h.revision}</span> : <Link href={`/${lang}/app/facts/${h.id}`} className="text-[var(--b-700)]">r{h.revision}</Link>}
                  <span className="tabular-nums">
                    {h.value_text ?? factValue(lang, h.value_num, h.unit)} {h.unit === "ratio" ? "" : h.unit}
                  </span>
                  <Badge tone={FACT_TONE[h.status]}>{t(`pf.calc.factStatus.${h.status}`)}</Badge>
                  <span className="text-[12px] text-[var(--ink-3)]">{dateTime(lang, h.created_at)}</span>
                </li>
              ))}
            </ul>
          </Section>
        </li>
      </ol>
    </>
  );
}
