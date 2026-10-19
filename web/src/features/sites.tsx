"use client";

import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { useI18n } from "@/i18n/provider";
import { PageHeader } from "@/components/shell";
import { SourceNote } from "@/components/figure";
import { Button, StatusMark, TextField } from "@/components/ui";
import { Hydrated } from "./common";
import { useActiveClient, useWorkspace } from "@/store/workspace";
import { computeInventory } from "@/lib/calc/ghg";
import { approvalOf } from "@/lib/approval";
import { addSite, CONSOLIDATION_METHODS, consolidate, removeSite, SITE_KINDS, siteWeight, type ConsolidationMethod, type SiteKind } from "@/lib/sites";

export function SitesPage() {
  return (
    <Hydrated>
      <Inner />
    </Hydrated>
  );
}

/** Isometric block for one site: height follows its attributed share, edges follow data status. */
function IsoBlock({ weight, status, label }: { weight: number; status: "draft" | "review" | "approved"; label: string }) {
  const h = 14 + 46 * Math.min(1, Math.max(0, weight));
  const edge = status === "approved" ? "var(--ok)" : status === "review" ? "var(--warn)" : "var(--ink-3)";
  const dash = status === "draft" ? "5 4" : undefined;
  // iso projection of a 40x40 base, height h
  const cx = 60;
  const top = 66 - h;
  return (
    <svg viewBox="0 0 120 96" className="h-24 w-full" role="img" aria-label={label}>
      {/* top face */}
      <polygon points={`${cx},${top} ${cx + 34},${top + 17} ${cx},${top + 34} ${cx - 34},${top + 17}`} fill="var(--paper)" stroke={edge} strokeWidth="1.5" strokeDasharray={dash} />
      {/* left face */}
      <polygon points={`${cx - 34},${top + 17} ${cx},${top + 34} ${cx},${66} ${cx - 34},${49}`} fill="var(--b-100)" stroke={edge} strokeWidth="1.5" strokeDasharray={dash} />
      {/* right face */}
      <polygon points={`${cx + 34},${top + 17} ${cx},${top + 34} ${cx},${66} ${cx + 34},${49}`} fill="var(--b-200, #d7e1fb)" stroke={edge} strokeWidth="1.5" strokeDasharray={dash} />
    </svg>
  );
}

function Inner() {
  const { t, fmt } = useI18n();
  const client = useActiveClient();
  const update = useWorkspace((s) => s.update);
  const ghg = useMemo(() => computeInventory(client.ghg), [client.ghg]);
  const sites = useMemo(() => client.sites ?? [], [client.sites]);
  const con = useMemo(() => consolidate(sites, ghg.scope1, ghg.scope2Location), [sites, ghg.scope1, ghg.scope2Location]);
  const ghgStatus = approvalOf(client.approvals, "ghg").status;
  const isoStatus = ghgStatus === "approved" || ghgStatus === "published" ? "approved" : ghgStatus === "review" ? "review" : "draft";

  const [name, setName] = useState("");
  const [kind, setKind] = useState<SiteKind>("factory");
  const [share, setShare] = useState(100);
  const [control, setControl] = useState<ConsolidationMethod>("operational");
  const [error, setError] = useState<string | null>(null);

  const add = () => {
    const r = addSite(sites, { name, kind, share, control });
    if ("error" in r) return setError(t(`sites.err_${r.error}`));
    setError(null);
    setName("");
    setShare(100);
    update("sites", r.next);
  };

  return (
    <div data-family="compass">
      <PageHeader title={t("nav.sites")} result={t("sites.result", { n: sites.length, total: fmt.number(con.companyTotal) })} />
      <div className="grid gap-12 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-8">
          <section className="glass sheet flex flex-col gap-3 p-5 md:p-6">
            <h2 className="text-[16px] font-semibold">{t("sites.registry")}</h2>
            <p className="text-[13.5px] text-[var(--ink-3)]">{t("sites.registryHint")}</p>
            {sites.length > 0 && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {sites.map((s) => (
                  <div key={s.id} className="rounded-[12px] border border-[var(--rule)] bg-white/60 p-3">
                    <IsoBlock weight={con.rows.find((r) => r.siteId === s.id)?.weight ?? 0} status={isoStatus} label={s.name} />
                    <p className="mt-1 truncate text-[14px] font-semibold">{s.name}</p>
                    <p className="text-[12.5px] text-[var(--ink-3)]">
                      {t(`sites.kind_${s.kind}`)} · {t(`sites.control_${s.control}`)} · %{fmt.number(s.share, 0)} → ×{fmt.number(siteWeight(s), 2)}
                    </p>
                  </div>
                ))}
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="report-table text-[13.5px]">
                <thead>
                  <tr>
                    <th>{t("sites.name")}</th>
                    <th>{t("sites.kind")}</th>
                    <th className="num">{t("sites.share")}</th>
                    <th>{t("sites.control")}</th>
                    <th className="num">{t("sites.weight")}</th>
                    <th aria-label={t("actions.remove")} />
                  </tr>
                </thead>
                <tbody>
                  {sites.map((s) => (
                    <tr key={s.id}>
                      <td>{s.name}</td>
                      <td>{t(`sites.kind_${s.kind}`)}</td>
                      <td className="num">%{fmt.number(s.share, 0)}</td>
                      <td>{t(`sites.control_${s.control}`)}</td>
                      <td className="num">×{fmt.number(siteWeight(s), 2)}</td>
                      <td>
                        <button type="button" onClick={() => update("sites", removeSite(sites, s.id))} aria-label={`${t("actions.remove")}: ${s.name}`} className="text-[var(--ink-3)] hover:text-[var(--crit)]">
                          <Trash2 size={14} aria-hidden />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!sites.length && (
                    <tr>
                      <td colSpan={6}>{t("sites.empty")}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_150px_130px_170px_auto] md:items-end">
              <TextField label={t("sites.name")} value={name} onChange={setName} />
              <label className="flex flex-col gap-1 text-[13px]">
                {t("sites.kind")}
                <select value={kind} onChange={(e) => setKind(e.target.value as SiteKind)} className="rounded-[10px] border border-[var(--rule)] bg-white px-2 py-2">
                  {SITE_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {t(`sites.kind_${k}`)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-[13px]">
                {t("sites.share")}
                <input type="number" min={1} max={100} value={share} onChange={(e) => setShare(Number(e.target.value))} className="rounded-[10px] border border-[var(--rule)] bg-white px-2 py-2" />
              </label>
              <label className="flex flex-col gap-1 text-[13px]">
                {t("sites.control")}
                <select value={control} onChange={(e) => setControl(e.target.value as ConsolidationMethod)} className="rounded-[10px] border border-[var(--rule)] bg-white px-2 py-2">
                  {CONSOLIDATION_METHODS.map((c) => (
                    <option key={c} value={c}>
                      {t(`sites.control_${c}`)}
                    </option>
                  ))}
                </select>
              </label>
              <Button variant="primary" size="sm" onClick={add}>
                {t("actions.add")}
              </Button>
            </div>
            {error && (
              <p role="alert" className="text-[13px] text-[var(--crit)]">
                {error}
              </p>
            )}
            <SourceNote compact meta={{ sources: ["ghg_protocol"] }} />
          </section>

          <section className="glass sheet flex flex-col gap-3 p-5 md:p-6">
            <h2 className="text-[16px] font-semibold">{t("sites.consolidation")}</h2>
            <p className="text-[13.5px] text-[var(--ink-3)]">{t("sites.consolidationHint")}</p>
            <div className="overflow-x-auto">
              <table className="report-table text-[13.5px]">
                <thead>
                  <tr>
                    <th>{t("sites.name")}</th>
                    <th className="num">{t("ghg.scope1")}</th>
                    <th className="num">{t("ghg.scope2loc")}</th>
                    <th className="num">{t("sites.attributed")}</th>
                  </tr>
                </thead>
                <tbody>
                  {con.rows.map((r) => (
                    <tr key={r.siteId}>
                      <td>
                        {r.name} <StatusMark kind={r.control === "equity" ? "indirect" : "verified"} label={`×${fmt.number(r.weight, 2)}`} />
                      </td>
                      <td className="num">{fmt.number(r.scope1)}</td>
                      <td className="num">{fmt.number(r.scope2)}</td>
                      <td className="num font-semibold">{fmt.number(r.attributed)}</td>
                    </tr>
                  ))}
                  {!con.rows.length && (
                    <tr>
                      <td colSpan={4}>{t("sites.empty")}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="text-[13px] text-[var(--ink-2)]">{t("sites.companyTotal", { v: fmt.number(con.companyTotal) })}</p>
          </section>
        </div>

        <aside className="glass flex flex-col gap-2 p-5">
          <h2 className="text-[14px] font-semibold">{t("sites.methods")}</h2>
          <ul className="flex flex-col gap-2 text-[13px] text-[var(--ink-2)]">
            {(["operational", "financial", "equity"] as const).map((m) => (
              <li key={m} className="flex gap-3">
                <span aria-hidden className="mt-[0.7em] h-px w-3 shrink-0 bg-[var(--ink-3)]" />
                <span>{t(`sites.method_${m}`)}</span>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
