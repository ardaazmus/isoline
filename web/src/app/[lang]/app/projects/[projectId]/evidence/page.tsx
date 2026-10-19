import { EvidencePanel } from "@/platform/forms";
import { loadProject, ProjectHeader } from "@/platform/project-shell";
import { Section } from "@/platform/ui";
import { titled, tr } from "@/platform/server";
import { listEvidence } from "@/server/evidence/service";
import { grantCan, memberCan } from "@/server/policy/policy";

export const generateMetadata = titled("pf.evidence.title");

/** Step 2 → evidence files: the project's scanned, classified documents (moved here from the summary). */
export default async function EvidencePage({ params }: PageProps<"/[lang]/app/projects/[projectId]/evidence">) {
  const { lang, projectId } = await params;
  const t = tr(lang);
  const loaded = await loadProject(lang, projectId);
  if (!loaded.ok) return loaded.view;
  const { ws, data } = loaded.p;
  const { project, access } = data;
  const evidence = await listEvidence(ws.actor, projectId);
  const role = ws.actor.role;
  const can = (a: "evidence.upload" | "evidence.download") => role !== null && memberCan(role, a) && (access.via !== "grant" || grantCan(access.grantRole!, a, access.canDownload ?? false));
  return (
    <>
      <ProjectHeader lang={lang} p={loaded.p} />
      <Section title={t("pf.evidence.title")} id="evidence">
        <EvidencePanel projectId={project.id} items={evidence} canUpload={can("evidence.upload")} canDownload={can("evidence.download")} />
      </Section>
    </>
  );
}
