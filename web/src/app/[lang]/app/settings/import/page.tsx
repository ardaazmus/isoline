import { LegacyImport, RollbackImport } from "@/platform/legacy-import";
import { Badge, PageTitle, Section, StateBox, Table, Td } from "@/platform/ui";
import { attempt, dateTime, titled, tr } from "@/platform/server";
import { requireWorkspace } from "@/server/http/dal";
import { listImports, type ImportReport } from "@/server/legacy/import";

export const generateMetadata = titled("pf.import.title");

/** G1-11: move a toolkit (browser) workspace into this workspace, with a parity report and a rollback. */
export default async function ImportPage({ params }: PageProps<"/[lang]/app/settings/import">) {
  const { lang } = await params;
  const t = tr(lang);
  const ws = await requireWorkspace(lang);
  const imports = await attempt(() => listImports(ws.actor));
  if (!imports.ok) return <StateBox state="not_authorized">{t("pf.members.adminOnly")}</StateBox>;
  return (
    <>
      <PageTitle title={t("pf.import.title")} lead={t("pf.import.lead")} />
      <div className="flex flex-col gap-6">
        <Section title={t("pf.import.newTitle")}>
          <LegacyImport advisory={ws.tenant.kind === "advisory"} />
        </Section>
        <Section title={t("pf.import.history")}>
          {imports.data.length === 0 ? (
            <p className="text-[13.5px] text-[var(--ink-3)]">{t("pf.import.none")}</p>
          ) : (
            <Table head={[t("pf.import.when"), t("pf.import.file"), t("pf.import.result"), t("pf.import.statusCol"), ""]}>
              {imports.data.map((i) => {
                const r = i.report as unknown as ImportReport;
                return (
                  <tr key={i.id}>
                    <Td className="whitespace-nowrap">{dateTime(lang, i.created_at)}</Td>
                    <Td>
                      {i.file_name}
                      <span className="block text-[11.5px] text-[var(--ink-3)]">
                        v{i.source_version} · {t(`pf.import.modes.${i.mode}`)} · SHA-256 {i.source_sha256.slice(0, 12)}…
                      </span>
                    </Td>
                    <Td className="text-[12.5px]">{t("pf.import.resultLine", { p: r.counts.projects, ph: r.counts.evidencePlaceholders, ap: r.counts.unverifiedApprovals })}</Td>
                    <Td>{i.status === "applied" ? <Badge tone="ok">{t("pf.import.statusApplied")}</Badge> : <Badge>{t("pf.import.statusRolledBack")}</Badge>}</Td>
                    <Td>{i.status === "applied" && <RollbackImport id={i.id} />}</Td>
                  </tr>
                );
              })}
            </Table>
          )}
        </Section>
      </div>
    </>
  );
}
