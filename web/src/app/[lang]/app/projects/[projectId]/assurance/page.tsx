import Link from "next/link";
import { ActionButton } from "@/platform/g5/close";
import { AnswerForm, AskForm, EngagementForm, EngagementStatusForm } from "@/platform/g7/g7";
import { factValue, metricLabel } from "@/platform/g4/format";
import { loadProject, pickCycle, ProjectHeader } from "@/platform/project-shell";
import { Badge, Section, StateBox } from "@/platform/ui";
import { dateTime, titled, tr } from "@/platform/server";
import { grantCan, memberCan, type Action } from "@/server/policy/policy";
import { assuranceRoom } from "@/server/assurance/service";
import { listEvidence } from "@/server/evidence/service";
import { listCycles } from "@/server/projects/service";

export const generateMetadata = titled("pf.as.title");

/** CTRL-10/11: assurance room — the assurer reads the frozen facts and asks; the company answers with evidence. */
export default async function AssurancePage({ params, searchParams }: PageProps<"/[lang]/app/projects/[projectId]/assurance">) {
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
  const room = await assuranceRoom(ws.actor, cycle.id);
  const assurer = room.access.via === "grant" && room.access.grantRole === "assurance";
  const company = room.access.via !== "grant";
  const evidence = company && can("data.submit") ? (await listEvidence(ws.actor, projectId)).filter((e) => e.scan_status === "available").map((e) => ({ id: e.id, filename: e.filename })) : [];
  const label = (id: string | null) => {
    const f = room.facts.find((x) => x.id === id);
    return f ? metricLabel(t, f.metric_key) : id;
  };
  return (
    <>
      <ProjectHeader lang={lang} p={loaded.p} cycleId={cycle?.id} />
      <div className="flex flex-col gap-6">
        <Section title={t("pf.as.engagement", { label: cycle.label })}>
          {room.engagement ? (
            <div className="flex flex-col gap-2 text-[13.5px]">
              <p>
                {t(`pf.as.standards.${room.engagement.standard}`)} · {t(`pf.as.levels.${room.engagement.level}`)} · <Badge tone={room.engagement.status === "opinion_received" ? "ok" : "info"}>{t(`pf.as.statuses.${room.engagement.status}`)}</Badge>
              </p>
              <p className="text-[12.5px] text-[var(--ink-3)]">{t("pf.as.opinionNote")}</p>
              {company && can("cycle.close") && <EngagementStatusForm engagementId={room.engagement.id} current={room.engagement.status} evidence={evidence} />}
            </div>
          ) : company && can("cycle.close") ? (
            <EngagementForm cycleId={cycle.id} />
          ) : (
            <p className="text-[13px] text-[var(--ink-3)]">{t("pf.as.noEngagement")}</p>
          )}
        </Section>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <Section title={room.snapshot ? t("pf.as.snapshotFacts", { v: room.snapshot.version }) : t("pf.as.approvedFacts")}>
            {room.facts.length === 0 ? (
              <p className="text-[13px] text-[var(--ink-3)]">{t("pf.as.noFacts")}</p>
            ) : (
              <ul className="flex flex-col gap-1 text-[13px]">
                {room.facts.map((f) => (
                  <li key={f.id} className="flex flex-wrap gap-2">
                    <Link href={`/${lang}/app/facts/${f.id}`} className="text-[var(--b-700)]">
                      {metricLabel(t, f.metric_key)}
                    </Link>
                    <span className="tabular-nums">
                      {f.suppressed ? t("pf.calc.suppressed") : (f.value_text ?? factValue(lang, f.value_num, f.unit))} {f.unit === "ratio" ? "" : f.unit}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {assurer && can("assurance.query") && <AskForm cycleId={cycle.id} facts={room.facts.map((f) => ({ id: f.id, label: metricLabel(t, f.metric_key) }))} />}
          </Section>
          <Section title={t("pf.as.questions", { n: room.questions.length })}>
            {room.questions.length === 0 ? (
              <p className="text-[13px] text-[var(--ink-3)]">{t("pf.as.noQuestions")}</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {room.questions.map((q) => (
                  <li key={q.id} className="rounded-[12px] border border-[var(--rule)] bg-[var(--paper)] p-3 text-[13.5px]">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={q.status === "open" ? "warn" : q.status === "answered" ? "info" : "ok"}>{t(`pf.as.qStatus.${q.status}`)}</Badge>
                      <span className="text-[12px] text-[var(--ink-3)]">
                        {q.asked_by_name} · {dateTime(lang, q.asked_at)} · {q.target_type === "fact" ? label(q.target_id) : t(`pf.as.target.${q.target_type}`)}
                      </span>
                    </div>
                    <p className="mt-1">{q.question}</p>
                    {q.answer && (
                      <p className="mt-2 border-l-2 border-[var(--b-300)] pl-2 text-[13px] text-[var(--ink-2)]">
                        {q.answer} <span className="text-[12px] text-[var(--ink-3)]">— {q.answered_by_name}{q.answer_evidence_ids.length ? ` · ${t("pf.as.files", { n: q.answer_evidence_ids.length })}` : ""}</span>
                      </p>
                    )}
                    {q.status !== "closed" && company && can("data.submit") && <AnswerForm questionId={q.id} evidence={evidence} />}
                    {q.status === "answered" && assurer && q.asked_by === ws.actor.userId && (
                      <div className="mt-2">
                        <ActionButton path={`/api/v1/assurance-questions/${q.id}/close`} label={t("pf.as.close")} />
                      </div>
                    )}
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
