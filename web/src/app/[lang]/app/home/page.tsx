import Link from "next/link";
import { Badge, OkNote, PageTitle, Section, StateBox, Table, Td } from "@/platform/ui";
import { dateOnly, titled, tr } from "@/platform/server";
import { requireWorkspace } from "@/server/http/dal";
import { listGrants, listProjects, listStewardedClients } from "@/server/tenancy/service";

export const generateMetadata = titled("pf.home.title");

/**
 * Home: for a company the overview of its own projects and shares; for an advisory the portfolio — its own projects,
 * customer projects reached through grants, and provisional clients waiting to be claimed (plan 04 PORT-01).
 */
export default async function HomePage({ params, searchParams }: PageProps<"/[lang]/app/home">) {
  const { lang } = await params;
  const sp = await searchParams;
  const t = tr(lang);
  const ws = await requireWorkspace(lang);
  const [projects, grants, clients] = await Promise.all([listProjects(ws.actor), listGrants(ws.actor), ws.tenant.kind === "advisory" ? listStewardedClients(ws.actor) : Promise.resolve([])]);
  const now = new Date();
  const own = projects.filter((p) => p.owner_tenant_id === ws.tenant.tenantId);
  const external = projects.filter((p) => p.owner_tenant_id !== ws.tenant.tenantId);
  const given = grants.filter((g) => g.owner_tenant_id === ws.tenant.tenantId && !g.revoked_at && g.expires_at > now);
  const received = grants.filter((g) => g.recipient_tenant_id === ws.tenant.tenantId && !g.revoked_at && g.expires_at > now);
  const soon = received.filter((g) => g.expires_at.getTime() - now.getTime() < 14 * 864e5);

  return (
    <>
      <PageTitle title={ws.tenant.kind === "advisory" ? t("pf.home.portfolioTitle") : t("pf.home.title")} lead={t("pf.home.lead", { name: ws.tenant.tenantName })} />
      {sp.client === "created" && (
        <div className="mb-4">
          <OkNote>{t("pf.clients.created")}</OkNote>
        </div>
      )}
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: t("pf.home.ownProjects"), value: own.length },
          { label: ws.tenant.kind === "advisory" ? t("pf.home.clientProjects") : t("pf.home.sharedOut"), value: ws.tenant.kind === "advisory" ? external.length : given.length },
          { label: t("pf.home.grantsReceived"), value: received.length },
          { label: t("pf.home.expiringSoon"), value: soon.length },
        ].map((f) => (
          <div key={f.label} className="glass flex flex-col gap-1 p-4">
            <span className="text-[12.5px] font-medium text-[var(--ink-3)]">{f.label}</span>
            <span className="figure-num text-[28px]">{f.value}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-6">
        <Section title={t("pf.home.projects")} aside={<Link href={`/${lang}/app/projects`} className="text-[13px] font-medium text-[var(--b-700)]">{t("pf.home.allProjects")}</Link>}>
          {projects.length === 0 ? (
            <StateBox state="empty" title={t("pf.projects.emptyTitle")}>
              {t("pf.projects.emptyLead")}
            </StateBox>
          ) : (
            <Table head={[t("pf.projects.name"), t("pf.projects.ownerCol"), t("pf.projects.accessCol"), t("pf.projects.updated")]}>
              {projects.slice(0, 12).map((p) => (
                <tr key={p.id}>
                  <Td>
                    <Link href={`/${lang}/app/projects/${p.id}`} className="font-medium text-[var(--b-700)]">
                      {p.name}
                    </Link>
                  </Td>
                  <Td>
                    {p.owner_name} {p.owner_lifecycle === "provisional" && <Badge tone="warn">{t("pf.lifecycle.provisional")}</Badge>}
                  </Td>
                  <Td>{p.owner_tenant_id === ws.tenant.tenantId ? t("pf.access.member") : p.owner_lifecycle === "provisional" ? t("pf.access.steward") : t("pf.access.grant")}</Td>
                  <Td>{dateOnly(lang, p.updated_at)}</Td>
                </tr>
              ))}
            </Table>
          )}
        </Section>

        {ws.tenant.kind === "advisory" && (
          <Section title={t("pf.home.provisionalClients")} aside={<Link href={`/${lang}/app/portfolio/clients/new`} className="text-[13px] font-medium text-[var(--b-700)]">{t("pf.nav.clientsNew")}</Link>}>
            {clients.length === 0 ? (
              <p className="text-[13.5px] text-[var(--ink-3)]">{t("pf.home.noProvisional")}</p>
            ) : (
              <ul className="flex flex-col divide-y divide-[var(--rule)]">
                {clients.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center gap-3 py-2.5 text-[14px]">
                    <span className="flex-1 font-medium">{c.name}</span>
                    <Badge tone="warn">{t("pf.home.awaitingClaim")}</Badge>
                    <span className="text-[12.5px] text-[var(--ink-3)]">{dateOnly(lang, c.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        )}

        {received.length > 0 && (
          <Section title={t("pf.home.received")}>
            <ul className="flex flex-col divide-y divide-[var(--rule)]">
              {received.map((g) => (
                <li key={g.id} className="flex flex-wrap items-center gap-3 py-2.5 text-[14px]">
                  <span className="flex-1">{g.project_name}</span>
                  <Badge tone="info">{t(`pf.grantRole.${g.role}`)}</Badge>
                  <span className="text-[12.5px] text-[var(--ink-3)]">{t("pf.grants.until", { date: dateOnly(lang, g.expires_at) })}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>
    </>
  );
}
