import { Badge, PageTitle, Section, StateBox, Table, Td } from "@/platform/ui";
import { attempt, dateTime, titled, tr } from "@/platform/server";
import { requireWorkspace } from "@/server/http/dal";
import { withActor } from "@/server/db/client";
import { referenceLog } from "@/server/reference/updater";
import { requireMemberAction } from "@/server/tenancy/service";

export const generateMetadata = titled("pf.ref.title");

/** G8-03: when the built-in reference data changed, with what was added, removed or changed. */
export default async function ReferencePage({ params }: PageProps<"/[lang]/app/settings/reference">) {
  const { lang } = await params;
  const t = tr(lang);
  const ws = await requireWorkspace(lang);
  const ok = await attempt(() => withActor(ws.actor, (tx) => requireMemberAction(tx, ws.actor, "audit.read")));
  if (!ok.ok) return <StateBox state="not_authorized" />;
  const rows = await referenceLog();
  return (
    <>
      <PageTitle title={t("pf.ref.title")} lead={t("pf.ref.lead")} />
      <Section title={t("pf.ref.list", { n: rows.length })}>
        <Table head={[t("pf.ref.kind"), t("pf.ref.version"), t("pf.ref.applied"), t("pf.ref.changes"), "SHA-256"]}>
          {rows.map((r) => {
            const s = r.summary as { items?: number; counts?: { added: number; removed: number; changed: number } };
            return (
              <tr key={r.id}>
                <Td>
                  <Badge tone="info">{t(`pf.ref.kinds.${r.kind}`)}</Badge>
                </Td>
                <Td className="max-w-[260px] truncate font-mono text-[11.5px]">{r.version}</Td>
                <Td className="text-[12.5px]">{dateTime(lang, r.applied_at)}</Td>
                <Td className="text-[12.5px]">{t("pf.ref.counts", { items: s.items ?? 0, added: s.counts?.added ?? 0, removed: s.counts?.removed ?? 0, changed: s.counts?.changed ?? 0 })}</Td>
                <Td className="font-mono text-[11px] text-[var(--ink-3)]">{r.digest.slice(0, 16)}…</Td>
              </tr>
            );
          })}
        </Table>
      </Section>
    </>
  );
}
