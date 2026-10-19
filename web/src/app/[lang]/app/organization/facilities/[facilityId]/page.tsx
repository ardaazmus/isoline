import Link from "next/link";
import { FacilityEditForm } from "@/platform/g2/org";
import { Badge, PageTitle, Section, StateBox } from "@/platform/ui";
import { dateOnly, titled, tr } from "@/platform/server";
import { requireWorkspace } from "@/server/http/dal";
import { memberCan } from "@/server/policy/policy";
import { organizationTree } from "@/server/orgs/service";

export const generateMetadata = titled("pf.org.facilityTitle");

/** ORG-09: a facility — kind, location, who operates it, CBAM installation flag, validity. */
export default async function FacilityPage({ params }: PageProps<"/[lang]/app/organization/facilities/[facilityId]">) {
  const { lang, facilityId } = await params;
  const t = tr(lang);
  const ws = await requireWorkspace(lang);
  const tree = await organizationTree(ws.actor);
  const f = tree.facilities.find((x) => x.id === facilityId);
  if (!f) return <StateBox state="empty" title={t("pf.projects.notFound")} />;
  const entity = tree.entities.find((e) => e.id === f.legal_entity_id);
  const canEdit = ws.actor.role !== null && memberCan(ws.actor.role, "org.manage");
  return (
    <>
      <PageTitle
        title={f.name}
        lead={
          <>
            {t(`pf.org.kind.${f.kind}`)} · {entity?.name ?? "—"} {f.cbam_installation && <Badge tone="info">SKDM</Badge>} {!f.operated && <Badge tone="warn">{t("pf.org.notOperated")}</Badge>}
          </>
        }
        actions={<Link href={`/${lang}/app/organization`} className="text-[13px] font-medium text-[var(--b-700)]">{t("pf.org.backToTree")}</Link>}
      />
      <div className="flex flex-col gap-6">
        {canEdit ? (
          <Section title={t("pf.org.profile")}>
            <FacilityEditForm id={f.id} etag={f.row_version} initial={{ name: f.name, kind: f.kind, city: f.city, operated: f.operated, cbam: f.cbam_installation, validTo: f.valid_to }} />
          </Section>
        ) : (
          <Section title={t("pf.org.profile")}>
            <dl className="grid grid-cols-2 gap-2 text-[13.5px]">
              <dt className="text-[var(--ink-3)]">{t("pf.org.city")}</dt>
              <dd>{f.city ?? "—"}</dd>
              <dt className="text-[var(--ink-3)]">{t("pf.org.period")}</dt>
              <dd>
                {f.valid_from ? dateOnly(lang, f.valid_from) : "—"} – {f.valid_to ? dateOnly(lang, f.valid_to) : t("pf.org.open")}
              </dd>
            </dl>
          </Section>
        )}
        {f.legacy_site_id && <p className="text-[12.5px] text-[var(--ink-3)]">{t("pf.org.legacySite", { id: f.legacy_site_id })}</p>}
      </div>
    </>
  );
}
