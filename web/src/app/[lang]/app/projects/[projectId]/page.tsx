import { EvidencePanel, RevokeButton } from "@/platform/forms";
import { Badge, PageTitle, Section, StateBox, Table, Td } from "@/platform/ui";
import { attempt, dateOnly, titled, tr } from "@/platform/server";
import { requireWorkspace } from "@/server/http/dal";
import { listEvidence } from "@/server/evidence/service";
import { grantCan, memberCan } from "@/server/policy/policy";
import { counterpartNames, projectOverview } from "@/server/tenancy/service";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const generateMetadata = titled("pf.projects.title");

/** PORT-08 (G1 part): who owns the project, how this workspace reaches it, its evidence and its external access. */
export default async function ProjectPage({ params }: PageProps<"/[lang]/app/projects/[projectId]">) {
  const { lang, projectId } = await params;
  const t = tr(lang);
  const ws = await requireWorkspace(lang);
  const r = UUID.test(projectId) ? await attempt(() => projectOverview(ws.actor, projectId)) : ({ ok: false, status: 404, code: "not_found" } as const);
  if (!r.ok)
    return (
      <StateBox state={r.status === 403 ? "not_authorized" : "empty"} title={t(r.status === 403 ? "pf.state.not_authorized" : "pf.projects.notFound")}>
        {t("pf.projects.notFoundLead")}
      </StateBox>
    );
  const { project, access, grants } = r.data;
  const evidence = await listEvidence(ws.actor, projectId);
  const role = ws.actor.role;
  const can = (a: "evidence.upload" | "evidence.download" | "grant.manage") =>
    role !== null && memberCan(role, a) && (access.via !== "grant" || (a !== "grant.manage" && grantCan(access.grantRole!, a, access.canDownload ?? false)));
  const names = await counterpartNames(ws.actor, grants.map((g) => g.recipient_tenant_id));
  const now = new Date();

  return (
    <>
      <PageTitle
        title={project.name}
        lead={
          <>
            {t("pf.projects.ownedBy", { owner: project.owner_name })}{" "}
            {access.via === "grant" && <Badge tone="info">{t("pf.access.grantAs", { role: t(`pf.grantRole.${access.grantRole}`) })}</Badge>}
            {access.via === "steward" && <Badge tone="warn">{t("pf.access.stewardNote")}</Badge>}
          </>
        }
      />
      <div className="flex flex-col gap-6">
        <Section title={t("pf.evidence.title")} id="evidence">
          <EvidencePanel projectId={project.id} items={evidence} canUpload={can("evidence.upload")} canDownload={can("evidence.download")} />
        </Section>
        {access.via === "member" && (
          <Section title={t("pf.grants.projectTitle")} id="grants">
            {grants.length === 0 ? (
              <p className="text-[13.5px] text-[var(--ink-3)]">{t("pf.grants.none")}</p>
            ) : (
              <Table head={[t("pf.grants.recipientCol"), t("pf.grants.role"), t("pf.grants.purpose"), t("pf.grants.endsCol"), ""]}>
                {grants.map((g) => {
                  const active = !g.revoked_at && g.expires_at > now;
                  return (
                    <tr key={g.id}>
                      <Td>{names[g.recipient_tenant_id] ?? g.recipient_tenant_id}</Td>
                      <Td>{t(`pf.grantRole.${g.role}`)}</Td>
                      <Td>{g.purpose}</Td>
                      <Td>{active ? dateOnly(lang, g.expires_at) : <Badge tone="neutral">{g.revoked_at ? t("pf.grants.revoked") : t("pf.grants.expired")}</Badge>}</Td>
                      <Td>{active && can("grant.manage") && <RevokeButton path={`/api/v1/grants/${g.id}`} label={t("pf.grants.revoke")} confirmText={t("pf.grants.revokeConfirm")} />}</Td>
                    </tr>
                  );
                })}
              </Table>
            )}
          </Section>
        )}
      </div>
    </>
  );
}
