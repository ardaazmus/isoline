import Link from "next/link";
import { emptyClient } from "@/data/sample";
import type { Profile } from "@/lib/calc/applicability";
import { ApplicabilityPanel, BoundaryPanel, type Assessment, type BoundaryView } from "@/platform/g2/scope";
import { loadProject, pickCycle, ProjectHeader } from "@/platform/project-shell";
import { Section, StateBox } from "@/platform/ui";
import { titled, tr } from "@/platform/server";
import { grantCan, memberCan } from "@/server/policy/policy";
import { listApplicability, listBoundaries, listCycles } from "@/server/projects/service";
import { organizationTree } from "@/server/orgs/service";

export const generateMetadata = titled("pf.scope.title");

/** PORT-10/11: reporting boundaries and applicability for one cycle. */
export default async function ScopePage({ params, searchParams }: PageProps<"/[lang]/app/projects/[projectId]/scope">) {
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
  const [boundaries, assessments] = await Promise.all([listBoundaries(ws.actor, cycle.id), listApplicability(ws.actor, cycle.id)]);
  const role = ws.actor.role;
  const via = data.access.via;
  const canOrg = role !== null && memberCan(role, "org.manage") && via !== "grant";
  const canDecide = role !== null && memberCan(role, "scope.decide") && (via !== "grant" || grantCan(data.access.grantRole!, "scope.decide"));
  let profile: Profile = (assessments[0]?.inputs as unknown as Profile) ?? emptyClient("x", "x").profile;
  if (!assessments.length && data.project.organization_id) {
    // first run: start from the reporting parent's entity type
    const tree = await organizationTree(ws.actor, { ownerTenantId: data.project.owner_id });
    const parent = tree.entities.find((e) => e.is_reporting_parent && e.organization_id === data.project.organization_id);
    if (parent) profile = { ...profile, entityType: parent.entity_type as Profile["entityType"], bistMainMarkets: parent.entity_type === "listed", sharesListed: parent.entity_type === "listed" };
  }

  return (
    <>
      <ProjectHeader lang={lang} p={loaded.p} />
      <div className="flex flex-col gap-6">
        {cycles.length > 1 && (
          <nav aria-label={t("pf.cycle.title")} className="flex flex-wrap gap-2 text-[13px]">
            {cycles.map((c) => (
              <Link key={c.id} href={`?cycle=${c.id}`} aria-current={c.id === cycle.id ? "page" : undefined} className={c.id === cycle.id ? "font-semibold" : "text-[var(--b-700)]"}>
                {c.label}
              </Link>
            ))}
          </nav>
        )}
        <Section title={t("pf.scope.boundariesTitle", { label: cycle.label })}>
          <p className="text-[13px] leading-relaxed text-[var(--ink-2)]">{t("pf.scope.boundariesLead")}</p>
          {data.project.organization_id === null && via !== "grant" && <StateBox state="pending_review" title={t("pf.scope.noOrg")}><Link href={`/${lang}/app/organization`} className="text-[var(--b-700)]">{t("pf.nav.organization")}</Link></StateBox>}
          <BoundaryPanel cycleId={cycle.id} boundaries={boundaries as unknown as BoundaryView[]} canEdit={canOrg} canApprove={canOrg} />
        </Section>
        <Section title={t("pf.scope.applicabilityTitle")}>
          <p className="text-[13px] leading-relaxed text-[var(--ink-2)]">{t("pf.scope.applicabilityLead")}</p>
          <ApplicabilityPanel cycleId={cycle.id} year={cycle.reporting_year} assessments={assessments as unknown as Assessment[]} profile={profile} canDecide={canDecide} canConfirm={canDecide && via !== "grant"} />
        </Section>
      </div>
    </>
  );
}
