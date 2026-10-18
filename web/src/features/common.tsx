"use client";

import { type ReactNode } from "react";
import { Download, RotateCcw } from "lucide-react";
import { useI18n } from "@/i18n/provider";
import { useToday } from "@/lib/dates";
import { lockedBy } from "@/lib/approval";
import { SAMPLE_CLIENT, type ClientData } from "@/data/sample";
import { useActiveClient, useHydrated, useWorkspace, type ToolKey } from "@/store/workspace";
import { download, slug } from "@/lib/export";
import { Button } from "@/components/ui";
import { Loading } from "@/components/shell";

export function useTool<K extends ToolKey>(key: K): [ClientData[K], (v: ClientData[K]) => void, ClientData] {
  const client = useActiveClient();
  const update = useWorkspace((s) => s.update);
  return [client[key], (v) => update(key, v), client];
}

/** Renders children only after the local workspace has loaded. */
export function Hydrated({ children }: { children: ReactNode }) {
  const ok = useHydrated();
  return ok ? <>{children}</> : <Loading />;
}

export function ToolActions<K extends ToolKey>({ tool }: { tool: K }) {
  const { t } = useI18n();
  const [value, set, client] = useTool(tool);
  return (
    <>
      <Button
        variant="onBand"
        onClick={() => {
          const base = client.sample ? SAMPLE_CLIENT[tool] : null;
          if (base) set(structuredClone(base));
        }}
        // a locked (approved) section cannot be reset; the store would refuse the change anyway
        disabled={!client.sample || !!lockedBy(client, tool, SAMPLE_CLIENT[tool])}
        title={t("actions.resetHint")}
      >
        <RotateCcw size={15} aria-hidden />
        {t("actions.reset")}
      </Button>
      <Button
        variant="onBandPrimary"
        onClick={() => download(`${slug(client.name)}-${tool}.json`, JSON.stringify({ app: "isoline", tool, client: client.name, data: value }, null, 2), "application/json")}
      >
        <Download size={15} aria-hidden />
        {t("actions.exportData")}
      </Button>
    </>
  );
}

export function KeyDates({ dates }: { dates: { key: string; date: string }[] }) {
  const { t, fmt } = useI18n();
  const today = useToday() ?? "";
  return (
    <ul className="divide-y divide-[var(--rule)] border-y border-[var(--rule)]">
      {dates.map((d) => (
        <li key={d.key + d.date} className="flex items-baseline justify-between gap-4 py-2 text-[14px]">
          <span className={d.date < today ? "text-[var(--ink-3)] line-through decoration-[var(--rule)]" : "text-[var(--ink)]"}>{t(`dates.${d.key}`)}</span>
          <span className="num shrink-0 font-medium">{fmt.date(d.date)}</span>
        </li>
      ))}
    </ul>
  );
}

export function NoteList({ keys, prefix }: { keys: string[]; prefix: string }) {
  const { t } = useI18n();
  return (
    <ul className="flex flex-col gap-2 text-[14px] leading-relaxed text-[var(--ink-2)]">
      {keys.map((k) => (
        <li key={k} className="flex gap-3">
          <span aria-hidden className="mt-[0.7em] h-px w-3 shrink-0 bg-[var(--ink-3)]" />
          <span>{t(`${prefix}.${k}`)}</span>
        </li>
      ))}
    </ul>
  );
}

export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--rule)] pb-2">
      <h2 className="text-[18px] font-semibold text-[var(--ink)]">{children}</h2>
      {aside}
    </div>
  );
}
