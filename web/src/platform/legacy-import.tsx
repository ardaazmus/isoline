"use client";

/** G1-11 screen: preview a toolkit workspace file, then apply it; nothing is written before the preview is seen. */
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FileJson } from "lucide-react";
import { useI18n } from "@/i18n/provider";
import { Button } from "@/components/ui";
import { api } from "./client";
import { Badge, Check, ErrorNote, OkNote, Table, Td } from "./ui";

type ClientReport = {
  legacyId: string;
  name: string;
  sample: boolean;
  reportingYear: number | null;
  projectName: string;
  evidencePlaceholders: number;
  unverifiedApprovals: string[];
  ownerLabels: number;
  sites: number;
  totals: { scope1: number; scope2Location: number; scope2Market: number } | null;
  trialBalance: { accounts: number; balanced: boolean } | null;
  warnings: string[];
};
type Report = { sourceSha256: string; sourceVersion: number; clients: ClientReport[]; customFactorSets: { name: string }[]; counts: Record<string, number>; alreadyAppliedId?: string | null };

export function LegacyImport({ advisory }: { advisory: boolean }) {
  const { t, fmt } = useI18n();
  const router = useRouter();
  const [file, setFile] = useState<{ name: string; content: string } | null>(null);
  const [mode, setMode] = useState<"own" | "provisional">(advisory ? "provisional" : "own");
  const [includeSample, setIncludeSample] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<number | null>(null);

  const body = () => ({ content: file!.content, fileName: file!.name, mode, includeSample });
  const shown = report ? report.clients.filter((c) => includeSample || !c.sample) : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <label htmlFor="legacy-file" className="text-[13px] font-medium text-[var(--ink-2)]">
            {t("pf.import.file")}
          </label>
          <input
            id="legacy-file"
            type="file"
            accept=".json,application/json"
            className="field-input"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              setReport(null);
              setDone(null);
              setError(null);
              if (!f) return setFile(null);
              if (f.size > 20 * 1024 * 1024) return setError("file_too_large");
              setFile({ name: f.name, content: await f.text() });
            }}
          />
          <p className="text-[12px] text-[var(--ink-3)]">{t("pf.import.fileHint")}</p>
        </div>
        {advisory && (
          <fieldset className="flex flex-col gap-1.5 text-[13px]">
            <legend className="mb-1 font-medium text-[var(--ink-2)]">{t("pf.import.mode")}</legend>
            {(["provisional", "own"] as const).map((m) => (
              <label key={m} className="flex items-center gap-2">
                <input type="radio" name="legacy-mode" checked={mode === m} onChange={() => setMode(m)} className="accent-[var(--b-600)]" />
                {t(`pf.import.modes.${m}`)}
              </label>
            ))}
          </fieldset>
        )}
        <Button
          variant="primary"
          disabled={!file || busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            const r = await api<Report>("POST", "/api/v1/imports/preview", body());
            setBusy(false);
            if (!r.ok) return setError(r.code);
            setReport(r.data);
          }}
        >
          <FileJson size={15} aria-hidden />
          {t("pf.import.preview")}
        </Button>
      </div>
      <ErrorNote code={error} />
      {done !== null && <OkNote>{t("pf.import.applied", { n: done })}</OkNote>}

      {report && done === null && (
        <div className="flex flex-col gap-4">
          {report.alreadyAppliedId && <ErrorNote code="import_already_applied" />}
          <p className="text-[13px] text-[var(--ink-2)]">
            {t("pf.import.summary", { version: report.sourceVersion, n: shown.length, ph: shown.reduce((s, c) => s + c.evidencePlaceholders, 0), ap: shown.reduce((s, c) => s + c.unverifiedApprovals.length, 0) })} <code className="text-[11.5px] text-[var(--ink-3)]">SHA-256 {report.sourceSha256.slice(0, 16)}…</code>
          </p>
          <Table head={[t("pf.import.client"), t("pf.import.project"), t("pf.import.ghg"), t("pf.import.evidence"), t("pf.import.notes")]}>
            {report.clients.map((c) => (
              <tr key={c.legacyId} className={!includeSample && c.sample ? "opacity-45" : undefined}>
                <Td>
                  {c.name} {c.sample && <Badge tone="warn">{t("shell.sample")}</Badge>}
                </Td>
                <Td>{c.projectName}</Td>
                <Td className="whitespace-nowrap text-[12.5px]">{c.totals ? `S1 ${fmt.number(c.totals.scope1, 1)} · S2 ${fmt.number(c.totals.scope2Location, 1)} tCO₂e` : "—"}</Td>
                <Td>{c.evidencePlaceholders}</Td>
                <Td className="text-[12.5px]">
                  <ul className="flex flex-col gap-0.5">
                    {c.unverifiedApprovals.length > 0 && <li>{t("pf.import.unverified", { n: c.unverifiedApprovals.length })}</li>}
                    {c.ownerLabels > 0 && <li>{t("pf.import.ownerLabels", { n: c.ownerLabels })}</li>}
                    {c.sites > 0 && <li>{t("pf.import.sites", { n: c.sites })}</li>}
                    {c.warnings.filter((w) => w !== "sample_client").map((w) => (
                      <li key={w} className="text-[var(--warn)]">
                        {t(`pf.import.warn.${w}`)}
                      </li>
                    ))}
                  </ul>
                </Td>
              </tr>
            ))}
          </Table>
          {report.customFactorSets.length > 0 && <p className="text-[12.5px] text-[var(--ink-2)]">{t("pf.import.factorSets", { n: report.customFactorSets.length })}</p>}
          {report.clients.some((c) => c.sample) && <Check id="legacy-sample" checked={includeSample} onChange={setIncludeSample} label={t("pf.import.includeSample")} />}
          <p className="rounded-[12px] bg-[var(--b-50)] px-3 py-2 text-[12.5px] leading-relaxed text-[var(--b-800)]">{t("pf.import.rules")}</p>
          <div>
            <Button
              variant="primary"
              disabled={busy || !!report.alreadyAppliedId || shown.length === 0}
              onClick={async () => {
                setBusy(true);
                setError(null);
                const r = await api<{ projects: unknown[] }>("POST", "/api/v1/imports", body());
                setBusy(false);
                if (!r.ok) return setError(r.code);
                setDone(r.data.projects.length);
                router.refresh();
              }}
            >
              {t("pf.import.apply", { n: shown.length })}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function RollbackImport({ id }: { id: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col gap-1">
      <Button
        size="sm"
        onClick={async () => {
          if (!window.confirm(t("pf.import.rollbackConfirm"))) return;
          const r = await api("POST", `/api/v1/imports/${id}/rollback`);
          if (!r.ok) return setError(r.code);
          router.refresh();
        }}
      >
        {t("pf.import.rollback")}
      </Button>
      <ErrorNote code={error} />
    </span>
  );
}
