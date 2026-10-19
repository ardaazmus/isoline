import { projectCycles } from "@/platform/cached";
import Link from "next/link";
import { ActionButton, EliminationForm, EntityFinancialForm, RunButton } from "@/platform/g5/close";
import { factValue, metricLabel } from "@/platform/g4/format";
import { loadProject, pickCycle, ProjectHeader } from "@/platform/project-shell";
import { Badge, Section, StateBox, Table, Td } from "@/platform/ui";
import { titled, tr } from "@/platform/server";
import { grantCan, memberCan, type Action } from "@/server/policy/policy";
import { consolidationInputs, ghgByBoundary, latestReconciliation } from "@/server/close/service";
import { numberFormat } from "@/lib/intl";

export const generateMetadata = titled("pf.cons.title");

const GHG_ROWS = ["ghg.scope1", "ghg.scope2.location", "ghg.scope2.market", "ghg.scope3", "ghg.total.location", "ghg.total.market"];
const APPROACHES = ["ghg_operational_control", "ghg_financial_control", "ghg_equity_share"];

/** CTRL-08: GHG results per boundary approach side by side, and the IFRS 10 revenue consolidation — kept apart. */
export default async function ConsolidationPage({ params, searchParams }: PageProps<"/[lang]/app/projects/[projectId]/consolidation">) {
  const { lang, projectId } = await params;
  const sp = await searchParams;
  const t = tr(lang);
  const loaded = await loadProject(lang, projectId, sp.cycle);
  if (!loaded.ok) return loaded.view;
  const { ws, data } = loaded.p;
  const cycles = await projectCycles(ws.actor, projectId);
  const cycle = pickCycle(cycles, sp.cycle);
  if (!cycle)
    return (
      <>
        <ProjectHeader lang={lang} p={loaded.p} />
        <StateBox state="empty" title={t("pf.cycle.none")} />
      </>
    );
  const can = (a: Action) => ws.actor.role !== null && memberCan(ws.actor.role, a) && (data.access.via !== "grant" || grantCan(data.access.grantRole!, a));
  const [ghg, fin, runs] = await Promise.all([ghgByBoundary(ws.actor, cycle.id), consolidationInputs(ws.actor, cycle.id), latestReconciliation(ws.actor, cycle.id)]);
  const approaches = APPROACHES.filter((a) => ghg.boundaries.some((b) => b.kind === a));
  const value = (k: string, b: string) => ghg.facts.find((f) => f.metric_key === k && f.facility_id === null && f.boundary_kind === b);
  const result = runs.consolidation?.result as { grossRevenue: string; eliminations: string; consolidatedRevenue: string; equityMethod: string[]; warnings: { code: string; target: string; severity: string }[] } | undefined;
  const entityName = (id: string) => fin.entities.find((e) => e.id === id)?.name ?? id;
  const frozen = ["frozen", "released"].includes(cycle.status);
  return (
    <>
      <ProjectHeader lang={lang} p={loaded.p} cycleId={cycle?.id} />
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
        <Section title={t("pf.cons.ghgTitle", { label: cycle.label })}>
          <p className="text-[13px] leading-relaxed text-[var(--ink-2)]">{t("pf.cons.ghgLead")}</p>
          {approaches.length === 0 ? (
            <StateBox state="empty" title={t("pf.cons.noGhg")} />
          ) : (
            <Table head={[t("pf.calc.metric"), ...approaches.map((a) => t(`pf.scope.kind.${a}`))]}>
              {GHG_ROWS.filter((k) => approaches.some((a) => value(k, a))).map((k) => (
                <tr key={k}>
                  <Td>{metricLabel(t, k)}</Td>
                  {approaches.map((a) => {
                    const f = value(k, a);
                    return (
                      <Td key={a} className="tabular-nums">
                        {f ? (
                          <Link href={`/${lang}/app/facts/${f.id}`} className="text-[var(--b-700)]">
                            {factValue(lang, f.value_num, f.unit)} {f.unit}
                          </Link>
                        ) : (
                          <span className="text-[var(--ink-3)]">{t("pf.cons.notCalculated")}</span>
                        )}
                      </Td>
                    );
                  })}
                </tr>
              ))}
            </Table>
          )}
          {ghg.members.length > 0 && (
            <details className="text-[13px]">
              <summary className="cursor-pointer font-medium text-[var(--b-700)]">{t("pf.cons.shares")}</summary>
              <Table head={[t("pf.calc.facility"), ...approaches.map((a) => t(`pf.scope.kind.${a}`))]}>
                {[...new Set(ghg.members.map((m) => m.facility_id))].map((fid) => (
                  <tr key={fid}>
                    <Td>{ghg.members.find((m) => m.facility_id === fid)?.name}</Td>
                    {approaches.map((a) => {
                      const b = ghg.boundaries.find((x) => x.kind === a);
                      const m = ghg.members.find((x) => x.boundary_id === b?.id && x.facility_id === fid);
                      return (
                        <Td key={a} className="tabular-nums">
                          {m ? `%${numberFormat(lang, { maximumFractionDigits: 2 }).format(Number(m.inclusion_pct))}` : "—"} {m?.reason === "time_weighted" && <Badge tone="info">{t("pf.scope.reason.time_weighted")}</Badge>}
                        </Td>
                      );
                    })}
                  </tr>
                ))}
              </Table>
            </details>
          )}
        </Section>

        <Section title={t("pf.cons.finTitle")}>
          <p className="text-[13px] leading-relaxed text-[var(--ink-2)]">{t("pf.cons.finLead")}</p>
          {!fin.boundary ? (
            <StateBox state="empty" title={t("pf.cons.noFinBoundary")} />
          ) : (
            <>
              <Table head={[t("pf.cons.entity"), t("pf.cons.share"), t("pf.cons.treatment")]}>
                {fin.members.map((m) => (
                  <tr key={m.legal_entity_id}>
                    <Td>{m.name}</Td>
                    <Td className="tabular-nums">%{numberFormat(lang, { maximumFractionDigits: 2 }).format(Number(m.inclusion_pct))}</Td>
                    <Td className="text-[12.5px]">{t(Number(m.inclusion_pct) > 0 ? "pf.cons.fullConsolidation" : "pf.cons.outside")} · {t(`pf.scope.reason.${m.reason}`)}</Td>
                  </tr>
                ))}
              </Table>
              <h3 className="text-[14px] font-semibold">{t("pf.cons.financials")}</h3>
              <Table head={[t("pf.cons.entity"), t("pf.cons.netSales"), t("pf.calc.status"), t("pf.lineage.people"), ""]} empty={fin.financials.length === 0 ? <p className="p-2 text-[13px] text-[var(--ink-3)]">{t("pf.cons.noFinancials")}</p> : undefined}>
                {fin.financials.map((f) => (
                  <tr key={f.id}>
                    <Td>{f.entity_name}</Td>
                    <Td className="tabular-nums">
                      {factValue(lang, f.net_sales, "")} {f.currency}
                    </Td>
                    <Td>
                      <Badge tone={f.status === "approved" ? "ok" : "warn"}>{t(`pf.cons.status.${f.status}`)}</Badge>
                    </Td>
                    <Td className="text-[12px]">
                      {f.entered_by_name}
                      {f.approved_by_name ? ` → ${f.approved_by_name}` : ""}
                    </Td>
                    <Td>{f.status === "submitted" && f.entered_by !== ws.actor.userId && can("data.review") && !frozen && <ActionButton path={`/api/v1/entity-financials/${f.id}/approve`} label={t("pf.calc.approve")} />}</Td>
                  </tr>
                ))}
              </Table>
              {can("data.submit") && !frozen && <EntityFinancialForm cycleId={cycle.id} entities={fin.members.filter((m) => Number(m.inclusion_pct) > 0).map((m) => ({ id: m.legal_entity_id!, name: m.name }))} />}
              <h3 className="text-[14px] font-semibold">{t("pf.cons.eliminations")}</h3>
              <Table head={[t("pf.cons.seller"), t("pf.cons.buyer"), t("pf.cons.amount"), t("pf.cons.description"), t("pf.calc.status"), ""]} empty={fin.eliminations.length === 0 ? <p className="p-2 text-[13px] text-[var(--ink-3)]">{t("pf.cons.noEliminations")}</p> : undefined}>
                {fin.eliminations.map((e) => (
                  <tr key={e.id}>
                    <Td>{e.seller_name}</Td>
                    <Td>{e.buyer_name}</Td>
                    <Td className="tabular-nums">{factValue(lang, e.amount, "")} TRY</Td>
                    <Td className="text-[12.5px]">{e.description}</Td>
                    <Td>
                      <Badge tone={e.status === "approved" ? "ok" : "warn"}>{t(`pf.cons.status.${e.status}`)}</Badge>
                    </Td>
                    <Td>
                      {e.status === "submitted" && !frozen && (
                        <span className="flex gap-2">
                          {e.entered_by !== ws.actor.userId && can("data.review") && <ActionButton path={`/api/v1/eliminations/${e.id}/approve`} label={t("pf.calc.approve")} />}
                          {can("data.request") && <ActionButton path={`/api/v1/eliminations/${e.id}/withdraw`} label={t("pf.cons.withdraw")} variant="ghost" />}
                        </span>
                      )}
                    </Td>
                  </tr>
                ))}
              </Table>
              {can("data.submit") && !frozen && fin.members.length > 1 && <EliminationForm cycleId={cycle.id} entities={fin.members.map((m) => ({ id: m.legal_entity_id!, name: m.name }))} />}
              {can("calc.run") && !frozen && <RunButton path={`/api/v1/cycles/${cycle.id}/consolidation/run`} label={t("pf.cons.run")} />}
              {result && (
                <dl className="grid gap-x-6 gap-y-2 rounded-[12px] border border-[var(--rule)] bg-[var(--paper)] p-4 text-[13.5px] md:grid-cols-3">
                  <div>
                    <dt className="text-[var(--ink-3)]">{t("pf.cons.gross")}</dt>
                    <dd className="tabular-nums">{factValue(lang, result.grossRevenue, "")} TRY</dd>
                  </div>
                  <div>
                    <dt className="text-[var(--ink-3)]">{t("pf.cons.eliminated")}</dt>
                    <dd className="tabular-nums">− {factValue(lang, result.eliminations, "")} TRY</dd>
                  </div>
                  <div>
                    <dt className="text-[var(--ink-3)]">{t("pf.cons.consolidated")}</dt>
                    <dd className="font-semibold tabular-nums">{factValue(lang, result.consolidatedRevenue, "")} TRY</dd>
                  </div>
                  {result.equityMethod.length > 0 && <div className="text-[12.5px] text-[var(--ink-2)] md:col-span-3">{t("pf.cons.equityMethodNote", { names: result.equityMethod.map(entityName).join(", ") })}</div>}
                  {result.warnings.length > 0 && (
                    <ul className="flex flex-wrap gap-1.5 md:col-span-3">
                      {result.warnings.map((w, i) => (
                        <li key={i}>
                          <Badge tone={w.severity === "blocker" ? "crit" : "warn"}>
                            {t(`pf.calc.rule.${w.code}`)} · {entityName(w.target)}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </dl>
              )}
            </>
          )}
        </Section>
      </div>
    </>
  );
}
