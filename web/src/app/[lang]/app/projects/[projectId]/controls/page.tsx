import { projectCycles } from "@/platform/cached";
import Link from "next/link";
import { IssueRow, type IssueView } from "@/platform/g4/calc";
import { RunButton } from "@/platform/g5/close";
import { loadProject, pickCycle, ProjectHeader } from "@/platform/project-shell";
import { Badge, Section, StateBox, Table, Td } from "@/platform/ui";
import { dateTime, titled, tr } from "@/platform/server";
import { grantCan, memberCan, type Action } from "@/server/policy/policy";
import { listIssues } from "@/server/calc/service";
import { latestReconciliation } from "@/server/close/service";
import { numberFormat } from "@/lib/intl";

export const generateMetadata = titled("pf.controls.title");

type Check = { code: string; rule: string; severity: string; status: string; target: string; a?: number; b?: number; diff?: number; tolerance?: number; note?: string };

/** CTRL-04/05: cross-checks (U1–U10) and every quality finding of the cycle with its disposition. */
export default async function ControlsPage({ params, searchParams }: PageProps<"/[lang]/app/projects/[projectId]/controls">) {
  const { lang, projectId } = await params;
  const sp = await searchParams;
  const t = tr(lang);
  const loaded = await loadProject(lang, projectId);
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
  const [rec, issues] = await Promise.all([latestReconciliation(ws.actor, cycle.id), listIssues(ws.actor, cycle.id, "all")]);
  const checks = ((rec.reconciliation?.result as { checks?: Check[] } | undefined)?.checks ?? []) as Check[];
  const frozen = ["frozen", "released"].includes(cycle.status);
  const open = issues.filter((i) => i.status === "open");
  const done = issues.filter((i) => i.status !== "open");
  const num = (v: number | undefined) => (v === undefined ? "—" : numberFormat(lang, { maximumFractionDigits: 2 }).format(v));
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
        <Section title={t("pf.controls.recTitle", { label: cycle.label })} aside={rec.reconciliation && <span className="text-[12.5px] text-[var(--ink-3)]">{t("pf.controls.lastRun", { name: rec.reconciliation.performed_by_name ?? "—", at: dateTime(lang, rec.reconciliation.performed_at) })}</span>}>
          <p className="text-[13px] leading-relaxed text-[var(--ink-2)]">{t("pf.controls.recLead")}</p>
          {can("calc.run") && !frozen && <RunButton path={`/api/v1/cycles/${cycle.id}/reconciliation`} label={t("pf.controls.run")} />}
          {checks.length === 0 ? (
            <p className="text-[13.5px] text-[var(--ink-3)]">{t("pf.controls.notRun")}</p>
          ) : (
            <Table head={[t("pf.controls.rule"), t("pf.controls.check"), t("pf.calc.status"), t("pf.controls.values"), t("pf.controls.tolerance")]}>
              {checks.map((c, i) => (
                <tr key={`${c.code}-${i}`}>
                  <Td className="font-mono text-[12px]">{c.rule}</Td>
                  <Td>
                    {t(`pf.calc.rule.${c.code}`)}
                    {c.target.startsWith("facility:") && <div className="text-[11.5px] text-[var(--ink-3)]">{c.target}</div>}
                    {c.note && <div className="text-[11.5px] text-[var(--ink-3)]">{t(`pf.controls.note.${c.note}`)}</div>}
                  </Td>
                  <Td>
                    <Badge tone={c.status === "pass" ? "ok" : c.status === "na" ? "neutral" : c.severity === "blocker" ? "crit" : "warn"}>{t(`pf.controls.status.${c.status}`)}</Badge>
                  </Td>
                  <Td className="tabular-nums text-[12.5px]">{c.a !== undefined ? `${num(c.a)} / ${num(c.b)}` : "—"}</Td>
                  <Td className="tabular-nums text-[12.5px]">{c.tolerance !== undefined ? `%${num(c.tolerance * 100)}` : "—"}</Td>
                </tr>
              ))}
            </Table>
          )}
        </Section>
        <Section title={t("pf.controls.openIssues", { n: open.length })}>
          {open.length === 0 ? (
            <p className="text-[13.5px] text-[var(--ink-3)]">{t("pf.calc.noIssues")}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {open.map((i) => (
                <IssueRow key={i.id} issue={i as unknown as IssueView} canReview={can("quality.review") && i.detected_by !== ws.actor.userId && !frozen} lang={lang} />
              ))}
            </ul>
          )}
        </Section>
        <Section title={t("pf.controls.doneIssues", { n: done.length })}>
          {done.length === 0 ? (
            <p className="text-[13.5px] text-[var(--ink-3)]">—</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {done.map((i) => (
                <IssueRow key={i.id} issue={i as unknown as IssueView} canReview={false} lang={lang} />
              ))}
            </ul>
          )}
        </Section>
      </div>
    </>
  );
}
