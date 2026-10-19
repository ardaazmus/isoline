import Link from "next/link";
import { Badge, OkNote, PageTitle, Section, StateBox, Table, Td } from "@/platform/ui";
import { dateOnly, titled, tr } from "@/platform/server";
import { byUrgency, inboxItems } from "@/platform/inbox-items";
import { InboxRows } from "@/platform/inbox-list";
import { requireWorkspace } from "@/server/http/dal";
import { listProjects, listStewardedClients } from "@/server/tenancy/service";
import { myInbox } from "@/server/inbox/service";
import { latestCycles, type ProjectCycle } from "@/server/cycle/progress";
import { STEP_PAGES } from "@/server/cycle/steps";
import { memberCan } from "@/server/policy/policy";

export const generateMetadata = titled("pf.today.title");

const SHOWN = 8;

/**
 * "Bugün" (UX review 19.10.2026): what waits for this person first, then — for anyone who follows cycles — every
 * project's current step with what the record says and the step's due date. A consultant sees the same table as
 * "Clients". People who only enter their own values see only their work. No counters of shares or grants: those
 * live under Organisation → Sharing.
 */
export default async function TodayPage({ params, searchParams }: PageProps<"/[lang]/app/home">) {
  const { lang } = await params;
  const sp = await searchParams;
  const t = tr(lang);
  const ws = await requireWorkspace(lang);
  const role = ws.actor.role;
  const advisory = ws.tenant.kind === "advisory";
  const followsCycles = role !== null && role !== "contributor";
  const [box, projects, cycles, clients] = await Promise.all([
    myInbox(ws.actor),
    followsCycles ? listProjects(ws.actor) : Promise.resolve([]),
    followsCycles ? latestCycles(ws.actor) : Promise.resolve(new Map<string, ProjectCycle>()),
    advisory ? listStewardedClients(ws.actor) : Promise.resolve([]),
  ]);
  const items = byUrgency(inboxItems(lang, box));
  const canCreate = role !== null && memberCan(role, "project.create");

  return (
    <>
      <PageTitle title={t("pf.today.title")} lead={t("pf.today.lead", { name: ws.tenant.tenantName, role: t(`pf.role.${ws.tenant.role}`) })} />
      {sp.client === "created" && (
        <div className="mb-4">
          <OkNote>{t("pf.clients.created")}</OkNote>
        </div>
      )}
      <div className="flex flex-col gap-6">
        <Section
          title={t("pf.today.waiting")}
          aside={
            items.length > SHOWN ? (
              <Link href={`/${lang}/app/tasks`} className="text-[13px] font-medium text-[var(--b-700)]">
                {t("pf.today.allWork", { n: items.length })}
              </Link>
            ) : undefined
          }
        >
          {items.length === 0 ? <p className="text-[13.5px] text-[var(--ink-3)]">{t("pf.today.waitingNone")}</p> : <InboxRows lang={lang} items={followsCycles ? items.slice(0, SHOWN) : items} />}
        </Section>

        {followsCycles && (
          <Section
            title={advisory ? t("pf.today.clients") : t("pf.today.cycles")}
            aside={
              <span className="flex gap-4">
                {advisory && (
                  <Link href={`/${lang}/app/portfolio`} className="text-[13px] font-medium text-[var(--b-700)]">
                    {t("pf.today.portfolioLink")}
                  </Link>
                )}
                {canCreate && (
                  <Link href={`/${lang}/app/projects/new`} className="text-[13px] font-medium text-[var(--b-700)]">
                    {t("pf.today.newProject")}
                  </Link>
                )}
              </span>
            }
          >
            {advisory && <p className="mb-3 text-[12.5px] text-[var(--ink-3)]">{t("pf.today.clientsLead")}</p>}
            {projects.length === 0 ? (
              <StateBox state="empty" title={t("pf.today.noProjects")} />
            ) : (
              <Table head={[advisory ? t("pf.today.col.owner") : t("pf.today.col.project"), advisory ? t("pf.today.col.project") : t("pf.today.col.step"), advisory ? t("pf.today.col.step") : t("pf.today.col.detail"), advisory ? t("pf.today.col.detail") : t("pf.today.col.due"), ...(advisory ? [t("pf.today.col.due")] : [])]}>
                {projects.map((p) => {
                  const c = cycles.get(p.id);
                  const step = c && c.progress.current !== "complete" ? c.progress.steps.find((s) => s.id === c.progress.current) : null;
                  const href = `/${lang}/app/projects/${p.id}`;
                  const stepCell = !c ? (
                    <span className="text-[var(--ink-3)]">{t("pf.today.noCycle")}</span>
                  ) : step ? (
                    <Link href={`${href}/${STEP_PAGES[step.id][0]}`} className="font-medium text-[var(--b-700)]">
                      {t(`pf.steps.name.${step.id}`)}
                    </Link>
                  ) : (
                    <Badge tone="ok">{t("pf.steps.complete")}</Badge>
                  );
                  const detail = step ? (
                    <span className="text-[12.5px]">
                      <span className="font-medium">{t(`pf.steps.state.${step.state}`)}</span> · {t(`pf.steps.summary.${step.id}.${step.summary}`, step.vars)}
                    </span>
                  ) : (
                    "—"
                  );
                  const due = step?.dueOn ? <span className={step.late ? "font-semibold text-[var(--crit)]" : undefined}>{dateOnly(lang, step.dueOn)}{step.late ? ` · ${t("pf.steps.late")}` : ""}</span> : "—";
                  const name = (
                    <Link href={href} className="font-medium text-[var(--b-700)]">
                      {p.name}
                    </Link>
                  );
                  return advisory ? (
                    <tr key={p.id}>
                      <Td>
                        {p.owner_name} {p.owner_lifecycle === "provisional" && <Badge tone="warn">{t("pf.lifecycle.provisional")}</Badge>}
                      </Td>
                      <Td>{name}</Td>
                      <Td>{stepCell}</Td>
                      <Td>{detail}</Td>
                      <Td className="whitespace-nowrap text-[12.5px]">{due}</Td>
                    </tr>
                  ) : (
                    <tr key={p.id}>
                      <Td>{name}</Td>
                      <Td>{stepCell}</Td>
                      <Td>{detail}</Td>
                      <Td className="whitespace-nowrap text-[12.5px]">{due}</Td>
                    </tr>
                  );
                })}
              </Table>
            )}
          </Section>
        )}

        {advisory && clients.length > 0 && (
          <Section title={t("pf.home.provisionalClients")} aside={<Link href={`/${lang}/app/portfolio/clients/new`} className="text-[13px] font-medium text-[var(--b-700)]">{t("pf.nav.clientsNew")}</Link>}>
            <ul className="flex flex-col divide-y divide-[var(--rule)]">
              {clients.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-3 py-2.5 text-[14px]">
                  <span className="flex-1 font-medium">{c.name}</span>
                  <Badge tone="warn">{t("pf.home.awaitingClaim")}</Badge>
                  <span className="text-[12.5px] text-[var(--ink-3)]">{dateOnly(lang, c.created_at)}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>
    </>
  );
}
