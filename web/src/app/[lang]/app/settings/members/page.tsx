import { InviteForm, RevokeButton } from "@/platform/forms";
import { Badge, PageTitle, Section, StateBox, Table, Td } from "@/platform/ui";
import { attempt, dateOnly, titled, tr } from "@/platform/server";
import { requireWorkspace } from "@/server/http/dal";
import { listInvitations, listMembers } from "@/server/tenancy/service";

export const generateMetadata = titled("pf.members.title");

/** ORG-12 / G1-12: members, roles, pending invitations; ending a membership ends API access on the next request. */
export default async function MembersPage({ params }: PageProps<"/[lang]/app/settings/members">) {
  const { lang } = await params;
  const t = tr(lang);
  const ws = await requireWorkspace(lang);
  const [members, invitations] = await Promise.all([attempt(() => listMembers(ws.actor)), attempt(() => listInvitations(ws.actor))]);
  if (!members.ok || !invitations.ok) return <StateBox state="not_authorized">{t("pf.members.adminOnly")}</StateBox>;
  return (
    <>
      <PageTitle title={t("pf.members.title")} lead={t("pf.members.lead")} />
      <div className="flex flex-col gap-6">
        <Section title={t("pf.members.inviteTitle")}>
          <InviteForm />
        </Section>
        <Section title={t("pf.members.list")}>
          <Table head={[t("pf.members.name"), t("pf.members.email"), t("pf.members.role"), t("pf.members.mfa"), ""]}>
            {members.data.map((m) => (
              <tr key={m.id}>
                <Td>{m.name}</Td>
                <Td>{m.email}</Td>
                <Td>{t(`pf.role.${m.role}`)}</Td>
                <Td>{m.twoFactorEnabled ? <Badge tone="ok">{t("pf.account.on")}</Badge> : <Badge tone="warn">{t("pf.account.off")}</Badge>}</Td>
                <Td>{m.email !== ws.session.identity.email && <RevokeButton path={`/api/v1/members/${m.id}`} label={t("pf.members.remove")} confirmText={t("pf.members.removeConfirm", { name: m.name })} />}</Td>
              </tr>
            ))}
          </Table>
        </Section>
        <Section title={t("pf.members.pending")}>
          {invitations.data.length === 0 ? (
            <p className="text-[13.5px] text-[var(--ink-3)]">{t("pf.members.noPending")}</p>
          ) : (
            <Table head={[t("pf.members.email"), t("pf.members.role"), t("pf.members.expires"), ""]}>
              {invitations.data.map((i) => (
                <tr key={i.id}>
                  <Td>{String(i.email)}</Td>
                  <Td>
                    {t(`pf.role.${i.role}`)} {i.kind === "claim" && <Badge tone="info">{t("pf.members.claim")}</Badge>}
                  </Td>
                  <Td>{i.expires_at > new Date() ? dateOnly(lang, i.expires_at) : <Badge>{t("pf.grants.expired")}</Badge>}</Td>
                  <Td>
                    <RevokeButton path={`/api/v1/invitations/${i.id}`} label={t("pf.members.cancelInvite")} confirmText={t("pf.members.cancelConfirm")} />
                  </Td>
                </tr>
              ))}
            </Table>
          )}
        </Section>
      </div>
    </>
  );
}
