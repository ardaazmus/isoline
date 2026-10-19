import Link from "next/link";
import { AsOfPicker, ConfirmMapping, EdgeForm, EndEdgeButton, EntityForm, FacilityForm, OrganizationForm } from "@/platform/g2/org";
import { Badge, PageTitle, Section, StateBox, Table, Td } from "@/platform/ui";
import { dateOnly, titled, tr } from "@/platform/server";
import { requireWorkspace } from "@/server/http/dal";
import { memberCan } from "@/server/policy/policy";
import { organizationTree } from "@/server/orgs/service";
import { listStewardedClients } from "@/server/tenancy/service";

export const generateMetadata = titled("pf.org.title");

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * ORG-07: the reporting organisation as a tree — legal entities with their dated ownership and control, facilities
 * below them. "As of" shows the structure on one day (a sale in July changes the year-end picture, not March's).
 */
export default async function OrganizationPage({ params, searchParams }: PageProps<"/[lang]/app/organization">) {
  const { lang } = await params;
  const sp = await searchParams;
  const t = tr(lang);
  const ws = await requireWorkspace(lang);
  const asOf = typeof sp.asOf === "string" && DATE.test(sp.asOf) ? sp.asOf : undefined;
  // an advisory prepares the trees of its provisional clients (?owner=<client tenant>)
  const clients = ws.tenant.kind === "advisory" ? await listStewardedClients(ws.actor) : [];
  const owner = typeof sp.owner === "string" ? clients.find((c) => c.id === sp.owner)?.id : undefined;
  const tree = await organizationTree(ws.actor, { asOf, ownerTenantId: owner });
  const canEdit = ws.actor.role !== null && memberCan(ws.actor.role, "org.manage");
  const org = tree.organizations[0];
  const name = (id: string) => tree.entities.find((e) => e.id === id)?.name ?? "—";
  const entities = tree.entities.filter((e) => e.alive);
  const base = `/${lang}/app/organization`;
  const here = owner ? `${base}?owner=${owner}` : base;

  return (
    <>
      <PageTitle title={t("pf.org.title")} lead={t("pf.org.lead")} actions={<AsOfPicker value={asOf ?? ""} basePath={here} />} />
      {clients.length > 0 && (
        <nav aria-label={t("pf.org.whose")} className="mb-5 flex flex-wrap items-center gap-2 text-[13px]">
          <span className="text-[var(--ink-3)]">{t("pf.org.whose")}:</span>
          <Link href={base} aria-current={!owner ? "page" : undefined} className={!owner ? "font-semibold" : "text-[var(--b-700)]"}>
            {ws.tenant.tenantName}
          </Link>
          {clients.map((c) => (
            <Link key={c.id} href={`${base}?owner=${c.id}`} aria-current={owner === c.id ? "page" : undefined} className={owner === c.id ? "font-semibold" : "text-[var(--b-700)]"}>
              {c.name}
            </Link>
          ))}
        </nav>
      )}
      {!org ? (
        canEdit ? (
          <Section title={t("pf.org.startTitle")}>
            <p className="text-[13.5px] text-[var(--ink-2)]">{t("pf.org.startLead")}</p>
            <OrganizationForm ownerTenantId={owner} />
          </Section>
        ) : (
          <StateBox state="empty" title={t("pf.org.none")} />
        )
      ) : (
        <div className="flex flex-col gap-6">
          {org.mapping_status === "unmapped" && (
            <StateBox state="pending_review" title={t("pf.org.unmappedTitle")} action={canEdit ? <ConfirmMapping organizationId={org.id} /> : undefined}>
              {t("pf.org.unmappedLead")}
            </StateBox>
          )}
          <Section title={org.name} aside={<span className="text-[12.5px] text-[var(--ink-3)]">{asOf ? t("pf.org.viewAsOf", { date: dateOnly(lang, asOf) }) : t("pf.org.viewAll")}</span>}>
            <ul className="flex flex-col gap-3" aria-label={t("pf.org.treeLabel")}>
              {entities.map((e) => {
                const facs = tree.facilities.filter((f) => f.legal_entity_id === e.id && f.alive);
                const parents = tree.edges.filter((x) => x.child_entity_id === e.id && x.alive);
                return (
                  <li key={e.id} className="rounded-[14px] border border-[var(--rule)] bg-[var(--paper)] p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`${base}/entities/${e.id}`} className="text-[15px] font-semibold text-[var(--b-700)]">
                        {e.name}
                      </Link>
                      {e.is_reporting_parent && <Badge tone="info">{t("pf.org.parentBadge")}</Badge>}
                      <span className="text-[12.5px] text-[var(--ink-3)]">{t(`app.entity.${e.entity_type}`)}</span>
                    </div>
                    {parents.length > 0 && (
                      <p className="mt-1 text-[12.5px] text-[var(--ink-2)]">
                        {parents.map((p) => t("pf.org.heldBy", { parent: name(p.parent_entity_id), share: Number(p.share_pct), control: t(`pf.org.controls.${p.control}`) })).join(" · ")}
                      </p>
                    )}
                    {facs.length > 0 && (
                      <ul className="mt-2 flex flex-wrap gap-2">
                        {facs.map((f) => (
                          <li key={f.id}>
                            <Link href={`${base}/facilities/${f.id}`} className="inline-flex items-center gap-1.5 rounded-full border border-[var(--rule)] px-2.5 py-1 text-[12.5px] text-[var(--ink)] no-underline hover:border-[var(--b-300)]">
                              {f.name}
                              <span className="text-[var(--ink-3)]">· {t(`pf.org.kind.${f.kind}`)}</span>
                              {!f.operated && <span className="text-[var(--warn)]">· {t("pf.org.notOperated")}</span>}
                              {f.cbam_installation && <span className="text-[var(--b-700)]">· SKDM</span>}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </Section>

          <Section title={t("pf.org.edgesTitle")}>
            {tree.edges.length === 0 ? (
              <p className="text-[13.5px] text-[var(--ink-3)]">{t("pf.org.noEdges")}</p>
            ) : (
              <Table head={[t("pf.org.parent"), t("pf.org.child"), t("pf.org.share"), t("pf.org.control"), t("pf.org.period"), ""]}>
                {tree.edges.map((x) => (
                  <tr key={x.id} className={x.alive ? undefined : "opacity-50"}>
                    <Td>{name(x.parent_entity_id)}</Td>
                    <Td>{name(x.child_entity_id)}</Td>
                    <Td className="num">%{Number(x.share_pct)}</Td>
                    <Td>{t(`pf.org.controls.${x.control}`)}</Td>
                    <Td className="whitespace-nowrap">
                      {dateOnly(lang, x.valid_from)} – {x.valid_to ? dateOnly(lang, x.valid_to) : t("pf.org.open")}
                    </Td>
                    <Td>{canEdit && !x.valid_to && <EndEdgeButton edgeId={x.id} />}</Td>
                  </tr>
                ))}
              </Table>
            )}
          </Section>

          {canEdit && (
            <div className="grid gap-6 xl:grid-cols-2">
              <Section title={t("pf.org.addEntity")}>
                <EntityForm organizationId={org.id} hasParent={tree.entities.some((e) => e.is_reporting_parent)} />
              </Section>
              <Section title={t("pf.org.addFacility")}>
                <FacilityForm entities={entities.map((e) => ({ id: e.id, name: e.name }))} />
              </Section>
              <Section title={t("pf.org.addEdge")}>
                <EdgeForm entities={entities.map((e) => ({ id: e.id, name: e.name }))} />
              </Section>
            </div>
          )}
        </div>
      )}
    </>
  );
}
