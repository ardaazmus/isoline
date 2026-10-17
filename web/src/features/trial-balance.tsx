"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, FileDown, FileUp, Search, Trash2 } from "lucide-react";
import { useI18n } from "@/i18n/provider";
import { sampleTrialBalanceCsv, SAMPLE_TB_FILE } from "@/data/sample-trial-balance";
import { download } from "@/lib/export";
import { importTrialBalance, SHEET_ACCEPT } from "@/lib/spreadsheet";
import {
  fixedAssets,
  GROSS_SALES,
  netSales,
  SALES_DEDUCTIONS,
  tbTotals,
  trialBalanceTemplateCsv,
  type TbAccount,
  type TbIssue,
  type TrialBalance,
} from "@/lib/trial-balance";
import { relDiff } from "@/lib/reconcile";
import { FiguresRow, InputGroup, PageHeader, ToolLayout } from "@/components/shell";
import { SourceNote } from "@/components/figure";
import { GroupRow } from "@/components/data";
import { Button, Callout, StatusMark, cn } from "@/components/ui";
import { Hydrated, SectionTitle, useTool } from "./common";

type Mark = "verified" | "estimated" | "review" | "critical" | "na";

export function TrialBalancePage() {
  return (
    <Hydrated>
      <Inner />
    </Hydrated>
  );
}

function Inner() {
  const { t, fmt, locale } = useI18n();
  const [tb, setTb, client] = useTool("trialBalance");
  const file = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<{ tb: TrialBalance | null; issues: TbIssue[]; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const mn = (v: number) => `${fmt.number(v / 1e6, 1)} ${t("units.mTryShort")}`;

  const ns = tb ? netSales(tb) : null;
  const totals = tb ? tbTotals(tb) : null;
  const result = !tb
    ? t("tb.resultEmpty")
    : ns
      ? t(totals!.movementsBalanced && totals!.balancesBalanced ? "tb.result" : "tb.resultUnbalanced", { file: tb.fileName, n: tb.accounts.length, net: mn(ns.net) })
      : t("tb.resultNoSales", { file: tb.fileName, n: tb.accounts.length });

  const onFile = async (f: File) => {
    setBusy(true);
    try {
      setPreview({ ...(await importTrialBalance(await f.arrayBuffer(), f.name)), name: f.name });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-family="reporting">
      <PageHeader
        title={t("nav.trialBalance")}
        result={result}
        actions={
          <>
            <Button variant="onBand" onClick={() => download("isoline-mizan-sablonu.csv", trialBalanceTemplateCsv(), "text/csv;charset=utf-8")}>
              <FileDown size={15} aria-hidden /> {t("tb.template")}
            </Button>
            <Button variant="onBandPrimary" onClick={() => file.current?.click()} disabled={busy}>
              <FileUp size={15} aria-hidden /> {t("tb.upload")}
            </Button>
          </>
        }
      />
      <input
        ref={file}
        type="file"
        accept={SHEET_ACCEPT}
        className="hidden"
        aria-label={t("tb.upload")}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void onFile(f);
        }}
      />
      <ToolLayout
        family="reporting"
        inputs={
          <>
            <InputGroup title={t("tb.file")}>
              <p className="text-[12.5px] leading-relaxed text-[var(--ink-3)]">{t("tb.fileHint")}</p>
              <div className="flex flex-wrap gap-2">
                <Button variant="quiet" size="sm" onClick={() => file.current?.click()} disabled={busy}>
                  <FileUp size={14} aria-hidden /> {busy ? t("tb.reading") : t("tb.upload")}
                </Button>
                <Button variant="quiet" size="sm" onClick={() => download(SAMPLE_TB_FILE, sampleTrialBalanceCsv(), "text/csv;charset=utf-8")}>
                  <FileDown size={14} aria-hidden /> {t("tb.sample")}
                </Button>
              </div>
              {preview && <Preview preview={preview} replacing={!!tb} onApply={() => { if (preview.tb) setTb(preview.tb); setPreview(null); }} onCancel={() => setPreview(null)} mn={mn} />}
            </InputGroup>
            {tb && (
              <InputGroup title={t("tb.evidence")}>
                <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-[12.5px]">
                  <dt className="text-[var(--ink-3)]">{t("tb.fileName")}</dt>
                  <dd className="truncate font-medium" title={tb.fileName}>{tb.fileName}</dd>
                  {tb.sheet && (
                    <>
                      <dt className="text-[var(--ink-3)]">{t("tb.sheet")}</dt>
                      <dd className="truncate">{tb.sheet}</dd>
                    </>
                  )}
                  <dt className="text-[var(--ink-3)]">{t("tb.rows")}</dt>
                  <dd className="num">{t("tb.rowsValue", { rows: tb.rows, n: tb.accounts.length })}</dd>
                  <dt className="text-[var(--ink-3)]">{t("tb.imported")}</dt>
                  <dd className="num">{fmt.date(tb.importedAt.slice(0, 10))}</dd>
                  <dt className="text-[var(--ink-3)]">SHA-256</dt>
                  <dd className="num break-all text-[11.5px] text-[var(--ink-2)]">{tb.sha256}</dd>
                </dl>
                <p className="text-[12px] leading-relaxed text-[var(--ink-3)]">{t("tb.evidenceHint")}</p>
                {confirmRemove ? (
                  <div className="flex flex-wrap gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setConfirmRemove(false)}>
                      {t("clients.cancel")}
                    </Button>
                    <Button size="sm" className="border border-[var(--crit)] text-[var(--crit)]" onClick={() => { setTb(null); setConfirmRemove(false); }}>
                      {t("tb.removeConfirm")}
                    </Button>
                  </div>
                ) : (
                  <Button variant="ghost" size="sm" className="self-start" onClick={() => setConfirmRemove(true)}>
                    <Trash2 size={14} aria-hidden /> {t("tb.remove")}
                  </Button>
                )}
              </InputGroup>
            )}
          </>
        }
      >
        {!tb || !totals ? (
          <section className="glass sheet flex flex-col gap-3 p-6">
            <SectionTitle>{t("tb.emptyTitle")}</SectionTitle>
            <p className="max-w-[72ch] text-[14px] leading-relaxed text-[var(--ink-2)]">{t("tb.emptyBody")}</p>
            <SourceNote compact meta={{ sources: ["tdhp"] }} />
          </section>
        ) : (
          <>
            <FiguresRow
              pulseKey={tb.sha256}
              items={[
                { label: t("tb.figNet"), value: ns ? mn(ns.net) : "—", note: ns?.closed ? t("tb.figNetClosed") : t("tb.figNetNote"), tone: "fam" },
                { label: t("tb.figGross"), value: ns ? mn(ns.gross) : "—", note: "600 + 601 + 602" },
                { label: t("tb.figDeductions"), value: ns ? mn(ns.deductions) : "—", note: "610 + 611 + 612" },
                {
                  label: t("tb.figBalance"),
                  value: totals.movementsBalanced ? t("tb.balanced") : mn(totals.debit - totals.credit),
                  note: t("tb.figBalanceNote", { debit: mn(totals.debit) }),
                  tone: totals.movementsBalanced ? undefined : "crit",
                },
              ]}
            />
            {ns?.closed && <Callout tone="warn">{t("tb.closedCallout")}</Callout>}
            <Checks tb={tb} reportingYear={client.profile.reportingYear} />
            <Comparison tb={tb} />
            <SalesTable tb={tb} />
            <AssetsTable tb={tb} />
            <AccountsTable tb={tb} />
            <p className="text-[12px] text-[var(--ink-3)]">
              {t("tb.recLink")}{" "}
              <Link href={`/${locale}/reconciliation#rec-U1`} className="inline-flex items-center gap-1 font-medium">
                {t("nav.reconciliation")} <ArrowUpRight size={12} aria-hidden />
              </Link>
            </p>
          </>
        )}
      </ToolLayout>
    </div>
  );
}

function Preview({ preview, replacing, onApply, onCancel, mn }: { preview: { tb: TrialBalance | null; issues: TbIssue[]; name: string }; replacing: boolean; onApply: () => void; onCancel: () => void; mn: (v: number) => string }) {
  const { t } = useI18n();
  const ns = preview.tb ? netSales(preview.tb) : null;
  const totals = preview.tb ? tbTotals(preview.tb) : null;
  return (
    <div className="flex flex-col gap-2 rounded-[12px] border border-[var(--rule)] bg-[var(--glass-strong)] p-3 text-[13px]">
      {preview.tb ? (
        <>
          <p className="font-semibold">{t("tb.preview", { file: preview.name, rows: preview.tb.rows, n: preview.tb.accounts.length })}</p>
          <p className="text-[12.5px] text-[var(--ink-2)]">
            {ns ? t("tb.previewNet", { net: mn(ns.net) }) : t("tb.previewNoSales")} · {totals!.movementsBalanced ? t("tb.balanced") : t("tb.unbalanced")}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" size="sm" onClick={onApply}>
              {replacing ? t("tb.replace") : t("tb.apply")}
            </Button>
            <Button variant="ghost" size="sm" onClick={onCancel}>
              {t("clients.cancel")}
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="font-semibold">{preview.name}</p>
          <ul className="flex flex-col gap-1 text-[12.5px] text-[var(--crit)]">
            {preview.issues.map((i) => (
              <li key={i.key}>{t(`tb.err.${i.key}`, i.vars)}</li>
            ))}
          </ul>
          <Button variant="ghost" size="sm" className="self-start" onClick={onCancel}>
            {t("tb.close")}
          </Button>
        </>
      )}
    </div>
  );
}

function Checks({ tb, reportingYear }: { tb: TrialBalance; reportingYear: number }) {
  const { t, fmt } = useI18n();
  const totals = tbTotals(tb);
  const ns = netSales(tb);
  const mn = (v: number) => `${fmt.number(v / 1e6, 1)} ${t("units.mTryShort")}`;
  const items: { key: string; mark: Mark; status: string; text: string }[] = [
    {
      key: "movements",
      mark: totals.movementsBalanced ? "verified" : "critical",
      status: t(totals.movementsBalanced ? "tb.ok" : "tb.fail"),
      text: t("tb.check.movements", { debit: mn(totals.debit), credit: mn(totals.credit) }),
    },
    {
      key: "balances",
      mark: totals.balancesBalanced ? "verified" : "critical",
      status: t(totals.balancesBalanced ? "tb.ok" : "tb.fail"),
      text: t(tb.balanceSource === "columns" ? "tb.check.balancesColumns" : "tb.check.balancesDerived", { debit: mn(totals.balanceDebit), credit: mn(totals.balanceCredit) }),
    },
    {
      key: "sales",
      mark: !ns ? "critical" : ns.closed ? "review" : "verified",
      status: t(!ns ? "tb.fail" : ns.closed ? "tb.review" : "tb.ok"),
      text: t(!ns ? "tb.check.noSales" : ns.closed ? "tb.check.closed" : "tb.check.open"),
    },
    {
      key: "year",
      mark: tb.year === undefined ? "review" : tb.year === reportingYear ? "verified" : "review",
      status: t(tb.year === reportingYear ? "tb.ok" : "tb.review"),
      text: tb.year === undefined ? t("tb.check.yearUnknown", { year: reportingYear }) : t(tb.year === reportingYear ? "tb.check.yearOk" : "tb.check.yearOff", { year: tb.year, reporting: reportingYear }),
    },
  ];
  return (
    <section className="glass sheet flex min-w-0 flex-col gap-3 p-5 md:p-6">
      <SectionTitle>{t("tb.checksTitle")}</SectionTitle>
      <ul className="divide-y divide-[var(--rule)]">
        {items.map((i) => (
          <li key={i.key} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-2.5">
            <span className="min-w-0 flex-1 text-[14px] leading-relaxed text-[var(--ink)]">{i.text}</span>
            <StatusMark kind={i.mark} label={i.status} />
          </li>
        ))}
      </ul>
      <SourceNote compact meta={{ sources: ["tdhp"] }} />
    </section>
  );
}

/** Net sales from the ledger next to the figures the other tools use; U1 runs the same comparison. */
function Comparison({ tb }: { tb: TrialBalance }) {
  const { t, fmt } = useI18n();
  const [, , client] = useTool("trialBalance");
  const ns = netSales(tb);
  if (!ns) return null;
  const ledger = ns.net / 1e6;
  const tol = client.reconciliation?.tolerances.match ?? 0.005;
  const rows = [
    { key: "anchorSales", value: client.reconciliation?.anchors.netSalesMillionTry ?? null },
    { key: "ghgRevenue", value: client.ghg.revenueMillionTry || null },
    { key: "envRevenue", value: client.indicators.env.revenueMillionTry || null },
    { key: "taxTurnover", value: client.taxonomy.totals.turnover || null },
  ];
  return (
    <section className="glass sheet flex min-w-0 flex-col gap-3 p-5 md:p-6">
      <SectionTitle>{t("tb.compareTitle")}</SectionTitle>
      <p className="max-w-[80ch] text-[13.5px] leading-relaxed text-[var(--ink-2)]">{t("tb.compareHint", { tol: fmt.percent(tol, 1) })}</p>
      <div className="overflow-x-auto">
        <table className="report-table text-[13.5px]">
          <thead>
            <tr>
              <th>{t("tb.col.figure")}</th>
              <th className="r">{t("tb.col.value")}</th>
              <th className="r">{t("tb.col.diff")}</th>
              <th>{t("tb.col.status")}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="font-medium">{t("rec.src.tbSales")}</td>
              <td className="r num font-medium">{fmt.number(ledger, 1)}</td>
              <td className="r num text-[var(--ink-3)]">{t("tb.reference")}</td>
              <td />
            </tr>
            {rows.map((r) => {
              const d = r.value === null ? null : relDiff(r.value, ledger);
              const ok = d !== null && Math.abs(d) <= tol;
              return (
                <tr key={r.key}>
                  <td>{t(`rec.src.${r.key}`)}</td>
                  <td className="r num">{r.value === null ? "—" : fmt.number(r.value, 1)}</td>
                  <td className="r num">{d === null ? "—" : `${d > 0 ? "+" : ""}${fmt.percent(d, 1)}`}</td>
                  <td>{d === null ? <StatusMark kind="na" label={t("rec.status.na")} /> : <StatusMark kind={ok ? "verified" : "critical"} label={t(ok ? "rec.status.pass" : "rec.status.fail")} />}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[12px] text-[var(--ink-3)]">{t("tb.unitNote")}</p>
    </section>
  );
}

function AccountRows({ accounts, signed }: { accounts: TbAccount[]; signed: (a: TbAccount) => number }) {
  const { fmt } = useI18n();
  return (
    <>
      {accounts.map((a) => (
        <tr key={a.code}>
          <td className="num text-[var(--ink-3)]">{a.code}</td>
          <td>{a.name}</td>
          <td className="r num">{fmt.number(signed(a) / 1e6, 1)}</td>
        </tr>
      ))}
    </>
  );
}

function SalesTable({ tb }: { tb: TrialBalance }) {
  const { t, fmt } = useI18n();
  const ns = netSales(tb);
  if (!ns) return null;
  const gross = tb.accounts.filter((a) => GROSS_SALES.includes(a.code));
  const ded = tb.accounts.filter((a) => SALES_DEDUCTIONS.includes(a.code));
  return (
    <section className="glass sheet flex min-w-0 flex-col gap-3 p-5 md:p-6">
      <SectionTitle>{t("tb.salesTitle")}</SectionTitle>
      <div className="overflow-x-auto">
        <table className="report-table text-[13.5px]">
          <thead>
            <tr>
              <th>{t("tb.col.code")}</th>
              <th>{t("tb.col.account")}</th>
              <th className="r">{t("tb.col.mTry")}</th>
            </tr>
          </thead>
          <tbody>
            <GroupRow theme="economy" colSpan={3} title={t("tb.grossGroup")} aside={<span className="num">{fmt.number(ns.gross / 1e6, 1)}</span>} />
            <AccountRows accounts={gross} signed={(a) => (ns.closed ? a.credit : -a.balance)} />
            <GroupRow theme="economy" colSpan={3} title={t("tb.deductionGroup")} aside={<span className="num">{fmt.number(ns.deductions / 1e6, 1)}</span>} />
            <AccountRows accounts={ded} signed={(a) => (ns.closed ? a.debit : a.balance)} />
          </tbody>
          <tfoot>
            <tr>
              <td />
              <td className="font-semibold">{t("tb.figNet")}</td>
              <td className="r num font-semibold">{fmt.number(ns.net / 1e6, 1)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <SourceNote compact meta={{ sources: ["tdhp"] }} />
    </section>
  );
}

function AssetsTable({ tb }: { tb: TrialBalance }) {
  const { t, fmt } = useI18n();
  const fa = fixedAssets(tb);
  if (!fa.byAccount.length) return null;
  return (
    <section className="glass sheet flex min-w-0 flex-col gap-3 p-5 md:p-6">
      <SectionTitle>{t("tb.assetsTitle")}</SectionTitle>
      <div className="overflow-x-auto">
        <table className="report-table text-[13.5px]">
          <thead>
            <tr>
              <th>{t("tb.col.code")}</th>
              <th>{t("tb.col.account")}</th>
              <th className="r">{t("tb.col.mTry")}</th>
            </tr>
          </thead>
          <tbody>
            <AccountRows accounts={fa.byAccount} signed={(a) => a.balance} />
          </tbody>
          <tfoot>
            <tr>
              <td />
              <td className="font-semibold">{t("tb.assetsNet")}</td>
              <td className="r num font-semibold">{fmt.number(fa.net / 1e6, 1)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="max-w-[80ch] text-[12.5px] leading-relaxed text-[var(--ink-3)]">{t("tb.capexNote", { cost: fmt.number(fa.cost / 1e6, 1), construction: fmt.number(fa.construction / 1e6, 1) })}</p>
      <SourceNote compact meta={{ sources: ["tdhp", "taxonomy_2026_73"] }} />
    </section>
  );
}

function AccountsTable({ tb }: { tb: TrialBalance }) {
  const { t, fmt, locale } = useI18n();
  const [q, setQ] = useState("");
  const needle = q.trim().toLocaleLowerCase(locale);
  const rows = needle ? tb.accounts.filter((a) => `${a.code} ${a.name}`.toLocaleLowerCase(locale).includes(needle)) : tb.accounts;
  return (
    <details className="glass sheet group min-w-0 p-5 md:p-6">
      <summary className="cursor-pointer text-[16px] font-semibold text-[var(--ink)]">{t("tb.allTitle", { n: tb.accounts.length })}</summary>
      <div className="mt-4 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Search size={14} aria-hidden className="shrink-0 text-[var(--ink-3)]" />
          <input type="search" className="field-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("tb.search")} aria-label={t("tb.search")} />
        </div>
        <div className="max-h-[420px] overflow-auto">
          <table className="report-table text-[13px]">
            <thead>
              <tr>
                <th>{t("tb.col.code")}</th>
                <th>{t("tb.col.account")}</th>
                <th className="r">{t("tb.col.debit")}</th>
                <th className="r">{t("tb.col.credit")}</th>
                <th className="r">{t("tb.col.balance")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.code}>
                  <td className="num text-[var(--ink-3)]">{a.code}</td>
                  <td>{a.name}</td>
                  <td className="r num">{fmt.number(a.debit / 1e6, 1)}</td>
                  <td className="r num">{fmt.number(a.credit / 1e6, 1)}</td>
                  <td className={cn("r num", a.balance < 0 && "text-[var(--ink-2)]")}>
                    {fmt.number(Math.abs(a.balance) / 1e6, 1)} {a.balance === 0 ? "" : a.balance > 0 ? t("tb.dr") : t("tb.cr")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[12px] text-[var(--ink-3)]">{t("tb.unitNote")}</p>
      </div>
    </details>
  );
}

