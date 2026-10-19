import Link from "next/link";
import { CopyCode, GrantForm, RevokeButton } from "@/platform/forms";
import { Badge, PageTitle, Section, StateBox, Table, Td } from "@/platform/ui";
import { dateOnly, titled, tr } from "@/platform/server";
import { requireWorkspace } from "@/server/http/dal";
import { memberCan } from "@/server/policy/policy";
import { counterpartNames, listGrants, listProjects } from "@/server/tenancy/service";

export const generateMetadata = titled("pf.grants.title");

/**
 * ORG-11: external access this workspace gave (customer side) and received (advisory side). Opening access needs the
 * other workspace's code, a role, a purpose, an expiry and recorded consent (ADR-002).
 */
export default async function RelationshipsPage({ params }: PageProps<"/[lang]/app/relationships">) {
  const { lang } = await params;
  const t = tr(lang);
  const ws = await requireWorkspace(lang);
  const [grants, projects] = await Promise.all([listGrants(ws.actor), listProjects(ws.actor)]);
  const own = projects.filter((p) => p.owner_tenant_id === ws.tenant.tenantId);
  const canGrant = ws.actor.role !== null && memberCan(ws.actor.role, "grant.manage");
  const given = grants.filter((g) => g.owner_tenant_id === ws.tenant.tenantId);
  const received = grants.filter((g) => g.recipient_tenant_id === ws.tenant.tenantId);
  const names = await counterpartNames(ws.actor, [...given.map((g) => g.recipient_tenant_id), ...received.map((g) => g.owner_tenant_id)]);
  const now = new Date();
  const status = (g: (typeof grants)[number]) => (g.revoked_at ? <Badge>{t("pf.grants.revoked")}</Badge> : g.expires_at <= now ? <Badge>{t("pf.grants.expired")}</Badge> : <Badge tone="ok">{t("pf.grants.active")}</Badge>);

  return (
    <>
      <PageTitle title={t("pf.grants.title")} lead={t("pf.grants.lead")} />
      <div className="flex flex-col gap-6">
        <Section title={t("pf.grants.codeTitle")}>
          <p className="text-[13.5px] leading-relaxed text-[var(--ink-2)]">{ws.tenant.kind === "advisory" ? t("pf.grants.codeLeadAdvisory") : t("pf.grants.codeLeadCompany")}</p>
          <CopyCode value={ws.tenant.tenantId} label={t("pf.grants.code")} />
        </Section>

        {canGrant && (
          <Section title={t("pf.grants.new")}>
            <GrantForm projects={own.map((p) => ({ id: p.id, name: p.name }))} />
          </Section>
        )}

        <Section title={t("pf.grants.given")}>
          {given.length === 0 ? (
            <StateBox state="empty" title={t("pf.grants.noneGiven")} />
          ) : (
            <Table head={[t("pf.grants.project"), t("pf.grants.recipientCol"), t("pf.grants.role"), t("pf.grants.endsCol"), t("pf.grants.statusCol"), ""]}>
              {given.map((g) => (
                <tr key={g.id}>
                  <Td>
                    <Link href={`/${lang}/app/projects/${g.project_id}`} className="text-[var(--b-700)]">
                      {g.project_name}
                    </Link>
                  </Td>
                  <Td>{names[g.recipient_tenant_id] ?? "—"}</Td>
                  <Td>
                    {t(`pf.grantRole.${g.role}`)}
                    {g.can_download && <span className="ml-1 text-[12px] text-[var(--ink-3)]">· {t("pf.grants.downloadShort")}</span>}
                  </Td>
                  <Td>{dateOnly(lang, g.expires_at)}</Td>
                  <Td>{status(g)}</Td>
                  <Td>{canGrant && !g.revoked_at && g.expires_at > now && <RevokeButton path={`/api/v1/grants/${g.id}`} label={t("pf.grants.revoke")} confirmText={t("pf.grants.revokeConfirm")} />}</Td>
                </tr>
              ))}
            </Table>
          )}
        </Section>

        <Section title={t("pf.grants.received")}>
          {received.length === 0 ? (
            <StateBox state="empty" title={t("pf.grants.noneReceived")} />
          ) : (
            <Table head={[t("pf.grants.project"), t("pf.grants.ownerCol"), t("pf.grants.role"), t("pf.grants.endsCol"), t("pf.grants.statusCol")]}>
              {received.map((g) => (
                <tr key={g.id}>
                  <Td>
                    {!g.revoked_at && g.expires_at > now ? (
                      <Link href={`/${lang}/app/projects/${g.project_id}`} className="text-[var(--b-700)]">
                        {g.project_name}
                      </Link>
                    ) : (
                      g.project_name
                    )}
                  </Td>
                  <Td>{names[g.owner_tenant_id] ?? "—"}</Td>
                  <Td>{t(`pf.grantRole.${g.role}`)}</Td>
                  <Td>{dateOnly(lang, g.expires_at)}</Td>
                  <Td>{status(g)}</Td>
                </tr>
              ))}
            </Table>
          )}
        </Section>
      </div>
    </>
  );
}
