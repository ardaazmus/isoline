"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Braces, FileDown } from "lucide-react";
import { useI18n } from "@/i18n/provider";
import { NAV } from "@/data/nav";
import { computeInventory } from "@/lib/calc/ghg";
import { parseNumber } from "@/lib/inventory-csv";
import { download, downloadCsv, slug } from "@/lib/export";
import {
  emptyReconciliation,
  ENGINE_VERSION,
  reconcile,
  reconcileRecords,
  RULES,
  yoyValues,
  type Check,
  type CheckStatus,
  type Reconciliation,
  type RuleResult,
  type Tolerances,
  type Unit,
} from "@/lib/reconcile";
import { FiguresRow, InputGroup, PageHeader, ToolLayout } from "@/components/shell";
import { SourceNote } from "@/components/figure";
import { Button, Callout, NumberField, StatusMark, cn } from "@/components/ui";
import { useActiveClient } from "@/store/workspace";
import { Hydrated, useTool } from "./common";
import { ApprovalBar, useApproval } from "./approval";
import { SourceNotes } from "./source-notes";
import { todayLocal } from "@/lib/dates";

const MARK: Record<CheckStatus, "verified" | "estimated" | "review" | "critical" | "na"> = { pass: "verified", explained: "estimated", warn: "review", fail: "critical", na: "na" };
const REL: Record<string, string> = { eq: "≈", lte: "≤", gte: "≥" };
const TOLERANCE_KEYS: (keyof Tolerances)[] = ["match", "near", "yoy", "estimated"];
const navHref = (id: string) => NAV.flatMap((g) => g.items).find((i) => i.id === id)?.href ?? "";

export function ReconciliationPage() {
  return (
    <Hydrated>
      <Inner />
    </Hydrated>
  );
}

function useValue() {
  const { t, fmt } = useI18n();
  return (v: number, unit: Unit) => {
    if (unit === "share") return fmt.percent(v, 1);
    if (unit === "rate") return fmt.number(v, 2);
    if (unit === "count") return fmt.number(v);
    return `${fmt.number(v, v !== 0 && Math.abs(v) < 10 ? 2 : 0)} ${t(`rec.unit.${unit}`)}`;
  };
}

function Inner() {
  const { t, fmt } = useI18n();
  const { locked } = useApproval("reconciliation");
  const [stored, setRec, client] = useTool("reconciliation");
  const rec = stored ?? emptyReconciliation();
  const result = reconcile(client);
  const { counts } = result;
  const patch = (p: Partial<Reconciliation>) => setRec({ ...rec, ...p });
  const setNote = (id: string, v: string) => {
    const notes = { ...rec.notes };
    if (v) notes[id] = v;
    else delete notes[id];
    patch({ notes });
  };
  const open = counts.fail + counts.warn;
  // Explanations close single findings, so they are counted per check rather than per rule.
  const explained = result.rules.flatMap((r) => r.checks).filter((k) => k.status === "explained").length;

  const exportCsv = () => {
    const rows = reconcileRecords(result).map((x) => [
      x.rule,
      t(`rec.severity.${x.severity}`),
      x.check,
      t(`rec.status.${x.status}`),
      t(`rec.src.${x.a}`),
      x.aValue,
      x.b ? t(`rec.src.${x.b}`) : "",
      x.bValue ?? "",
      x.diff === null || !Number.isFinite(x.diff) ? "" : x.diff,
      x.tolerance ?? "",
      x.note,
      x.items,
    ]);
    downloadCsv(`${slug(client.name)}-uzlastirma.csv`, TABLE_HEAD.map((h) => t(`rec.csv.${h}`)), rows);
  };
  const exportJson = () =>
    download(
      `${slug(client.name)}-uzlastirma.json`,
      JSON.stringify({ app: "isoline", engine: ENGINE_VERSION, client: client.name, reportingYear: client.profile.reportingYear, runAt: new Date().toISOString(), tolerances: rec.tolerances, results: reconcileRecords(result) }, null, 2),
      "application/json",
    );

  return (
    <div data-family="reporting">
      <PageHeader
        title={t("nav.reconciliation")}
        result={open ? t("rec.result", { fail: counts.fail, warn: counts.warn, explained, pass: counts.pass + counts.explained, na: counts.na }) : t("rec.resultClean", { pass: counts.pass + counts.explained, na: counts.na })}
        actions={
          <>
            <Button variant="onBand" onClick={exportJson}>
              <Braces size={15} aria-hidden /> JSON
            </Button>
            <Button variant="onBandPrimary" onClick={exportCsv}>
              <FileDown size={15} aria-hidden /> {t("rec.export")}
            </Button>
          </>
        }
      />
      <ApprovalBar section="reconciliation" />
      <ToolLayout
        notes={<SourceNotes section="reconciliation" />}
        locked={locked}
        family="reporting"
        inputs={
          <>
            <InputGroup title={t("rec.anchors")}>
              <NumberField
                label={t("rec.netSales")}
                unit={t("units.mTryShort")}
                hint={t("rec.netSalesHint")}
                nullable
                min={0}
                value={rec.anchors.netSalesMillionTry ?? NaN}
                onChange={(v) => patch({ anchors: { ...rec.anchors, netSalesMillionTry: Number.isFinite(v) ? v : null } })}
              />
              <NumberField
                label={t("rec.headcount")}
                unit={t("rec.unit.people")}
                hint={t("rec.headcountHint")}
                nullable
                min={0}
                value={rec.anchors.headcount ?? NaN}
                onChange={(v) => patch({ anchors: { ...rec.anchors, headcount: Number.isFinite(v) ? v : null } })}
              />
            </InputGroup>
            <InputGroup title={t("rec.tolerances")}>
              {TOLERANCE_KEYS.map((k) => (
                <NumberField key={k} label={t(`rec.tol.${k}`)} hint={t(`rec.tol.${k}Hint`)} percent min={0} max={1} value={rec.tolerances[k]} onChange={(v) => patch({ tolerances: { ...rec.tolerances, [k]: v } })} />
              ))}
            </InputGroup>
            <p className="text-[12.5px] leading-relaxed text-[var(--ink-3)]">{t("rec.later")}</p>
          </>
        }
      >
        <FiguresRow
          pulseKey={`${counts.fail}-${counts.warn}-${counts.explained}`}
          items={[
            { label: t("rec.figOpen"), value: String(open), note: t("rec.figOpenNote", { n: RULES.length }), tone: "fam" },
            { label: t("rec.status.fail"), value: String(counts.fail), note: t("rec.figFailNote"), tone: counts.fail ? "crit" : undefined },
            { label: t("rec.status.warn"), value: String(counts.warn), note: t("rec.figWarnNote") },
            { label: t("rec.figResolved"), value: String(counts.pass + counts.explained), note: t("rec.figResolvedNote", { n: explained }) },
          ]}
        />
        <Callout>{t("rec.intro")}</Callout>
        <nav aria-label={t("rec.map")} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {result.rules.map((r) => (
            <a key={r.id} href={`#rec-${r.id}`} className={cn("glass flex min-w-0 flex-col gap-1.5 p-3.5 no-underline transition-colors hover:border-[var(--b-300)]", r.status === "na" && "opacity-70")}>
              <span className="num text-[12px] font-semibold text-[var(--accent-ink)]">{r.id}</span>
              <span className="line-clamp-2 text-[13.5px] font-semibold leading-snug text-[var(--ink)]">{t(`rec.rules.${r.id}.title`)}</span>
              <StatusMark kind={MARK[r.status]} label={t(`rec.status.${r.status}`)} />
            </a>
          ))}
        </nav>
        {/* explanations and prior-year values are data too: an approved section keeps them read-only */}
        <fieldset disabled={locked} className="m-0 flex min-w-0 flex-col gap-6 border-0 p-0">
          {result.rules.map((r) => (
            <RuleCard key={r.id} rule={r} rec={rec} onNote={setNote} onPrior={(m, v) => {
              const prior = { ...rec.prior };
              if (v === undefined) delete prior[m];
              else prior[m] = v;
              patch({ prior });
            }} />
          ))}
        </fieldset>
        <p className="text-[12px] text-[var(--ink-3)]">{t("rec.engine", { engine: ENGINE_VERSION, date: fmt.date(todayLocal()) })}</p>
      </ToolLayout>
    </div>
  );
}

const TABLE_HEAD = ["rule", "severity", "check", "status", "a", "aValue", "b", "bValue", "diff", "tolerance", "note", "items"];

type PriorSetter = (m: NonNullable<Check["metric"]>, v: number | undefined) => void;

function RuleCard({ rule, rec, onNote, onPrior }: { rule: RuleResult; rec: Reconciliation; onNote: (id: string, v: string) => void; onPrior: PriorSetter }) {
  const { t, locale } = useI18n();
  const def = RULES.find((d) => d.id === rule.id)!;
  const allNa = rule.status === "na";
  return (
    <article id={`rec-${rule.id}`} className="glass sheet flex min-w-0 scroll-mt-24 flex-col gap-4 p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-baseline gap-3">
          <span className="num rounded-full bg-[var(--b-100)] px-2.5 py-0.5 text-[12.5px] font-semibold text-[var(--accent-ink)]">{rule.id}</span>
          <h2 className="text-[18px] font-semibold leading-snug">{t(`rec.rules.${rule.id}.title`)}</h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[12px] text-[var(--ink-3)]">{t(`rec.severity.${rule.severity}`)}</span>
          <StatusMark kind={MARK[rule.status]} label={t(`rec.status.${rule.status}`)} />
        </div>
      </div>
      <p className="max-w-[80ch] text-[14px] leading-relaxed text-[var(--ink-2)]">{t(`rec.rules.${rule.id}.why`)}</p>
      {rule.id === "U8" ? (
        <YoyTable rule={rule} rec={rec} onNote={onNote} onPrior={onPrior} />
      ) : allNa ? (
        <p className="rounded-[12px] border border-dashed border-[var(--rule)] px-4 py-3 text-[13.5px] text-[var(--ink-3)]">{t(`rec.rules.${rule.id}.na`)}</p>
      ) : (
        <ChecksTable rule={rule} />
      )}
      {rule.id !== "U8" &&
        rule.checks
          .filter((k) => k.status === "warn" || k.status === "fail" || k.status === "explained" || rec.notes[k.id])
          .map((k) => <NoteField key={k.id} check={k} value={rec.notes[k.id] ?? ""} onChange={(v) => onNote(k.id, v)} />)}
      <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
        <span className="text-[var(--ink-3)]">{t("rec.tools")}</span>
        {def.tools.map((id) => (
          <Link key={id} href={`/${locale}${navHref(id)}`} className="inline-flex items-center gap-1 rounded-full border border-[var(--rule)] bg-[var(--glass-strong)] px-2.5 py-0.5 font-medium text-[var(--ink-2)] no-underline hover:border-[var(--b-300)] hover:text-[var(--accent-ink)]">
            {t(`nav.${id}`)} <ArrowUpRight size={12} aria-hidden />
          </Link>
        ))}
      </div>
      <SourceNote compact meta={{ sources: def.basis }} />
    </article>
  );
}

function DiffCell({ check }: { check: Check }) {
  const { t, fmt } = useI18n();
  if (check.diff === undefined || !Number.isFinite(check.diff)) return <td className="r num text-[var(--ink-3)]">—</td>;
  const sign = check.diff > 0 ? "+" : "";
  return (
    <td className="r num whitespace-nowrap">
      {sign}
      {fmt.percent(check.diff, 1)}
      {check.tolerance !== undefined && <span className="block text-[11.5px] font-normal text-[var(--ink-3)]">{t("rec.tolerance", { v: fmt.percent(check.tolerance, 1) })}</span>}
    </td>
  );
}

function ChecksTable({ rule }: { rule: RuleResult }) {
  const { t } = useI18n();
  const value = useValue();
  return (
    <div className="overflow-x-auto">
      <table className="report-table text-[13.5px]">
        <thead>
          <tr>
            <th>{t("rec.col.a")}</th>
            <th aria-label={t("rec.col.rel")} />
            <th>{t("rec.col.b")}</th>
            <th className="r">{t("rec.col.diff")}</th>
            <th>{t("rec.col.status")}</th>
          </tr>
        </thead>
        <tbody>
          {rule.checks.map((k) => (
            <tr key={k.id}>
              <td>
                <span className="block text-[12px] text-[var(--ink-3)]">{t(`rec.src.${k.a.src}`)}</span>
                <span className="num font-medium">{k.status === "na" ? "—" : value(k.a.value, k.unit)}</span>
                {k.items && k.items.length > 0 && (
                  <span className="mt-1 flex flex-wrap gap-1">
                    {k.items.map((x) => (
                      <span key={x} className="rounded-full border border-[var(--rule)] bg-[var(--glass-strong)] px-2 py-px text-[12px]">
                        {x}
                      </span>
                    ))}
                  </span>
                )}
              </td>
              <td className="num text-center text-[15px] text-[var(--ink-3)]">{REL[k.rel] ?? ""}</td>
              <td>
                {k.b && (
                  <>
                    <span className="block text-[12px] text-[var(--ink-3)]">{t(`rec.src.${k.b.src}`)}</span>
                    <span className="num font-medium">{value(k.b.value, k.unit)}</span>
                  </>
                )}
              </td>
              <DiffCell check={k} />
              <td>
                <StatusMark kind={MARK[k.status]} label={t(`rec.status.${k.status}`)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function YoyTable({ rule, rec, onNote, onPrior }: { rule: RuleResult; rec: Reconciliation; onNote: (id: string, v: string) => void; onPrior: PriorSetter }) {
  const { t } = useI18n();
  const value = useValue();
  const client = useActiveClient();
  const inv = computeInventory(client.ghg);
  return (
    <div className="overflow-x-auto">
      <table className="report-table text-[13.5px]">
        <thead>
          <tr>
            <th>{t("rec.col.metric")}</th>
            <th className="r">{t("rec.col.current")}</th>
            <th className="r">{t("rec.col.prior")}</th>
            <th className="r">{t("rec.col.change")}</th>
            <th>{t("rec.col.status")}</th>
          </tr>
        </thead>
        <tbody>
          {rule.checks.map((k) => {
            const m = k.metric!;
            const { prior, auto } = yoyValues(client, inv, rec, m);
            const needsNote = k.status === "warn" || k.status === "explained" || !!rec.notes[k.id];
            return [
              <tr key={k.id}>
                <td className="font-medium">{t(`rec.metric.${m}`)}</td>
                <td className="r num">{value(k.a.value, k.unit)}</td>
                <td className="r">
                  <PriorInput label={t("rec.priorOf", { metric: t(`rec.metric.${m}`) })} own={rec.prior[m]} fallback={auto ? prior : undefined} onChange={(v) => onPrior(m, v)} />
                  {auto && <span className="block text-[11px] text-[var(--ink-3)]">{t("rec.autoPrior")}</span>}
                </td>
                <DiffCell check={k} />
                <td>
                  <StatusMark kind={MARK[k.status]} label={t(`rec.status.${k.status}`)} />
                </td>
              </tr>,
              needsNote && (
                <tr key={`${k.id}-note`}>
                  <td colSpan={5} className="pt-0">
                    <NoteField check={k} value={rec.notes[k.id] ?? ""} onChange={(v) => onNote(k.id, v)} />
                  </td>
                </tr>
              ),
            ];
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Prior-year value typed in place; empty falls back to the value the app already holds. */
function PriorInput({ label, own, fallback, onChange }: { label: string; own: number | undefined; fallback: number | undefined; onChange: (v: number | undefined) => void }) {
  const { fmt } = useI18n();
  const [draft, setDraft] = useState<string | null>(null);
  const raw = own === undefined ? "" : String(own);
  const shown = own === undefined ? "" : fmt.number(own, own < 10 ? 2 : 0);
  const parsed = draft === null ? NaN : parseNumber(draft);
  return (
    <input
      inputMode="decimal"
      aria-label={label}
      className="field-input num ml-auto h-8 w-36 text-right"
      placeholder={fallback === undefined ? "—" : fmt.number(fallback, fallback < 10 ? 2 : 0)}
      value={draft ?? shown}
      aria-invalid={draft !== null && draft.trim() !== "" && !(parsed >= 0)}
      onFocus={() => setDraft(raw)}
      onChange={(e) => {
        setDraft(e.target.value);
        if (e.target.value.trim() === "") return onChange(undefined);
        const n = parseNumber(e.target.value);
        if (n >= 0) onChange(n);
      }}
      onBlur={() => setDraft(null)}
    />
  );
}

function NoteField({ check, value, onChange }: { check: Check; value: string; onChange: (v: string) => void }) {
  const { t } = useI18n();
  const id = `note-${check.id}`;
  const subject = check.metric ? t(`rec.metric.${check.metric}`) : t(`rec.src.${check.a.src}`);
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-[12.5px] font-medium text-[var(--ink-2)]">
        {t("rec.note", { subject })}
      </label>
      <textarea
        id={id}
        rows={2}
        className="field-input min-h-[60px] resize-y text-[13.5px] leading-relaxed"
        value={value}
        placeholder={t(check.status === "fail" ? "rec.notePlaceholderFail" : "rec.notePlaceholderWarn")}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
