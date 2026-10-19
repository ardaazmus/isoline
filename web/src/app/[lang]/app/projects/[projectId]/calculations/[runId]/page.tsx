import Link from "next/link";
import { FactActions, IssueRow, RunActions, type IssueView } from "@/platform/g4/calc";
import { FACT_TONE, factValue, metricLabel } from "@/platform/g4/format";
import { loadProject, ProjectHeader } from "@/platform/project-shell";
import { Badge, Section, StateBox, Table, Td } from "@/platform/ui";
import { attempt, dateTime, titled, tr } from "@/platform/server";
import { grantCan, memberCan, type Action } from "@/server/policy/policy";
import { getRun } from "@/server/calc/service";

export const generateMetadata = titled("pf.calc.runPage");

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** DATA-18: one calculation run — digests, engine and rule versions, facts to approve, findings to disposition. */
export default async function RunPage({ params }: PageProps<"/[lang]/app/projects/[projectId]/calculations/[runId]">) {
  const { lang, projectId, runId } = await params;
  const t = tr(lang);
  const loaded = await loadProject(lang, projectId);
  if (!loaded.ok) return loaded.view;
  const { ws, data } = loaded.p;
  const r = UUID.test(runId) ? await attempt(() => getRun(ws.actor, runId)) : ({ ok: false, status: 404, code: "not_found" } as const);
  if (!r.ok || r.data.run.project_id !== projectId) return <StateBox state="empty" title={t("pf.calc.runNotFound")} />;
  const { run, facts, issues } = r.data;
  const can = (a: Action) => ws.actor.role !== null && memberCan(ws.actor.role, a) && (data.access.via !== "grant" || grantCan(data.access.grantRole!, a));
  const canReview = can("quality.review") && run.performed_by !== ws.actor.userId;
  const ready = facts.filter((f) => f.status === "ready_for_review").length;
  return (
    <>
      <ProjectHeader lang={lang} p={loaded.p} cycleId={run.cycle_id} />
      <div className="flex flex-col gap-6">
        <Section title={t("pf.calc.runHeading", { kind: t(`pf.calc.kinds.${run.kind}`) })} aside={<Link href={`/${lang}/app/projects/${projectId}/calculations?cycle=${run.cycle_id}`} className="text-[13px] text-[var(--b-700)]">{t("pf.calc.back")}</Link>}>
          <dl className="grid gap-x-6 gap-y-2 text-[13px] md:grid-cols-2">
            <div>
              <dt className="text-[var(--ink-3)]">{t("pf.calc.performed")}</dt>
              <dd>
                {run.performed_by_name} · {dateTime(lang, run.performed_at)}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--ink-3)]">{t("pf.calc.engine")}</dt>
              <dd className="font-mono text-[12px]">
                {run.engine_version} · {run.rule_version}
              </dd>
            </div>
            {(
              [
                ["input", run.input_digest],
                ["factor", run.factor_digest],
                ["output", run.output_digest],
              ] as const
            ).map(([k, v]) => (
              <div key={k}>
                <dt className="text-[var(--ink-3)]">{t(`pf.calc.digest.${k}`)}</dt>
                <dd className="break-all font-mono text-[11.5px]">{v}</dd>
              </div>
            ))}
          </dl>
          <RunActions runId={run.id} canReview={canReview} ready={ready} />
          {can("quality.review") && run.performed_by === ws.actor.userId && <p className="text-[12.5px] text-[var(--ink-3)]">{t("pf.calc.ownRunNote")}</p>}
        </Section>
        <Section title={t("pf.calc.issues", { n: issues.length })}>
          {issues.length === 0 ? (
            <p className="text-[13.5px] text-[var(--ink-3)]">{t("pf.calc.noIssues")}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {issues.map((i) => (
                <IssueRow key={i.id} issue={i as unknown as IssueView} canReview={canReview} lang={lang} />
              ))}
            </ul>
          )}
        </Section>
        <Section title={t("pf.calc.facts")}>
          <Table head={[t("pf.calc.metric"), t("pf.calc.facility"), t("pf.calc.valueCol"), t("pf.calc.status"), ""]}>
            {facts.map((f) => (
              <tr key={f.id}>
                <Td>
                  <Link href={`/${lang}/app/facts/${f.id}`} className="font-medium text-[var(--b-700)]">
                    {metricLabel(t, f.metric_key)}
                  </Link>
                  <div className="font-mono text-[11.5px] text-[var(--ink-3)]">r{f.revision}</div>
                </Td>
                <Td className="text-[12.5px]">{f.facility_name ?? t("pf.data.organisationLevel")}</Td>
                <Td className="tabular-nums">
                  {f.suppressed && <Badge tone="warn">{t("pf.calc.suppressed")}</Badge>} {f.value_text ?? factValue(lang, f.value_num, f.unit)} <span className="text-[12px] text-[var(--ink-3)]">{f.unit === "ratio" ? "" : f.unit}</span>
                </Td>
                <Td>
                  <Badge tone={FACT_TONE[f.status]}>{t(`pf.calc.factStatus.${f.status}`)}</Badge>
                  {f.approved_by_name && <div className="text-[11.5px] text-[var(--ink-3)]">{f.approved_by_name}</div>}
                </Td>
                <Td>{canReview && <FactActions factId={f.id} status={f.status} />}</Td>
              </tr>
            ))}
          </Table>
        </Section>
      </div>
    </>
  );
}
