import Link from "next/link";
import { FactorChoiceForm, IssueRow, RunPanel, type IssueView } from "@/platform/g4/calc";
import { FACT_TONE, factValue, metricLabel, shortDigest } from "@/platform/g4/format";
import { loadProject, pickCycle, ProjectHeader } from "@/platform/project-shell";
import { Badge, Section, StateBox, Table, Td } from "@/platform/ui";
import { dateTime, titled, tr } from "@/platform/server";
import { grantCan, memberCan, type Action } from "@/server/policy/policy";
import { listChoices, listFactorSets } from "@/server/calc/factors";
import { listFacts, listIssues, listRuns } from "@/server/calc/service";
import { listBoundaries, listCycles } from "@/server/projects/service";
import { FlowSankey } from "@/platform/g8/visual";
import { ghgFlows, sankey } from "@/lib/visual/layout";
import { ghgFlowData } from "@/server/visual/service";

export const generateMetadata = titled("pf.calc.title");

const COMMON_TARGETS = ["grid:transmission", "grid:distribution", "fuel:natural_gas", "fuel:diesel", "fuel:gasoline", "fuel:lpg", "fuel:fuel_oil", "fuel:coal", "fuel:lignite", "scope3:ghg_transport", "scope3:ghg_travel"];

/** DATA-17/18: calculations of a cycle — run, current facts, quality findings, runs with digests, factor choices. */
export default async function CalculationsPage({ params, searchParams }: PageProps<"/[lang]/app/projects/[projectId]/calculations">) {
  const { lang, projectId } = await params;
  const sp = await searchParams;
  const t = tr(lang);
  const loaded = await loadProject(lang, projectId);
  if (!loaded.ok) return loaded.view;
  const { ws, data } = loaded.p;
  const cycles = await listCycles(ws.actor, projectId);
  const cycle = pickCycle(cycles, sp.cycle);
  if (!cycle)
    return (
      <>
        <ProjectHeader lang={lang} p={loaded.p} />
        <StateBox state="empty" title={t("pf.cycle.none")} />
      </>
    );
  const can = (a: Action) => ws.actor.role !== null && memberCan(ws.actor.role, a) && (data.access.via !== "grant" || grantCan(data.access.grantRole!, a));
  const [facts, issues, runs, choices, boundaries, sets] = await Promise.all([listFacts(ws.actor, cycle.id), listIssues(ws.actor, cycle.id), listRuns(ws.actor, projectId, cycle.id), listChoices(ws.actor, projectId), listBoundaries(ws.actor, cycle.id), can("calc.run") ? listFactorSets(ws.actor) : Promise.resolve([])]);
  const approved = [...new Set(boundaries.filter((b) => b.status === "approved").map((b) => b.kind))];
  // newest revision per key; group-level first
  const seen = new Set<string>();
  const current = facts.filter((f) => {
    const k = `${f.metric_key}|${f.facility_id ?? ""}|${f.boundary_kind ?? ""}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const group = current.filter((f) => f.facility_id === null);
  // G8-05: the flow of this cycle's GHG facts (one unit, conserved at every node)
  const flowData = await ghgFlowData(ws.actor, cycle.id);
  const flows = ghgFlows({ ...flowData, labels: { scope1: t("pf.calc.m.ghg_scope1"), scope2: t("pf.calc.m.ghg_scope2_location"), scope3: t("pf.calc.m.ghg_scope3"), total: t("pf.vis.total"), org: t("pf.data.organisationLevel") } });
  const flow = flows.some((f) => f.value > 0) ? sankey(flows) : null;
  const fmtT = (v: number) => `${new Intl.NumberFormat(lang, { maximumFractionDigits: v >= 1000 ? 0 : 2 }).format(v)} tCO₂e`;
  const byFacility = current.filter((f) => f.facility_id !== null);
  return (
    <>
      <ProjectHeader lang={lang} p={loaded.p} />
      <div className="flex flex-col gap-6">
        {cycles.length > 1 && (
          <nav aria-label={t("pf.calc.cycles")} className="flex flex-wrap gap-2 text-[13px]">
            {cycles.map((c) => (
              <Link key={c.id} href={`?cycle=${c.id}`} aria-current={c.id === cycle.id ? "page" : undefined} className={c.id === cycle.id ? "font-semibold text-[var(--ink)]" : "text-[var(--b-700)]"}>
                {c.label}
              </Link>
            ))}
          </nav>
        )}
        {can("calc.run") && (
          <Section title={t("pf.calc.runTitle", { label: cycle.label })}>
            <RunPanel cycleId={cycle.id} approved={approved} />
          </Section>
        )}
        <Section title={t("pf.calc.facts")} aside={<span className="text-[12.5px] text-[var(--ink-3)]">{t("pf.calc.factsLead")}</span>}>
          <Table
            head={[t("pf.calc.metric"), t("pf.calc.boundaryShort"), t("pf.calc.valueCol"), t("pf.calc.status"), t("pf.calc.estimated")]}
            empty={group.length === 0 ? <StateBox state="empty" title={t("pf.calc.noFacts")}>{t("pf.calc.noFactsLead")}</StateBox> : undefined}
          >
            {group.map((f) => (
              <tr key={f.id}>
                <Td>
                  <Link href={`/${lang}/app/facts/${f.id}`} className="font-medium text-[var(--b-700)]">
                    {metricLabel(t, f.metric_key)}
                  </Link>
                  <div className="font-mono text-[11.5px] text-[var(--ink-3)]">
                    {f.metric_key} · r{f.revision}
                  </div>
                </Td>
                <Td className="text-[12.5px] text-[var(--ink-2)]">{f.boundary_kind ? t(`pf.scope.kind.${f.boundary_kind}`) : "—"}</Td>
                <Td className="tabular-nums">
                  {f.suppressed ? <Badge tone="warn">{t("pf.calc.suppressed")}</Badge> : f.value_text ?? factValue(lang, f.value_num, f.unit)} <span className="text-[12px] text-[var(--ink-3)]">{f.unit === "ratio" ? "" : f.unit}</span>
                </Td>
                <Td>
                  <Badge tone={FACT_TONE[f.status]}>{t(`pf.calc.factStatus.${f.status}`)}</Badge>
                </Td>
                <Td className="tabular-nums text-[12.5px]">{f.estimated_share === null ? "—" : factValue(lang, f.estimated_share, "ratio")}</Td>
              </tr>
            ))}
          </Table>
          {byFacility.length > 0 && (
            <details className="text-[13.5px]">
              <summary className="cursor-pointer font-medium text-[var(--b-700)]">{t("pf.calc.byFacility", { n: byFacility.length })}</summary>
              <ul className="mt-2 flex flex-col gap-1">
                {byFacility.map((f) => (
                  <li key={f.id} className="flex flex-wrap gap-2">
                    <Link href={`/${lang}/app/facts/${f.id}`} className="text-[var(--b-700)]">
                      {f.facility_name} — {metricLabel(t, f.metric_key)}
                    </Link>
                    <span className="tabular-nums">
                      {f.value_text ?? factValue(lang, f.value_num, f.unit)} {f.unit === "ratio" ? "" : f.unit}
                    </span>
                    <Badge tone={FACT_TONE[f.status]}>{t(`pf.calc.factStatus.${f.status}`)}</Badge>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </Section>
        {flow && (
          <Section title={t("pf.vis.flowTitle")}>
            <p className="text-[12.5px] text-[var(--ink-3)]">{t("pf.vis.flowLead")}</p>
            <FlowSankey nodes={flow.nodes} links={flow.links} width={760} height={360} title={t("pf.vis.flowTitle")} format={fmtT} />
            <details className="text-[13px]">
              <summary className="cursor-pointer font-medium text-[var(--b-700)]">{t("pf.vis.flowTable")}</summary>
              <Table head={[t("pf.vis.from"), t("pf.vis.to"), "tCO₂e"]}>
                {flows
                  .filter((f) => f.value > 0)
                  .map((f, i) => (
                    <tr key={i}>
                      <Td>{f.source}</Td>
                      <Td>{f.target}</Td>
                      <Td className="tabular-nums">{fmtT(f.value)}</Td>
                    </tr>
                  ))}
              </Table>
            </details>
          </Section>
        )}
        <Section title={t("pf.calc.issues", { n: issues.length })}>
          {issues.length === 0 ? (
            <p className="text-[13.5px] text-[var(--ink-3)]">{t("pf.calc.noIssues")}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {issues.map((i) => (
                <IssueRow key={i.id} issue={i as unknown as IssueView} canReview={can("quality.review")} lang={lang} />
              ))}
            </ul>
          )}
        </Section>
        <Section title={t("pf.calc.runs")}>
          <Table head={[t("pf.calc.kind"), t("pf.calc.performed"), t("pf.calc.digests"), t("pf.calc.factsCol"), t("pf.calc.openCol")]} empty={runs.length === 0 ? <p className="p-2 text-[13px] text-[var(--ink-3)]">{t("pf.calc.noRuns")}</p> : undefined}>
            {runs.map((r) => (
              <tr key={r.id}>
                <Td>
                  <Link href={`/${lang}/app/projects/${projectId}/calculations/${r.id}`} className="font-medium text-[var(--b-700)]">
                    {t(`pf.calc.kinds.${r.kind}`)}
                  </Link>
                  {r.mode === "preview" && <Badge>{t("pf.calc.preview")}</Badge>}
                </Td>
                <Td className="text-[12.5px]">
                  {r.performed_by_name} · {dateTime(lang, r.performed_at)}
                </Td>
                <Td className="font-mono text-[11.5px] text-[var(--ink-3)]">
                  in {shortDigest(r.input_digest)} · f {shortDigest(r.factor_digest)} · out {shortDigest(r.output_digest)}
                </Td>
                <Td className="tabular-nums">{r.facts}</Td>
                <Td>
                  {r.open_blockers > 0 && <Badge tone="crit">{t("pf.calc.blockersN", { n: r.open_blockers })}</Badge>} {r.open_warnings > 0 && <Badge tone="warn">{t("pf.calc.warningsN", { n: r.open_warnings })}</Badge>}
                  {r.open_blockers === 0 && r.open_warnings === 0 && <span className="text-[12.5px] text-[var(--ink-3)]">—</span>}
                </Td>
              </tr>
            ))}
          </Table>
        </Section>
        <Section title={t("pf.calc.choices")} aside={<Link href={`/${lang}/app/factors`} className="text-[13px] text-[var(--b-700)]">{t("pf.calc.library")}</Link>}>
          <p className="text-[13px] leading-relaxed text-[var(--ink-2)]">{t("pf.calc.choicesLead")}</p>
          {choices.length > 0 && (
            <ul className="flex flex-col gap-1 text-[13.5px]">
              {choices.map((c) => (
                <li key={c.id}>
                  <span className="font-mono text-[12.5px]">{c.target}</span> → {c.set_name} {c.edition_year ? `(${c.edition_year})` : ""} · {c.key} = {Number(c.value)} {c.unit ?? ""} <span className="text-[12px] text-[var(--ink-3)]">— {c.chosen_by_name}{c.reason ? `: ${c.reason}` : ""}</span>
                </li>
              ))}
            </ul>
          )}
          {can("calc.run") && <FactorChoiceForm projectId={projectId} sets={sets.filter((s) => s.status === "active").map((s) => ({ id: s.id, code: s.code, name: s.name, edition_year: s.edition_year, licence: s.licence }))} targets={COMMON_TARGETS} />}
        </Section>
      </div>
    </>
  );
}
