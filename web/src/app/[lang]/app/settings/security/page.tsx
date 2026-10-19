import { TenantSettingsForm } from "@/platform/forms";
import { PageTitle, Section, StateBox } from "@/platform/ui";
import { titled, tr } from "@/platform/server";
import { requireWorkspace } from "@/server/http/dal";
import { memberCan } from "@/server/policy/policy";
import { tenantProfile } from "@/server/tenancy/service";

export const generateMetadata = titled("pf.security.title");

/** SET-02: workspace name and the MFA rule. Saved with If-Match so two admins cannot overwrite each other silently. */
export default async function SecuritySettingsPage({ params }: PageProps<"/[lang]/app/settings/security">) {
  const { lang } = await params;
  const t = tr(lang);
  const ws = await requireWorkspace(lang);
  if (ws.actor.role === null || !memberCan(ws.actor.role, "tenant.manage")) return <StateBox state="not_authorized">{t("pf.members.adminOnly")}</StateBox>;
  const p = await tenantProfile(ws.actor);
  return (
    <>
      <PageTitle title={t("pf.security.title")} lead={t("pf.security.lead")} />
      <div className="max-w-[720px]">
        <Section title={t("pf.security.policy")}>
          <TenantSettingsForm name={p.name} requireMfa={p.require_mfa} etag={`"${p.row_version}"`} />
        </Section>
      </div>
    </>
  );
}
