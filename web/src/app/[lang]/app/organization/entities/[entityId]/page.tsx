import Link from "next/link";
import { EndEdgeButton, EntityEditForm } from "@/platform/g2/org";
import { Badge, PageTitle, Section, StateBox, Table, Td } from "@/platform/ui";
import { dateOnly, titled, tr } from "@/platform/server";
import { requireWorkspace } from "@/server/http/dal";
import { memberCan } from "@/server/policy/policy";
import { organizationTree } from "@/server/orgs/service";

export const generateMetadata = titled("pf.org.entityTitle");

/** ORG-08: a legal entity's profile and its ownership/control timeline (as owner and as owned). */
export default async function EntityPage({ params }: PageProps<"/[lang]/app/organization/entities/[entityId]">) {
  const { lang, entityId } = await params;
  const t = tr(lang);
  const ws = await requireWorkspace(lang);
  const tree = await organizationTree(ws.actor);
  const e = tree.entities.find((x) => x.id === entityId);
  if (!e) return <StateBox state="empty" title={t("pf.projects.notFound")} />;
  const canEdit = ws.actor.role !== null && memberCan(ws.actor.role, "org.manage");
  const name = (id: string) => tree.entities.find((x) => x.id === id)?.name ?? "—";
  const edges = tree.edges.filter((x) => x.child_entity_id === e.id || x.parent_entity_id === e.id);
  const facilities = tree.facilities.filter((f) => f.legal_entity_id === e.id);
  return (
    <>
      <PageTitle title={e.name} lead={<>{t(`app.entity.${e.entity_type}`)} {e.is_reporting_parent && <Badge tone="info">{t("pf.org.parentBadge")}</Badge>}</>} actions={<Link href={`/${lang}/app/organization`} className="text-[13px] font-medium text-[var(--b-700)]">{t("pf.org.backToTree")}</Link>} />
      <div className="flex flex-col gap-6">
        {canEdit && (
          <Section title={t("pf.org.profile")}>
            <EntityEditForm id={e.id} etag={e.row_version} initial={{ name: e.name, taxId: e.tax_id, entityType: e.entity_type, validFrom: e.valid_from, validTo: e.valid_to }} />
          </Section>
        )}
        <Section title={t("pf.org.timeline")}>
          {edges.length === 0 ? (
            <p className="text-[13.5px] text-[var(--ink-3)]">{t("pf.org.noEdges")}</p>
          ) : (
            <Table head={[t("pf.org.relation"), t("pf.org.share"), t("pf.org.control"), t("pf.org.period"), t("pf.org.sourceNote"), ""]}>
              {edges.map((x) => (
                <tr key={x.id}>
                  <Td>{x.child_entity_id === e.id ? t("pf.org.ownedBy", { name: name(x.parent_entity_id) }) : t("pf.org.owns", { name: name(x.child_entity_id) })}</Td>
                  <Td className="num">%{Number(x.share_pct)}</Td>
                  <Td>{t(`pf.org.controls.${x.control}`)}</Td>
                  <Td className="whitespace-nowrap">
                    {dateOnly(lang, x.valid_from)} – {x.valid_to ? dateOnly(lang, x.valid_to) : t("pf.org.open")}
                  </Td>
                  <Td className="text-[12.5px] text-[var(--ink-2)]">{x.source_note ?? "—"}</Td>
                  <Td>{canEdit && !x.valid_to && <EndEdgeButton edgeId={x.id} />}</Td>
                </tr>
              ))}
            </Table>
          )}
        </Section>
        <Section title={t("pf.org.facilities")}>
          {facilities.length === 0 ? (
            <p className="text-[13.5px] text-[var(--ink-3)]">{t("pf.org.noFacilities")}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-[var(--rule)]">
              {facilities.map((f) => (
                <li key={f.id} className="py-2">
                  <Link href={`/${lang}/app/organization/facilities/${f.id}`} className="font-medium text-[var(--b-700)]">
                    {f.name}
                  </Link>{" "}
                  <span className="text-[12.5px] text-[var(--ink-3)]">{t(`pf.org.kind.${f.kind}`)}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </>
  );
}
