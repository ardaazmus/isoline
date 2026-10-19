import Link from "next/link";
import { NewProjectForm } from "@/platform/forms";
import { Badge, PageTitle, Section, StateBox, Table, Td } from "@/platform/ui";
import { dateOnly, titled, tr } from "@/platform/server";
import { requireWorkspace } from "@/server/http/dal";
import { memberCan } from "@/server/policy/policy";
import { listProjects, listStewardedClients } from "@/server/tenancy/service";

export const generateMetadata = titled("pf.projects.title");

/** PORT-06/07: projects this workspace can see (own, stewarded, granted) and a new-project form for leads. */
export default async function ProjectsPage({ params }: PageProps<"/[lang]/app/projects">) {
  const { lang } = await params;
  const t = tr(lang);
  const ws = await requireWorkspace(lang);
  const projects = await listProjects(ws.actor);
  const canCreate = ws.actor.role !== null && memberCan(ws.actor.role, "project.create");
  const clients = ws.tenant.kind === "advisory" ? await listStewardedClients(ws.actor) : [];
  return (
    <>
      <PageTitle title={t("pf.projects.title")} lead={t("pf.projects.lead")} />
      <div className="flex flex-col gap-6">
        {canCreate && (
          <Section title={t("pf.projects.new")}>
            <NewProjectForm clients={clients.map((c) => ({ id: c.id, name: c.name }))} />
          </Section>
        )}
        <Section title={t("pf.projects.list")}>
          {projects.length === 0 ? (
            <StateBox state="empty" title={t("pf.projects.emptyTitle")}>
              {t("pf.projects.emptyLead")}
            </StateBox>
          ) : (
            <Table head={[t("pf.projects.name"), t("pf.projects.ownerCol"), t("pf.projects.status"), t("pf.projects.updated")]}>
              {projects.map((p) => (
                <tr key={p.id}>
                  <Td>
                    <Link href={`/${lang}/app/projects/${p.id}`} className="font-medium text-[var(--b-700)]">
                      {p.name}
                    </Link>
                  </Td>
                  <Td>
                    {p.owner_name} {p.owner_lifecycle === "provisional" && <Badge tone="warn">{t("pf.lifecycle.provisional")}</Badge>}
                  </Td>
                  <Td>
                    <Badge>{t(`pf.projectStatus.${p.status}`)}</Badge>
                  </Td>
                  <Td>{dateOnly(lang, p.updated_at)}</Td>
                </tr>
              ))}
            </Table>
          )}
        </Section>
      </div>
    </>
  );
}
