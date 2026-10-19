import Link from "next/link";
import { factValue, metricLabel } from "@/platform/g4/format";
import { PageTitle, Section, StateBox, Table, Td, Badge } from "@/platform/ui";
import { dateOnly, titled, tr } from "@/platform/server";
import { requireWorkspace } from "@/server/http/dal";
import { reviewQueue } from "@/server/close/service";

export const generateMetadata = titled("pf.review.title");

/** CTRL-06: one inbox for every decision waiting for this person — data, calculated metrics, findings, figures. */
export default async function ReviewPage({ params }: PageProps<"/[lang]/app/review">) {
  const { lang } = await params;
  const t = tr(lang);
  const ws = await requireWorkspace(lang);
  const q = await reviewQueue(ws.actor);
  const total = q.requests.length + q.facts.length + q.issues.length + q.inputs.length;
  return (
    <>
      <PageTitle title={t("pf.review.title")} lead={t("pf.review.lead")} />
      {total === 0 ? (
        <StateBox state="empty" title={t("pf.review.empty")} />
      ) : (
        <div className="flex flex-col gap-6">
          {q.requests.length > 0 && (
            <Section title={t("pf.review.requests", { n: q.requests.length })}>
              <Table head={[t("pf.lineage.item"), t("pf.review.project"), t("pf.calc.facility"), t("pf.review.from"), t("pf.review.due")]}>
                {q.requests.map((r) => (
                  <tr key={r.id}>
                    <Td>
                      <Link href={`/${lang}/app/tasks/${r.id}`} className="font-medium text-[var(--b-700)]">
                        {t(`req.items.${r.metric_code}`)}
                      </Link>{" "}
                      {r.critical && <Badge tone="crit">{t("pf.review.critical")}</Badge>}
                    </Td>
                    <Td className="text-[12.5px]">{r.project_name}</Td>
                    <Td className="text-[12.5px]">{r.facility_name ?? t("pf.data.organisationLevel")}</Td>
                    <Td className="text-[12.5px]">{r.assignee_name}</Td>
                    <Td className="text-[12.5px]">{r.due_on ? dateOnly(lang, r.due_on) : "—"}</Td>
                  </tr>
                ))}
              </Table>
            </Section>
          )}
          {q.facts.length > 0 && (
            <Section title={t("pf.review.facts", { n: q.facts.length })}>
              <Table head={[t("pf.calc.metric"), t("pf.review.project"), t("pf.review.new"), t("pf.review.previous"), t("pf.calc.performed")]}>
                {q.facts.map((f) => (
                  <tr key={f.id}>
                    <Td>
                      <Link href={`/${lang}/app/projects/${f.project_id}/calculations/${f.run_id}`} className="font-medium text-[var(--b-700)]">
                        {metricLabel(t, f.metric_key)}
                      </Link>
                      <span className="ml-1 text-[11.5px] text-[var(--ink-3)]">r{f.revision}</span>
                    </Td>
                    <Td className="text-[12.5px]">{f.project_name}</Td>
                    <Td className="tabular-nums">
                      {f.value_text ?? factValue(lang, f.value_num, f.unit)} {f.unit === "ratio" ? "" : f.unit}
                    </Td>
                    <Td className="tabular-nums text-[12.5px] text-[var(--ink-2)]">{f.previous ? (f.previous.value_text ?? factValue(lang, f.previous.value_num, f.unit)) : "—"}</Td>
                    <Td className="text-[12.5px]">{f.performed_by_name}</Td>
                  </tr>
                ))}
              </Table>
            </Section>
          )}
          {q.issues.length > 0 && (
            <Section title={t("pf.review.issues", { n: q.issues.length })}>
              <ul className="flex flex-col gap-1.5 text-[13.5px]">
                {q.issues.map((i) => (
                  <li key={i.id}>
                    <Link href={`/${lang}/app/projects/${i.project_id}/controls`} className="text-[var(--b-700)]">
                      {t(`pf.calc.rule.${i.rule_id}`)}
                    </Link>{" "}
                    <span className="text-[12.5px] text-[var(--ink-3)]">— {i.project_name}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}
          {q.inputs.length > 0 && (
            <Section title={t("pf.review.inputs", { n: q.inputs.length })}>
              <ul className="flex flex-col gap-1.5 text-[13.5px]">
                {q.inputs.map((i) => (
                  <li key={i.id}>
                    <Link href={`/${lang}/app/projects/${i.project_id}/consolidation?cycle=${i.cycle_id}`} className="text-[var(--b-700)]">
                      {i.entity_name}
                    </Link>{" "}
                    <span className="tabular-nums">{factValue(lang, i.net_sales, "")} TRY</span> <span className="text-[12.5px] text-[var(--ink-3)]">— {i.project_name}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      )}
    </>
  );
}
