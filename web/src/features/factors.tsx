"use client";

import { useRef, useState, type ReactNode } from "react";
import { Download, FileDown, FileUp, Plus, Search, Trash2 } from "lucide-react";
import { useI18n } from "@/i18n/provider";
import { BUILTIN_SETS, factorDigits, factorSetCsv, factorTemplateCsv, factorUnit, importFactorCsv, usableSets, type Factor, type FactorCsvIssue, type FactorSet, type LicenceClass } from "@/lib/factors";
import { useFactorLabel } from "@/components/factor-picker";
import { download, slug } from "@/lib/export";
import { useWorkspace } from "@/store/workspace";
import { FiguresRow, PageHeader } from "@/components/shell";
import { Button, Callout, StatusMark, TextField, Toggle, cn } from "@/components/ui";
import { Hydrated } from "./common";

const LICENCE_MARK: Record<LicenceClass, "verified" | "estimated" | "review"> = { open: "verified", public_sector: "verified", user_licensed: "review" };

export function FactorsPage() {
  return (
    <Hydrated>
      <Inner />
    </Hydrated>
  );
}

function Inner() {
  const { t } = useI18n();
  const custom = useWorkspace((s) => s.customSets);
  const saveSet = useWorkspace((s) => s.saveSet);
  const [name, setName] = useState("");
  const [publisher, setPublisher] = useState("");
  const usable = usableSets(custom);
  const factorCount = usable.reduce((n, s) => n + s.factors.length, 0);

  return (
    <div data-family="compass">
      <PageHeader title={t("nav.factors")} result={t("factors.result", { builtin: BUILTIN_SETS.length, custom: custom.length, n: factorCount })} />
      <div className="flex flex-col gap-6">
        <FiguresRow
          pulseKey={factorCount}
          items={[
            { label: t("factors.figUsable"), value: String(factorCount), tone: "fam" },
            { label: t("factors.figBuiltin"), value: String(BUILTIN_SETS.length) },
            { label: t("factors.figCustom"), value: String(custom.length) },
            { label: t("factors.figPending"), value: String(custom.filter((s) => !s.rightsConfirmed).length), note: t("factors.figPendingNote") },
          ]}
        />
        <Callout>{t("factors.licenceIntro")}</Callout>

        <section className="flex flex-col gap-4">
          <h2 className="text-[20px] font-semibold tracking-[-0.01em]">{t("factors.builtinTitle")}</h2>
          <div className="grid gap-4 lg:grid-cols-3">
            {builtinGroups().map((g) => (g.length > 1 ? <EditionTile key={g[0].family} sets={g} /> : <SetTile key={g[0].id} set={g[0]} />))}
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-[20px] font-semibold tracking-[-0.01em]">{t("factors.customTitle")}</h2>
          <form
            className="glass flex flex-wrap items-end gap-4 p-5"
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) return;
              saveSet({
                id: `custom-${Date.now().toString(36)}`,
                name: name.trim(),
                publisher: publisher.trim(),
                licence: "user_licensed",
                licenceNote: "",
                url: "",
                asOf: new Date().toISOString().slice(0, 10),
                origin: "custom",
                rightsConfirmed: false,
                factors: [],
              });
              setName("");
              setPublisher("");
            }}
          >
            <div className="min-w-[220px] flex-1">
              <TextField label={t("factors.setName")} value={name} onChange={setName} />
            </div>
            <div className="min-w-[220px] flex-1">
              <TextField label={t("factors.publisher")} value={publisher} onChange={setPublisher} />
            </div>
            <Button type="submit" variant="primary" disabled={!name.trim()}>
              <Plus size={15} aria-hidden /> {t("factors.addSet")}
            </Button>
          </form>
          {custom.length === 0 && <p className="text-[14px] text-[var(--ink-3)]">{t("factors.noCustom")}</p>}
          <div className="grid gap-4 xl:grid-cols-2">
            {custom.map((s) => (
              <CustomSetTile key={s.id} set={s} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

/** Sets longer than this get a search box. */
const SEARCH_FROM = 25;

function FactorTable({ set, onRemove }: { set: FactorSet; onRemove?: (id: string) => void }) {
  const { t, fmt, locale } = useI18n();
  const label = useFactorLabel();
  const [q, setQ] = useState("");
  const needle = q.trim().toLocaleLowerCase(locale).replace(/s/g, "");
  const rows = needle ? set.factors.filter((f) => `${f.key}${label(f, set)}`.toLocaleLowerCase(locale).replace(/s/g, "").includes(needle)) : set.factors;
  const part = (v: number | undefined) => (v === undefined ? "–" : fmt.number(v, 3));
  return (
    <div className="flex flex-col gap-2">
      {set.factors.length > SEARCH_FROM && (
        <div className="flex items-center gap-2">
          <Search size={14} aria-hidden className="shrink-0 text-[var(--ink-3)]" />
          <input type="search" className="field-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("factors.search")} aria-label={t("factors.search")} />
          <span className="shrink-0 text-[12px] tabular-nums text-[var(--ink-3)]">{t("factors.searchCount", { n: rows.length, total: set.factors.length })}</span>
        </div>
      )}
      <div className="max-h-72 overflow-auto">
        <table className="report-table text-[13px]">
          <thead>
            <tr>
              <th>{t("factors.kind")}</th>
              <th>{t("factors.key")}</th>
              <th className="r">{t("factors.value")}</th>
              <th>{t("factors.unit")}</th>
              {onRemove && <th />}
            </tr>
          </thead>
          <tbody>
            {rows.map((f) => (
              <tr key={f.id}>
                <td className="whitespace-nowrap text-[var(--ink-3)]">{t(`factors.kinds.${f.kind}`)}</td>
                <td>
                  {label(f, set)}
                  {f.year && <span className="ml-1 text-[var(--ink-3)]">({f.year})</span>}
                  {f.ncv !== undefined && <span className="block text-[11.5px] text-[var(--ink-3)]">NCV {fmt.number(f.ncv, 4)} GJ/{f.unit}</span>}
                  {f.kind === "cbam_default" && (f.direct !== undefined || f.indirect !== undefined) && (
                    <span className="block text-[11.5px] text-[var(--ink-3)]">
                      {t("factors.direct")} {part(f.direct)} · {t("factors.indirect")} {part(f.indirect)}
                    </span>
                  )}
                  {f.otherCountries && <span className="block text-[11.5px] text-[var(--ink-2)]">{t("factors.otherCountriesShort")}</span>}
                </td>
                <td className="r num">{fmt.number(f.value, factorDigits(f.value))}</td>
                <td className="whitespace-nowrap text-[var(--ink-3)]">{factorUnit(f)}</td>
                {onRemove && (
                  <td>
                    <button type="button" className="text-[var(--ink-3)] hover:text-[var(--crit)]" onClick={() => onRemove(f.id)} aria-label={t("actions.remove")}>
                      <Trash2 size={14} aria-hidden />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SetHeader({ set }: { set: FactorSet }) {
  const { t, fmt } = useI18n();
  return (
    <div className="flex flex-col gap-1.5">
      <h3 className="text-[15.5px] font-semibold leading-snug">{set.name}</h3>
      <p className="text-[12.5px] text-[var(--ink-3)]">
        {set.publisher || "—"} · {fmt.date(set.asOf)} · {t("factors.count", { n: set.factors.length })}
      </p>
      <StatusMark kind={LICENCE_MARK[set.licence]} label={t(`factors.licence.${set.licence}`)} />
    </div>
  );
}

/** Built-in sets with editions of one family grouped together, oldest edition first. */
function builtinGroups(): FactorSet[][] {
  const groups = new Map<string, FactorSet[]>();
  for (const s of BUILTIN_SETS) groups.set(s.family ?? s.id, [...(groups.get(s.family ?? s.id) ?? []), s]);
  return [...groups.values()].map((g) => g.sort((a, b) => (a.year ?? 0) - (b.year ?? 0)));
}

/** One tile per family: the latest edition is shown, earlier ones a click away. */
function EditionTile({ sets }: { sets: FactorSet[] }) {
  const { t } = useI18n();
  const [id, setId] = useState(sets.at(-1)!.id);
  const set = sets.find((s) => s.id === id) ?? sets.at(-1)!;
  return (
    <SetTile
      set={set}
      editions={
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t("factors.editions")}>
          <span className="text-[12px] text-[var(--ink-3)]">{t("factors.editions")}:</span>
          {sets.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={s.id === set.id}
              onClick={() => setId(s.id)}
              className={cn("num h-7 rounded-full border px-2.5 text-[12px] font-medium", s.id === set.id ? "border-[var(--ink)] bg-[var(--ink)] text-white" : "border-[var(--rule)] bg-[var(--glass-strong)]")}
            >
              {s.year}
            </button>
          ))}
        </div>
      }
    />
  );
}

function SetTile({ set, editions }: { set: FactorSet; editions?: ReactNode }) {
  const { t } = useI18n();
  return (
    <article className="glass sheet flex min-w-0 flex-col gap-3 p-5">
      <SetHeader set={set} />
      {editions}
      <p className="text-[12.5px] text-[var(--ink-2)]">{t(`factors.setNotes.${set.family ?? set.id}`)}</p>
      {set.usageNote && <p className="text-[12.5px] text-[var(--ink-3)]">{t(set.usageNote)}</p>}
      <details className="group">
        <summary className="cursor-pointer text-[13px] font-semibold text-[var(--accent-ink)]">{t("factors.showFactors")}</summary>
        <div className="mt-2">
          <FactorTable set={set} />
        </div>
      </details>
      <a href={set.url} target="_blank" rel="noreferrer" className="mt-auto truncate text-[12px] text-[var(--ink-3)] underline decoration-[var(--rule)]">
        {set.url}
      </a>
    </article>
  );
}

function CustomSetTile({ set }: { set: FactorSet }) {
  const { t } = useI18n();
  const saveSet = useWorkspace((s) => s.saveSet);
  const removeSet = useWorkspace((s) => s.removeSet);
  const file = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<{ factors: Factor[]; issues: FactorCsvIssue[]; name: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const patch = (p: Partial<FactorSet>) => saveSet({ ...set, ...p });

  return (
    <article className={cn("glass sheet flex min-w-0 flex-col gap-4 p-5", !set.rightsConfirmed && "border-dashed")}>
      <SetHeader set={set} />
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label={t("factors.licenceNote")} value={set.licenceNote} onChange={(v) => patch({ licenceNote: v })} hint={t("factors.licenceNoteHint")} />
        <TextField label={t("factors.url")} value={set.url} onChange={(v) => patch({ url: v })} />
      </div>
      <Toggle label={t("factors.rights")} hint={t("factors.rightsHint")} checked={set.rightsConfirmed} onChange={(v) => patch({ rightsConfirmed: v })} />
      <div className="flex flex-wrap gap-2">
        <Button variant="quiet" size="sm" onClick={() => download("isoline-faktor-sablonu.csv", factorTemplateCsv(), "text/csv;charset=utf-8")}>
          <FileDown size={14} aria-hidden /> {t("ghg.import.template")}
        </Button>
        <Button variant="quiet" size="sm" onClick={() => file.current?.click()}>
          <FileUp size={14} aria-hidden /> {t("ghg.import.upload")}
        </Button>
        <Button variant="quiet" size="sm" disabled={!set.factors.length} onClick={() => download(`${slug(set.name)}.csv`, factorSetCsv(set), "text/csv;charset=utf-8")}>
          <Download size={14} aria-hidden /> CSV
        </Button>
        {confirmDelete ? (
          <>
            <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
              {t("clients.cancel")}
            </Button>
            <Button size="sm" className="border border-[var(--crit)] text-[var(--crit)]" onClick={() => removeSet(set.id)}>
              {t("clients.confirmDelete")}
            </Button>
          </>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)} aria-label={t("factors.deleteSet")}>
            <Trash2 size={14} aria-hidden />
          </Button>
        )}
      </div>
      <input
        ref={file}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        aria-label={t("ghg.import.upload")}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          setPreview({ ...importFactorCsv(await f.text(), set.id), name: f.name });
        }}
      />
      {preview && (
        <div className="flex flex-col gap-2 rounded-[12px] border border-[var(--rule)] bg-[var(--glass-strong)] p-3 text-[13px]">
          <p className="font-semibold">{t("factors.preview", { file: preview.name, n: preview.factors.length })}</p>
          {preview.issues.length > 0 && (
            <ul className="flex max-h-28 flex-col gap-1 overflow-y-auto text-[12.5px] text-[var(--crit)]">
              {preview.issues.map((i, k) => (
                <li key={k}>
                  {t("ghg.import.row", { row: i.row })} {t(`factors.err.${i.key}`, i.vars)}
                </li>
              ))}
            </ul>
          )}
          {preview.factors.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  const ids = new Set(preview.factors.map((f) => f.id));
                  patch({ factors: [...set.factors.filter((f) => !ids.has(f.id)), ...preview.factors] });
                  setPreview(null);
                }}
              >
                {t("factors.merge")}
              </Button>
              <Button
                variant="quiet"
                size="sm"
                onClick={() => {
                  patch({ factors: preview.factors });
                  setPreview(null);
                }}
              >
                {t("factors.replace")}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setPreview(null)}>
                {t("clients.cancel")}
              </Button>
            </div>
          )}
        </div>
      )}
      {set.factors.length > 0 ? <FactorTable set={set} onRemove={(id) => patch({ factors: set.factors.filter((f) => f.id !== id) })} /> : <p className="text-[13px] text-[var(--ink-3)]">{t("factors.emptySet")}</p>}
    </article>
  );
}
