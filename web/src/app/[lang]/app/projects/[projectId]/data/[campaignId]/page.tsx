import { ImportPanel, ReminderForm, RequestTable, type Person, type Req } from "@/platform/g3/campaign";
import { loadProject, ProjectHeader } from "@/platform/project-shell";
import { Section, StateBox } from "@/platform/ui";
import { attempt, titled, tr } from "@/platform/server";
import { grantCan, memberCan } from "@/server/policy/policy";
import { listImports } from "@/server/data/imports";
import { ASSIGNEE_ROLES, listCampaigns, listRequests, REVIEWER_ROLES } from "@/server/data/service";
import { listParticipants } from "@/server/projects/service";

export const generateMetadata = titled("pf.data.title");

/** DATA-03 + DATA-06..08: one campaign — who supplies what for which facility, its progress, and file imports. */
export default async function CampaignPage({ params }: PageProps<"/[lang]/app/projects/[projectId]/data/[campaignId]">) {
  const { lang, projectId, campaignId } = await params;
  const t = tr(lang);
  const loaded = await loadProject(lang, projectId);
  if (!loaded.ok) return loaded.view;
  const { ws, data } = loaded.p;
  const campaign = (await listCampaigns(ws.actor, projectId)).find((c) => c.id === campaignId);
  const requests = campaign ? await attempt(() => listRequests(ws.actor, campaignId)) : null;
  if (!campaign || !requests?.ok)
    return (
      <>
        <ProjectHeader lang={lang} p={loaded.p} />
        <StateBox state="empty" title={t("pf.projects.notFound")} />
      </>
    );
  const role = ws.actor.role;
  const canManage = role !== null && memberCan(role, "data.request") && (data.access.via !== "grant" || grantCan(data.access.grantRole!, "data.request"));
  const [team, imports] = await Promise.all([listParticipants(ws.actor, projectId), canManage ? listImports(ws.actor, projectId) : Promise.resolve([])]);
  const today = new Date().toISOString().slice(0, 10);
  const rows = requests.data as unknown as Req[];
  const byFacility = new Map<string, { total: number; done: number }>();
  for (const r of rows) {
    const k = r.facility_name ?? t("pf.data.organisationLevel");
    const x = byFacility.get(k) ?? { total: 0, done: 0 };
    x.total++;
    if (["accepted", "not_applicable", "withdrawn"].includes(r.status)) x.done++;
    byFacility.set(k, x);
  }
  return (
    <>
      <ProjectHeader lang={lang} p={loaded.p} cycleId={campaign.cycle_id} />
      <div className="flex flex-col gap-6">
        <Section title={campaign.title}>
          <div className="grid gap-3 md:grid-cols-3">
            {[...byFacility.entries()].map(([name, x]) => (
              <div key={name} className="rounded-[12px] border border-[var(--rule)] bg-[var(--paper)] p-3">
                <p className="text-[13px] font-semibold">{name}</p>
                <p className="text-[12.5px] text-[var(--ink-2)]">{t("pf.data.doneOf", { done: x.done, total: x.total })}</p>
              </div>
            ))}
          </div>
          <RequestTable lang={lang} requests={rows} team={team.map((p) => ({ user_id: p.user_id, name: p.name, raci_role: p.raci_role })) as Person[]} assigneeRoles={ASSIGNEE_ROLES} reviewerRoles={REVIEWER_ROLES} canManage={canManage} today={today} />
          {!canManage && <p className="text-[12.5px] text-[var(--ink-3)]">{t("pf.data.onlyYours")}</p>}
        </Section>
        {canManage && (
          <Section title={t("pf.data.reminders")}>
            <ReminderForm campaignId={campaignId} status={campaign.status} policy={campaign.reminder_policy as unknown as { beforeDays: number[]; afterDays: number[]; criticalOnlyDays: number[] }} />
          </Section>
        )}
        {canManage && (
          <Section title={t("pf.data.importTitle")}>
            <ImportPanel campaignId={campaignId} lang={lang} imports={imports.filter((i) => i.campaign_id === campaignId)} />
          </Section>
        )}
      </div>
    </>
  );
}
