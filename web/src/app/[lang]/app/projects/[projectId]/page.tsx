import { EvidencePanel, RevokeButton } from "@/platform/forms";
import { AddCycleForm, CycleMove } from "@/platform/g2/project";
import { loadProject, ProjectHeader } from "@/platform/project-shell";
import { Badge, Section, Table, Td } from "@/platform/ui";
import { dateOnly, titled, tr } from "@/platform/server";
import { listEvidence } from "@/server/evidence/service";
import { grantCan, memberCan } from "@/server/policy/policy";
import { listCycles } from "@/server/projects/service";
import { counterpartNames } from "@/server/tenancy/service";

export const generateMetadata = titled("pf.projects.title");

const NEXT: Record<string, string> = { planning: "collection", collection: "calculation", calculation: "close_review", close_review: "calculation", reopened: "collection" };

/** PORT-08: reporting cycles, evidence and external access of one project. */
export default async function ProjectPage({ params }: PageProps<"/[lang]/app/projects/[projectId]">) {
  const { lang, projectId } = await params;
  const t = tr(lang);
  const loaded = await loadProject(lang, projectId);
  if (!loaded.ok) return loaded.view;
  const { ws, data } = loaded.p;
  const { project, access, grants } = data;
  const [evidence, cycles] = await Promise.all([listEvidence(ws.actor, projectId), listCycles(ws.actor, projectId)]);
  const role = ws.actor.role;
  const can = (a: "evidence.upload" | "evidence.download" | "grant.manage" | "project.update") =>
    role !== null && memberCan(role, a) && (access.via !== "grant" || (a !== "grant.manage" && a !== "project.update" && grantCan(access.grantRole!, a, access.canDownload ?? false)));
  const names = await counterpartNames(ws.actor, grants.map((g) => g.recipient_tenant_id));
  const now = new Date();

  return (
    <>
      <ProjectHeader lang={lang} p={loaded.p} />
      <div className="flex flex-col gap-6">
        <Section title={t("pf.cycle.title")} id="cycles">
          {cycles.length === 0 ? (
            <p className="text-[13.5px] text-[var(--ink-3)]">{t("pf.cycle.none")}</p>
          ) : (
            <Table head={[t("pf.cycle.label"), t("pf.cycle.period"), t("pf.cycle.publishDue"), t("pf.cycle.status"), ""]}>
              {cycles.map((c) => (
                <tr key={c.id}>
                  <Td>
                    {c.label} {c.is_base_year && <Badge tone="info">{t("pf.cycle.baseYear")}</Badge>}
                  </Td>
                  <Td className="whitespace-nowrap">
                    {dateOnly(lang, c.period_start)} – {dateOnly(lang, c.period_end)}
                  </Td>
                  <Td>{c.publish_due ? dateOnly(lang, c.publish_due) : "—"}</Td>
                  <Td>
                    <Badge>{t(`pf.cycle.states.${c.status}`)}</Badge>
                  </Td>
                  <Td>{can("project.update") && NEXT[c.status] && <CycleMove cycleId={c.id} to={NEXT[c.status]} etag={c.row_version} label={t("pf.cycle.moveTo", { state: t(`pf.cycle.states.${NEXT[c.status]}`) })} />}</Td>
                </tr>
              ))}
            </Table>
          )}
          {can("project.update") && <AddCycleForm projectId={project.id} nextYear={(cycles[0]?.reporting_year ?? new Date().getFullYear()) + 1} />}
        </Section>
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
