import { RevokeButton } from "@/platform/forms";
import { AddParticipantForm, type Candidate } from "@/platform/g2/team";
import { loadProject, ProjectHeader } from "@/platform/project-shell";
import { Badge, Section, Table, Td } from "@/platform/ui";
import { attempt, titled, tr } from "@/platform/server";
import { grantCan, memberCan } from "@/server/policy/policy";
import { listParticipants, participantCandidates } from "@/server/projects/service";
import { counterpartNames } from "@/server/tenancy/service";

export const generateMetadata = titled("pf.team.title");

/** PORT-12 / G2-07: who works on the project, in which RACI role, through which access. */
export default async function ParticipantsPage({ params }: PageProps<"/[lang]/app/projects/[projectId]/participants">) {
  const { lang, projectId } = await params;
  const t = tr(lang);
  const loaded = await loadProject(lang, projectId);
  if (!loaded.ok) return loaded.view;
  const { ws, data } = loaded.p;
  const team = await listParticipants(ws.actor, projectId);
  const role = ws.actor.role;
  const canEdit = role !== null && memberCan(role, "plan.update") && (data.access.via !== "grant" || grantCan(data.access.grantRole!, "plan.update"));
  const candidates = canEdit ? await attempt(() => participantCandidates(ws.actor, projectId)) : null;
  const names = await counterpartNames(ws.actor, team.map((p) => p.member_tenant_id).filter((id) => id !== ws.tenant.tenantId));
  const tenantName = (id: string) => (id === data.project.owner_id ? data.project.owner_name : id === ws.tenant.tenantId ? ws.tenant.tenantName : (names[id] ?? "—"));

  return (
    <>
      <ProjectHeader lang={lang} p={loaded.p} />
      <div className="flex flex-col gap-6">
        <Section title={t("pf.team.title")}>
          <p className="text-[13px] leading-relaxed text-[var(--ink-2)]">{t("pf.team.lead")}</p>
          <Table head={[t("pf.team.person"), t("pf.team.raci"), t("pf.team.access"), t("pf.team.responsibilities"), ""]}>
            {team.map((p) => (
              <tr key={p.id}>
                <Td>
                  {p.name}
                  <span className="block text-[12px] text-[var(--ink-3)]">{p.email}</span>
                </Td>
                <Td>{t(`pf.team.roles.${p.raci_role}`)}</Td>
                <Td>{p.member_tenant_id === p.owner_tenant_id ? <Badge>{t("pf.team.internal")}</Badge> : <Badge tone="info">{t("pf.team.external", { tenant: tenantName(p.member_tenant_id) })}</Badge>}</Td>
                <Td className="text-[12.5px]">{p.responsibilities ?? "—"}</Td>
                <Td>{canEdit && p.user_id !== ws.session.identity.userId && <RevokeButton path={`/api/v1/participants/${p.id}`} label={t("pf.team.remove")} confirmText={t("pf.team.removeConfirm", { name: p.name })} />}</Td>
              </tr>
            ))}
          </Table>
        </Section>
        {canEdit && candidates?.ok && (
          <Section title={t("pf.team.addTitle")}>
            <AddParticipantForm projectId={projectId} candidates={candidates.data as Candidate[]} />
            <p className="text-[12.5px] text-[var(--ink-3)]">{t("pf.team.rule")}</p>
          </Section>
        )}
      </div>
    </>
  );
}
