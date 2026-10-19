import Link from "next/link";
import { factValue, metricLabel } from "@/platform/g4/format";
import { loadProject, ProjectHeader } from "@/platform/project-shell";
import { Badge, Section, StateBox, Table, Td } from "@/platform/ui";
import { attempt, dateTime, titled, tr } from "@/platform/server";
import { getSnapshot } from "@/server/close/service";

export const generateMetadata = titled("pf.close.snapshotTitle");

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A frozen snapshot: its facts as they were frozen, the digest check and what this version restated. */
export default async function SnapshotPage({ params }: PageProps<"/[lang]/app/projects/[projectId]/close/[snapshotId]">) {
  const { lang, projectId, snapshotId } = await params;
  const t = tr(lang);
  const loaded = await loadProject(lang, projectId);
  if (!loaded.ok) return loaded.view;
  const r = UUID.test(snapshotId) ? await attempt(() => getSnapshot(loaded.p.ws.actor, snapshotId)) : ({ ok: false, status: 404, code: "not_found" } as const);
  if (!r.ok || r.data.snapshot.project_id !== projectId) return <StateBox state="empty" title={t("pf.close.snapshotNotFound")} />;
  const { snapshot, facts, intact } = r.data;
  const restated = (snapshot.restated as { metric: string; facility: string | null; boundary: string | null; from: string | null; to: string | null }[] | null) ?? [];
  return (
    <>
      <ProjectHeader lang={lang} p={loaded.p} cycleId={snapshot.cycle_id} />
      <div className="flex flex-col gap-6">
        <Section title={t("pf.close.version", { v: snapshot.version })} aside={<Link href={`/${lang}/app/projects/${projectId}/close?cycle=${snapshot.cycle_id}`} className="text-[13px] text-[var(--b-700)]">{t("pf.close.back")}</Link>}>
          <p className="text-[13.5px]">
            {snapshot.frozen_by_name} · {dateTime(lang, snapshot.frozen_at)} · <Badge tone={intact ? "ok" : "crit"}>{t(intact ? "pf.close.intact" : "pf.close.tampered")}</Badge>
          </p>
          <p className="break-all font-mono text-[11.5px] text-[var(--ink-3)]">sha256 {snapshot.content_sha256}</p>
          {restated.length > 0 && (
            <div>
              <h3 className="mb-1 text-[14px] font-semibold">{t("pf.close.restatedTitle")}</h3>
              <ul className="flex flex-col gap-1 text-[13px]">
                {restated.map((x, i) => (
                  <li key={i}>
                    {metricLabel(t, x.metric)} {x.boundary ? `· ${t(`pf.scope.kind.${x.boundary}`)}` : ""}: <span className="tabular-nums">{x.from === null ? "—" : factValue(lang, x.from, "")}</span> → <span className="tabular-nums font-medium">{x.to === null ? "—" : factValue(lang, x.to, "")}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Section>
        <Section title={t("pf.close.factsN", { n: facts.length })}>
          <Table head={[t("pf.calc.metric"), t("pf.calc.facility"), t("pf.calc.boundaryShort"), t("pf.calc.valueCol")]}>
            {facts.map((f) => (
              <tr key={f.fact_id}>
                <Td>
                  <Link href={`/${lang}/app/facts/${f.fact_id}`} className="text-[var(--b-700)]">
                    {metricLabel(t, f.metric_key)}
                  </Link>{" "}
                  <span className="text-[11.5px] text-[var(--ink-3)]">r{f.revision}</span>
                </Td>
                <Td className="text-[12.5px]">{f.facility_name ?? t("pf.data.organisationLevel")}</Td>
                <Td className="text-[12.5px]">{f.boundary_kind ? t(`pf.scope.kind.${f.boundary_kind}`) : "—"}</Td>
                <Td className="tabular-nums">
                  {f.suppressed ? <Badge tone="warn">{t("pf.calc.suppressed")}</Badge> : (f.value_text ?? factValue(lang, f.value_num, f.unit))} <span className="text-[12px] text-[var(--ink-3)]">{f.unit === "ratio" ? "" : f.unit}</span>
                </Td>
              </tr>
            ))}
          </Table>
        </Section>
      </div>
    </>
  );
}
