"use client";

/**
 * Library → quick calculation (UX Faz 3). The toolkit's calculators run here as a browser-only sandbox on a scratch
 * workspace of their own; nothing is a record until "Save to cycle" turns the inputs into drafts of the person's
 * own data requests, which then go through evidence, submission and review like any entry.
 */
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { FlaskConical } from "lucide-react";
import { useI18n } from "@/i18n/provider";
import { Button } from "@/components/ui";
import { useActiveClient, useHydrated, useWorkspace } from "@/store/workspace";
import { QuickMode } from "@/features/quick";
import { Hydrated } from "@/features/common";
import { GhgTool } from "@/features/ghg";
import { CbamTool } from "@/features/cbam";
import { EtsTool } from "@/features/ets";
import { PathwayTool } from "@/features/pathway";
import { EnvironmentTool, TaxonomyTool, WorkforceTool } from "@/features/indicators";
import { MaterialityTool } from "@/features/materiality";
import { ApplicabilityTool } from "@/features/applicability";
import { ClaimsTool } from "@/features/claims";
import { RegulationsPage } from "@/features/regulations";
import { CrosswalkPage } from "@/features/crosswalk";
import { ThemesPage } from "@/features/themes";
import { environmentDrafts, ghgDrafts, type QuickDraft } from "@/lib/quick-drafts";
import { api } from "../client";
import { QUICK_TOOLS, type LibraryPage, type QuickTool } from "./quick-tools";
import { Badge, ErrorNote, OkNote } from "../ui";

/** The scratch workspace's fixed name: one per browser, whatever the language. */
export const QUICK_CLIENT = "Hızlı hesap (bu tarayıcı)";


const TOOL: Record<QuickTool | LibraryPage, () => ReactNode> = {
  ghg: () => <GhgTool />,
  environment: () => <EnvironmentTool />,
  workforce: () => <WorkforceTool />,
  taxonomy: () => <TaxonomyTool />,
  materiality: () => <MaterialityTool />,
  cbam: () => <CbamTool />,
  ets: () => <EtsTool />,
  pathway: () => <PathwayTool />,
  applicability: () => <ApplicabilityTool />,
  claims: () => <ClaimsTool />,
  regulations: () => <RegulationsPage />,
  crosswalk: () => <CrosswalkPage />,
  themes: () => <ThemesPage />,
};

/** Makes the scratch workspace the active one in this browser (created on first use). */
function useScratch(): boolean {
  const hydrated = useHydrated();
  const clients = useWorkspace((s) => s.clients);
  const activeId = useWorkspace((s) => s.activeId);
  const addClient = useWorkspace((s) => s.addClient);
  const setActive = useWorkspace((s) => s.setActive);
  const scratch = clients.find((c) => c.name === QUICK_CLIENT);
  useEffect(() => {
    if (!hydrated) return;
    if (!scratch) addClient(QUICK_CLIENT);
    else if (activeId !== scratch.id) setActive(scratch.id);
  }, [hydrated, scratch, activeId, addClient, setActive]);
  return hydrated && !!scratch && activeId === scratch.id;
}

export function QuickView({ page, lang, canSave }: { page: QuickTool | LibraryPage; lang: string; canSave: boolean }) {
  const { t } = useI18n();
  const ready = useScratch();
  const isTool = (QUICK_TOOLS as readonly string[]).includes(page);
  return (
    <QuickMode>
      {isTool && (
        <div role="note" className="glass mb-5 flex items-start gap-3 rounded-[16px] px-4 py-3 text-[13.5px] leading-snug text-[var(--ink-2)]">
          <FlaskConical size={17} aria-hidden className="mt-[2px] shrink-0 text-[var(--b-700)]" />
          <span>{t("pf.quick.notice")}</span>
        </div>
      )}
      {ready ? <Hydrated>{TOOL[page]()}</Hydrated> : <p className="glass p-8 text-[var(--ink-3)]">{t("shell.loading")}</p>}
      {ready && canSave && (page === "ghg" || page === "environment") && <SaveToCycle tool={page} lang={lang} />}
    </QuickMode>
  );
}

type Target = { id: string; metric_code: string; status: string; due_on: string | null; period_label: string; project_name: string; cycle_label: string; facility_name: string | null };

function describe(d: QuickDraft, fmt: ReturnType<typeof useI18n>["fmt"]): string {
  if (d.lines) return d.lines.map((l) => `${l.key}: ${fmt.number(l.value, 2)} ${l.unit}`).join(" · ");
  return `${fmt.number(d.value ?? 0, 2)} ${d.unit ?? ""}`;
}

/** Pairs each quick input with one of the person's open requests and saves the chosen ones as drafts. */
function SaveToCycle({ tool, lang }: { tool: "ghg" | "environment"; lang: string }) {
  const { t, fmt } = useI18n();
  const client = useActiveClient();
  const drafts = useMemo(() => (tool === "ghg" ? ghgDrafts(client.ghg) : environmentDrafts(client.indicators.env)), [tool, client]);
  const metrics = drafts.map((d) => d.metric).join(",");
  const [targets, setTargets] = useState<Target[] | null>(null);
  const [pick, setPick] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<{ requestId: string; ok: boolean; code?: string }[] | null>(null);
  useEffect(() => {
    if (!metrics) return;
    let live = true;
    void api<{ targets: Target[] }>("GET", `/api/v1/quick/targets?metrics=${encodeURIComponent(metrics)}`).then((r) => {
      if (live) setTargets(r.ok ? r.data.targets : []);
    });
    return () => {
      live = false;
    };
  }, [metrics]);
  const chosen = drafts.filter((d) => pick[d.metric]);
  return (
    <section aria-labelledby="save-to-cycle" className="glass mt-6 flex flex-col gap-3 p-5">
      <h2 id="save-to-cycle" className="text-[16px] font-semibold">
        {t("pf.quick.saveTitle")}
      </h2>
      <p className="text-[13px] leading-relaxed text-[var(--ink-2)]">{t("pf.quick.saveLead")}</p>
      {!drafts.length ? (
        <p className="text-[13px] text-[var(--ink-3)]">{t("pf.quick.nothing")}</p>
      ) : targets === null ? (
        <p className="text-[13px] text-[var(--ink-3)]">{t("shell.loading")}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-[var(--rule)]">
          {drafts.map((d) => {
            const options = targets.filter((x) => x.metric_code === d.metric);
            return (
              <li key={d.metric} className="grid gap-2 py-2.5 text-[13px] md:grid-cols-[minmax(0,220px)_minmax(0,1fr)_minmax(0,320px)] md:items-center">
                <span className="font-medium">{t(`req.items.${d.metric}`)}</span>
                <span className="text-[12.5px] tabular-nums text-[var(--ink-2)]">{describe(d, fmt)}</span>
                {options.length ? (
                  <select aria-label={t("pf.quick.target", { item: t(`req.items.${d.metric}`) })} className="field-input h-8 text-[12.5px]" value={pick[d.metric] ?? ""} onChange={(e) => setPick({ ...pick, [d.metric]: e.target.value })}>
                    <option value="">{t("pf.quick.skip")}</option>
                    {options.map((o) => (
                      <option key={o.id} value={o.id}>
                        {[o.project_name, o.cycle_label, o.facility_name ?? t("pf.data.organisationLevel")].join(" · ")}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-[12.5px] text-[var(--ink-3)]">{t("pf.quick.noTarget")}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <ErrorNote code={error} />
      {results && (
        <ul className="flex flex-col gap-1 text-[13px]">
          {results.map((r) => (
            <li key={r.requestId} className="flex flex-wrap items-center gap-2">
              <Badge tone={r.ok ? "ok" : "crit"}>{r.ok ? t("pf.quick.saved") : t("pf.quick.failed")}</Badge>
              {r.ok ? (
                <Link href={`/${lang}/app/tasks/${r.requestId}`} className="text-[var(--b-700)]">
                  {t("pf.quick.openTask")}
                </Link>
              ) : (
                <span className="text-[var(--ink-3)]">{t(`pf.err.${r.code}`)}</span>
              )}
            </li>
          ))}
        </ul>
      )}
      {results?.some((r) => r.ok) && <OkNote>{t("pf.quick.nextStep")}</OkNote>}
      <div>
        <Button
          variant="primary"
          disabled={busy || !chosen.length}
          onClick={async () => {
            setBusy(true);
            setError(null);
            const r = await api<{ results: { requestId: string; ok: boolean; code?: string }[] }>("POST", "/api/v1/quick/save", { items: chosen.map((d) => ({ requestId: pick[d.metric], draft: d })) });
            setBusy(false);
            if (!r.ok) return setError(r.code);
            setResults(r.data.results);
          }}
        >
          {t("pf.quick.save", { n: chosen.length })}
        </Button>
      </div>
    </section>
  );
}
