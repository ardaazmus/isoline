import Link from "next/link";
import { Badge, PageTitle, Section, StateBox, Table, Td } from "@/platform/ui";
import { dateOnly, titled, tr } from "@/platform/server";
import { requireWorkspace } from "@/server/http/dal";
import { portfolio } from "@/server/projects/service";
import { portfolioKpis } from "@/server/portfolio/kpis";
import { STEP_PAGES } from "@/server/cycle/steps";
import { numberFormat } from "@/lib/intl";

export const generateMetadata = titled("pf.portfolio.title");

/**
 * PORT-01 / G2-09: every project this workspace may see — own, prepared for provisional clients, opened by
 * customers — with the current cycle, the next due work package and what is late or blocked. Facts only; no scores.
 */
export default async function PortfolioPage({
  params,
}: PageProps<"/[lang]/app/portfolio">) {
  const { lang } = await params;
  const t = tr(lang);
  const ws = await requireWorkspace(lang);
  const [rows, kpis] = await Promise.all([
    portfolio(ws.actor),
    portfolioKpis(ws.actor),
  ]);
  const pct = (v: number | null) =>
    v === null
      ? "—"
      : numberFormat(lang, {
          style: "percent",
          maximumFractionDigits: 0,
        }).format(v);
  const late = rows.reduce((s, r) => s + r.late, 0);
  const blocked = rows.reduce((s, r) => s + r.blocked, 0);
  const clients = new Set(rows.map((r) => r.owner_tenant_id)).size;
  return (
    <>
      <PageTitle
        title={t("pf.portfolio.title")}
        lead={t("pf.portfolio.lead")}
        actions={
          <Link
            href={`/${lang}/app/projects/new`}
            className="inline-flex h-10 items-center rounded-[12px] bg-[var(--b-600)] px-4 text-[14px] font-semibold text-white no-underline"
          >
            {t("pf.wizard.title")}
          </Link>
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: t("pf.portfolio.clients"), value: clients },
          { label: t("pf.portfolio.projects"), value: rows.length },
          { label: t("pf.portfolio.late"), value: late },
          { label: t("pf.portfolio.blocked"), value: blocked },
        ].map((f) => (
          <div key={f.label} className="glass flex flex-col gap-1 p-4">
            <span className="text-[12.5px] font-medium text-[var(--ink-3)]">
              {f.label}
            </span>
            <span className="figure-num text-[28px]">{f.value}</span>
          </div>
        ))}
      </div>
      <Section title={t("pf.portfolio.table")}>
        {rows.length === 0 ? (
          <StateBox state="empty" title={t("pf.projects.emptyTitle")}>
            {t("pf.projects.emptyLead")}
          </StateBox>
        ) : (
          <Table
            head={[
              t("pf.portfolio.client"),
              t("pf.projects.name"),
              t("pf.portfolio.cycle"),
              t("pf.portfolio.next"),
              t("pf.portfolio.issues"),
              t("pf.portfolio.ops"),
              t("pf.projects.accessCol"),
            ]}
          >
            {rows.map((r) => {
              const k = kpis.find((x) => x.projectId === r.id);
              return (
                <tr key={r.id}>
                  <Td>
                    {r.owner_name}{" "}
                    {r.owner_lifecycle === "provisional" && (
                      <Badge tone="warn">{t("pf.lifecycle.provisional")}</Badge>
                    )}
                  </Td>
                  <Td>
                    <Link
                      href={`/${lang}/app/projects/${r.id}`}
                      className="font-medium text-[var(--b-700)]"
                    >
                      {r.name}
                    </Link>
                  </Td>
                  <Td>{r.cycle ? r.cycle.label : "—"}</Td>
                  <Td className="text-[12.5px]">
                    {r.next ? (
                      <>
                        <Link href={`/${lang}/app/projects/${r.id}/${STEP_PAGES[r.next.step][0]}`} className="font-semibold text-[var(--b-700)]">
                          {t(`pf.steps.name.${r.next.step}`)}
                        </Link>{" "}
                        · {t(`pf.steps.state.${r.next.state}`)}
                        <span className="block text-[var(--ink-3)]">{t(`pf.steps.summary.${r.next.step}.${r.next.summary}`, r.next.vars)}</span>
                        {r.next.dueOn && <span className={r.next.late ? "block font-semibold text-[var(--crit)]" : "block text-[var(--ink-2)]"}>{t("pf.steps.due", { date: dateOnly(lang, r.next.dueOn) })}</span>}
                      </>
                    ) : r.current === "complete" ? (
                      <Badge tone="ok">{t("pf.steps.complete")}</Badge>
                    ) : (
                      "—"
                    )}
                  </Td>
                  <Td>
                    <span className="flex flex-wrap gap-1">
                      {r.late > 0 && (
                        <Badge tone="crit">
                          {t("pf.portfolio.lateN", { n: r.late })}
                        </Badge>
                      )}
                      {r.blocked > 0 && (
                        <Badge tone="warn">
                          {t("pf.portfolio.blockedN", { n: r.blocked })}
                        </Badge>
                      )}
                      {r.late === 0 && r.blocked === 0 && (
                        <span className="text-[12.5px] text-[var(--ink-3)]">
                          —
                        </span>
                      )}
                    </span>
                  </Td>
                  <Td className="text-[12px] leading-relaxed">
                    {k ? (
                      <>
                        {t("pf.portfolio.collection", {
                          a: k.requests.accepted + k.requests.closed,
                          n: k.requests.total,
                        })}{" "}
                        ·{" "}
                        {t("pf.portfolio.evidence", { p: pct(k.evidenceRate) })}
                        <br />
                        {k.requests.overdue > 0 && (
                          <Badge tone="crit">
                            {t("pf.portfolio.overdueN", {
                              n: k.requests.overdue,
                            })}
                          </Badge>
                        )}{" "}
                        {k.blockers > 0 && (
                          <Badge tone="crit">
                            {t("pf.portfolio.blockersN", { n: k.blockers })}
                          </Badge>
                        )}{" "}
                        {k.inReview > 0 && (
                          <Badge tone="info">
                            {t("pf.portfolio.reviewN", { n: k.inReview })}
                          </Badge>
                        )}{" "}
                        {t("pf.portfolio.reports", {
                          r: k.reports.released,
                          n: k.reports.total,
                        })}
                      </>
                    ) : (
                      "—"
                    )}
                  </Td>
                  <Td className="text-[12.5px]">
                    {r.access === "grant" ? (
                      <>
                        {t("pf.access.grantAs", {
                          role: t(`pf.grantRole.${r.grantRole}`),
                        })}
                        {r.grantExpires && (
                          <span className="block text-[var(--ink-3)]">
                            {t("pf.grants.until", {
                              date: dateOnly(lang, r.grantExpires),
                            })}
                          </span>
                        )}
                      </>
                    ) : r.access === "steward" ? (
                      t("pf.access.steward")
                    ) : (
                      t("pf.access.member")
                    )}
                  </Td>
                </tr>
              );
            })}
          </Table>
        )}
      </Section>
    </>
  );
}
