"use client";

import { useRef, useState, type ReactNode } from "react";
import { FileDown, FileSpreadsheet, FileUp } from "lucide-react";
import { useI18n } from "@/i18n/provider";
import { download } from "@/lib/export";
import { SHEET_ACCEPT } from "@/lib/spreadsheet";
import type { ImportRecord } from "@/lib/imports";
import { InputGroup } from "./shell";
import { Button, Callout } from "./ui";

export type Template = { label: string; fileName: string; mime: string; excel?: boolean; make: () => BlobPart | Promise<BlobPart> };

/**
 * Bulk import group for an inputs panel: template downloads, a file picker for Excel, OpenDocument and CSV,
 * the caller's preview, a confirmation once applied and the last import's evidence line (file, date, hash).
 */
export function FileImport({
  title,
  hint,
  templates,
  last,
  done,
  onFile,
  children,
}: {
  title: string;
  hint: string;
  templates: Template[];
  last?: ImportRecord;
  done?: string | null;
  onFile: (f: File) => Promise<void>;
  children?: ReactNode;
}) {
  const { t, fmt } = useI18n();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <InputGroup title={title}>
      <p className="text-[12.5px] leading-snug text-[var(--ink-3)]">{hint}</p>
      <div className="flex flex-wrap gap-2">
        {templates.map((tp) => (
          <Button key={tp.fileName} variant="quiet" size="sm" onClick={async () => download(tp.fileName, await tp.make(), tp.mime)}>
            {tp.excel ? <FileSpreadsheet size={14} aria-hidden /> : <FileDown size={14} aria-hidden />} {tp.label}
          </Button>
        ))}
        <Button variant="quiet" size="sm" disabled={busy} onClick={() => input.current?.click()}>
          <FileUp size={14} aria-hidden /> {busy ? t("imp.reading") : t("imp.upload")}
        </Button>
      </div>
      <input
        ref={input}
        type="file"
        accept={SHEET_ACCEPT}
        className="hidden"
        aria-label={t("imp.upload")}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          setBusy(true);
          try {
            await onFile(f);
          } finally {
            setBusy(false);
          }
        }}
      />
      {done && <Callout>{done}</Callout>}
      {children}
      {last && (
        <p className="text-[11.5px] leading-snug text-[var(--ink-3)]" title={`SHA-256 ${last.sha256}`}>
          {t("imp.last", { file: last.fileName, date: fmt.date(last.importedAt.slice(0, 10)), n: last.applied })} · SHA-256 <span className="num">{last.sha256.slice(0, 12)}…</span>
        </p>
      )}
    </InputGroup>
  );
}

/** Preview panel of the bulk import pattern (DESIGN.md: Bulk Data Import). */
export function ImportPreview({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-2 rounded-[12px] border border-[var(--rule)] bg-[var(--glass-strong)] p-3 text-[13px]">{children}</div>;
}

export function IssueList({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <ul className="flex max-h-32 flex-col gap-1 overflow-y-auto text-[12.5px] text-[var(--crit)]">
      {items.map((x, k) => (
        <li key={k}>{x}</li>
      ))}
    </ul>
  );
}
