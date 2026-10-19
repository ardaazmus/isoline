import { projectCycles } from "@/platform/cached";
import { RevokeButton } from "@/platform/forms";
import { AddCycleForm } from "@/platform/g2/project";
import { loadProject, ProjectHeader } from "@/platform/project-shell";
import { Badge, Section, Table, Td } from "@/platform/ui";
import { dateOnly, titled, tr } from "@/platform/server";
import { grantCan, memberCan } from "@/server/policy/policy";
import { counterpartNames } from "@/server/tenancy/service";
import { latestCycles } from "@/server/cycle/progress";

export const generateMetadata = titled("pf.steps.setup");

/**
 * Setup → cycles and sharing (UX review 19.10.2026): the project's reporting cycles and the external access opened
 * on it. A cycle's working state is no longer moved by hand — the step bar derives it — so only the frozen,
 * released and reopened states that the close records are shown next to the derived step.
 */
export default async function SetupPage({ params }: PageProps<"/[lang]/app/projects/[projectId]/setup">) {
  const { lang, projectId } = await params;
  const t = tr(lang);
  const loaded = await loadProject(lang, projectId);
  if (!loaded.ok) return loaded.view;
  const { ws, data } = loaded.p;
  const { project, access, grants } = data;
  const [cycles, latest] = await Promise.all([projectCycles(ws.actor, projectId), latestCycles(ws.actor)]);
  const role = ws.actor.role;
  const can = (a: "grant.manage" | "project.update") => role !== null && memberCan(role, a) && access.via !== "grant";
  const canAdd = role !== null && memberCan(role, "project.update") && (access.via !== "grant" || grantCan(access.grantRole!, "project.update"));
  const names = await counterpartNames(ws.actor, grants.map((g) => g.recipient_tenant_id));
  const now = new Date();
  const newest = latest.get(projectId);
  return (
    <>
      <ProjectHeader lang={lang} p={loaded.p} />
      <p className="on-ground mb-5 max-w-[80ch] text-[13.5px] leading-relaxed text-[var(--ink-2)]">{t("pf.steps.setupLead")}</p>
      <div className="flex flex-col gap-6">
        <Section title={t("pf.cycle.title")} id="cycles">
          {cycles.length === 0 ? (
            <p className="text-[13.5px] text-[var(--ink-3)]">{t("pf.cycle.none")}</p>
          ) : (
            <Table head={[t("pf.cycle.label"), t("pf.cycle.period"), t("pf.cycle.publishDue"), t("pf.today.col.step")]}>
              {cycles.map((c) => {
                const prog = newest && newest.cycle.id === c.id ? newest.progress : null;
                return (
                  <tr key={c.id}>
                    <Td>
                      {c.label} {c.is_base_year && <Badge tone="info">{t("pf.cycle.baseYear")}</Badge>}
                    </Td>
                    <Td className="whitespace-nowrap">
                      {dateOnly(lang, c.period_start)} – {dateOnly(lang, c.period_end)}
                    </Td>
                    <Td>{c.publish_due ? dateOnly(lang, c.publish_due) : "—"}</Td>
                    <Td>
                      {["frozen", "released", "reopened"].includes(c.status) ? (
                        <Badge tone={c.status === "reopened" ? "warn" : "ok"}>{t(`pf.cycle.states.${c.status}`)}</Badge>
                      ) : prog ? (
                        prog.current === "complete" ? (
                          <Badge tone="ok">{t("pf.steps.complete")}</Badge>
                        ) : (
                          <Badge tone="info">{t(`pf.steps.name.${prog.current}`)}</Badge>
                        )
                      ) : (
                        "—"
                      )}
                    </Td>
                  </tr>
                );
              })}
            </Table>
          )}
          {canAdd && <AddCycleForm projectId={project.id} nextYear={(cycles[0]?.reporting_year ?? new Date().getFullYear()) + 1} />}
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
