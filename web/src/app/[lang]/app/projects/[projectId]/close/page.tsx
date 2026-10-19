import { projectCycles } from "@/platform/cached";
import Link from "next/link";
import { CheckCircle2, Circle, XCircle } from "lucide-react";
import { FreezeButton, ReopenForm } from "@/platform/g5/close";
import { loadProject, pickCycle, ProjectHeader } from "@/platform/project-shell";
import { Badge, Section, StateBox } from "@/platform/ui";
import { dateTime, titled, tr } from "@/platform/server";
import { grantCan, memberCan, type Action } from "@/server/policy/policy";
import { closeChecklist } from "@/server/close/service";

export const generateMetadata = titled("pf.close.title");

/** CTRL-09: what blocks the close and why; freeze into a snapshot; reopen with a reason; the snapshot history. */
export default async function ClosePage({ params, searchParams }: PageProps<"/[lang]/app/projects/[projectId]/close">) {
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
  const c = await closeChecklist(ws.actor, cycle.id);
  const frozen = c.cycle.status === "frozen";
  return (
    <>
      <ProjectHeader lang={lang} p={loaded.p} cycleId={cycle?.id} />
      <div className="flex flex-col gap-6">
        {cycles.length > 1 && (
          <nav aria-label={t("pf.calc.cycles")} className="flex flex-wrap gap-2 text-[13px]">
            {cycles.map((x) => (
              <Link key={x.id} href={`?cycle=${x.id}`} aria-current={x.id === cycle.id ? "page" : undefined} className={x.id === cycle.id ? "font-semibold text-[var(--ink)]" : "text-[var(--b-700)]"}>
                {x.label}
              </Link>
            ))}
          </nav>
        )}
        <Section title={t("pf.close.checklist", { label: c.cycle.label })} aside={<Badge tone={frozen ? "info" : c.cycle.status === "reopened" ? "warn" : "neutral"}>{t(`pf.close.cycleStatus.${c.cycle.status}`)}</Badge>}>
          <ul className="flex flex-col gap-2">
            {c.items.map((i) => (
              <li key={i.id} className="flex items-start gap-2.5 text-[13.5px]">
                {i.ok ? <CheckCircle2 size={17} aria-hidden className="mt-[1px] shrink-0 text-[var(--ok)]" /> : i.required ? <XCircle size={17} aria-hidden className="mt-[1px] shrink-0 text-[var(--crit)]" /> : <Circle size={17} aria-hidden className="mt-[1px] shrink-0 text-[var(--ink-3)]" />}
                <span>
                  <span className="font-medium">{t(`pf.close.item.${i.id}`)}</span> <span className="sr-only">{i.ok ? t("pf.close.ok") : t("pf.close.notOk")}</span>
                  {!i.ok && <span className="block text-[12.5px] text-[var(--ink-2)]">{t(`pf.close.why.${i.id}`, { n: i.count ?? 0 })}</span>}
                  {!i.required && <span className="block text-[12px] text-[var(--ink-3)]">{t("pf.close.optional")}</span>}
                </span>
              </li>
            ))}
          </ul>
          {can("cycle.close") && !frozen && <FreezeButton cycleId={cycle.id} disabled={!c.canFreeze} />}
          {can("cycle.close") && frozen && (
            <div className="rounded-[12px] border border-[var(--rule)] bg-[var(--paper)] p-4">
              <p className="mb-2 text-[13px] text-[var(--ink-2)]">{t("pf.close.reopenLead")}</p>
              <ReopenForm cycleId={cycle.id} />
            </div>
          )}
        </Section>
        <Section title={t("pf.close.snapshots", { n: c.snapshots.length })}>
          {c.snapshots.length === 0 ? (
            <p className="text-[13.5px] text-[var(--ink-3)]">{t("pf.close.noSnapshots")}</p>
          ) : (
            <ul className="flex flex-col gap-2 text-[13.5px]">
              {c.snapshots.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-2">
                  <Link href={`/${lang}/app/projects/${projectId}/close/${s.id}`} className="font-medium text-[var(--b-700)]">
                    {t("pf.close.version", { v: s.version })}
                  </Link>
                  <Badge tone={s.status === "frozen" ? "info" : "neutral"}>{t(`pf.close.snapStatus.${s.status}`)}</Badge>
                  <span className="text-[12.5px] text-[var(--ink-2)]">
                    {s.frozen_by_name} · {dateTime(lang, s.frozen_at)} · {t("pf.close.factsN", { n: s.facts })}
                  </span>
                  <span className="font-mono text-[11.5px] text-[var(--ink-3)]">sha256 {s.content_sha256.slice(0, 16)}…</span>
                  {Array.isArray(s.restated) && (s.restated as unknown[]).length > 0 && <Badge tone="warn">{t("pf.close.restatedN", { n: (s.restated as unknown[]).length })}</Badge>}
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section title={t("pf.close.events")}>
          {c.events.length === 0 ? (
            <p className="text-[13.5px] text-[var(--ink-3)]">—</p>
          ) : (
            <ul className="flex flex-col gap-1.5 text-[13.5px]">
              {c.events.map((e) => (
                <li key={e.id}>
                  <span className="font-medium">{t(`pf.close.event.${e.action}`)}</span> — {e.actor_name} · {dateTime(lang, e.created_at)}
                  {e.reason && <span className="block text-[12.5px] text-[var(--ink-2)]">{e.reason}</span>}
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </>
  );
}
