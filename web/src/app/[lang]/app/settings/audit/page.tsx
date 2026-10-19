import Link from "next/link";
import { Badge, OkNote, PageTitle, Section, StateBox, Table, Td } from "@/platform/ui";
import { attempt, dateTime, titled, tr } from "@/platform/server";
import { requireWorkspace } from "@/server/http/dal";
import { auditChainStatus, listAudit } from "@/server/tenancy/service";

export const generateMetadata = titled("pf.audit.title");

/** ORG-13 / G1-10: the workspace's audit trail and its hash-chain check. */
export default async function AuditPage({ params, searchParams }: PageProps<"/[lang]/app/settings/audit">) {
  const { lang } = await params;
  const sp = await searchParams;
  const t = tr(lang);
  const ws = await requireWorkspace(lang);
  const before = typeof sp.before === "string" && /^\d+$/.test(sp.before) ? Number(sp.before) : undefined;
  const [events, chain] = await Promise.all([attempt(() => listAudit(ws.actor, { limit: 50, beforeId: before })), attempt(() => auditChainStatus(ws.actor))]);
  if (!events.ok || !chain.ok) return <StateBox state="not_authorized">{t("pf.members.adminOnly")}</StateBox>;
  const last = events.data.at(-1);
  return (
    <>
      <PageTitle title={t("pf.audit.title")} lead={t("pf.audit.lead")} />
      <div className="flex flex-col gap-6">
        {chain.data.ok ? (
          <OkNote>{t("pf.audit.chainOk", { n: chain.data.events })}</OkNote>
        ) : (
          <StateBox state="error" title={t("pf.audit.chainBroken")}>
            {t("pf.audit.chainBrokenAt", { id: chain.data.firstBrokenId ?? "?" })}
          </StateBox>
        )}
        <Section title={t("pf.audit.events")}>
          {events.data.length === 0 ? (
            <StateBox state="empty" />
          ) : (
            <Table head={[t("pf.audit.when"), t("pf.audit.who"), t("pf.audit.action"), t("pf.audit.object"), t("pf.audit.hash")]}>
              {events.data.map((e) => (
                <tr key={e.id}>
                  <Td className="whitespace-nowrap">{dateTime(lang, e.occurred_at)}</Td>
                  <Td>
                    {e.actor_name ?? t("pf.audit.system")}
                    {e.acting_tenant_id && e.acting_tenant_id !== ws.tenant.tenantId && (
                      <span className="ml-1">
                        <Badge tone="info">{t("pf.audit.external")}</Badge>
                      </span>
                    )}
                  </Td>
                  <Td>
                    <code className="text-[12.5px]">{e.action}</code>
                  </Td>
                  <Td className="text-[12.5px] text-[var(--ink-2)]">
                    {e.object_type} · {e.object_id.slice(0, 8)}
                  </Td>
                  <Td>
                    <code className="text-[11.5px] text-[var(--ink-3)]" title={e.hash}>
                      {e.hash.slice(0, 10)}
                    </code>
                  </Td>
                </tr>
              ))}
            </Table>
          )}
          {last && events.data.length === 50 && (
            <Link href={`/${lang}/app/settings/audit?before=${last.id}`} className="text-[13px] font-medium text-[var(--b-700)]">
              {t("pf.audit.older")}
            </Link>
          )}
        </Section>
      </div>
    </>
  );
}
