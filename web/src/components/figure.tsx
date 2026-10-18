"use client";

import { useRef, useState, type ReactNode } from "react";
import { Download, Table2, LineChart as LineIcon } from "lucide-react";
import { useI18n } from "@/i18n/provider";
import { SOURCES, type Confidence } from "@/data/sources";
import { downloadCsv, downloadSvg, slug } from "@/lib/export";
import { Button, cn } from "./ui";

export type NoteMeta = {
  sources: string[];
  boundary?: string;
  unit?: string;
  /** Overrides the derived status label. */
  status?: "verified" | "estimated" | "sample" | "review";
  /** Factor edition the figures were computed with (roadmap item 5, "kaynak şeridi"). */
  edition?: string;
  /** ISO date the figures were computed; rendered in the viewer's locale. */
  computedAt?: string;
  /** Share of the total from estimated data (0–1); rendered as the quality note. */
  estimatedShare?: number;
  /** Boundary/period mismatch warning, e.g. inventory year vs reporting year. */
  periodWarning?: string;
};

const worst = (cs: Confidence[]): Confidence => (cs.includes("unverified") ? "unverified" : cs.includes("secondary") ? "secondary" : "official");

/** The signature collar: every chart and table ends in a ruled source note. */
export function SourceNote({ meta, compact }: { meta: NoteMeta; compact?: boolean }) {
  const { t, fmt } = useI18n();
  const [all, setAll] = useState(false);
  const srcs = meta.sources.map((id) => SOURCES[id]).filter(Boolean);
  const shown = all ? srcs : srcs.slice(0, 3);
  const asOf = srcs.map((s) => s.asOf).sort().at(-1);
  const conf = worst(srcs.map((s) => s.confidence));
  const status = meta.status ?? (conf === "official" ? "verified" : conf === "secondary" ? "estimated" : "review");
  const mark = <span aria-hidden className={cn("inline-block w-4 shrink-0 border-t-2", status === "verified" ? "border-solid border-[var(--ink)]" : status === "review" ? "border-dotted border-[var(--warn)]" : "border-dashed border-[var(--ink-2)]")} />;
  if (compact && !all) {
    return (
      <div className="flex min-w-0 items-center gap-2 border-t border-[var(--b-200)] pt-2 text-[11.5px] text-[var(--ink-3)]">
        {mark}
        <a href={srcs[0]?.url} target="_blank" rel="noreferrer" className="min-w-0 truncate hover:underline" title={srcs[0]?.cite}>
          {srcs[0]?.cite}
        </a>
        {srcs.length > 1 && (
          <button type="button" onClick={() => setAll(true)} className="shrink-0 font-semibold text-[var(--accent-ink)] hover:underline">
            +{srcs.length - 1}
          </button>
        )}
      </div>
    );
  }
  return (
    <div className={cn("flex flex-col gap-1.5 border-t border-[var(--b-200)] pt-3 text-[12px] text-[var(--ink-2)]", compact && "gap-1")}>
      <div className="min-w-0 max-w-[90ch]">
        <span className="label mr-2">{t("note.source")}</span>
        {shown.map((s, i) => (
          <span key={s.id}>
            {i > 0 && <span className="text-[var(--ink-3)]"> · </span>}
            <a href={s.url} target="_blank" rel="noreferrer" className="underline decoration-[var(--rule)] hover:decoration-[var(--ink)]">
              {s.cite}
            </a>
          </span>
        ))}
        {(srcs.length > 3 || (compact && all)) && (
          <button type="button" onClick={() => setAll(!all)} className="ml-2 font-semibold text-[var(--accent-ink)] hover:underline">
            {all ? t("note.less") : t("note.more", { n: srcs.length - 3 })}
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
      {asOf && (
        <div>
          <span className="label mr-2">{t("note.asOf")}</span>
          <span className="num">{fmt.date(asOf)}</span>
        </div>
      )}
      {meta.boundary && (
        <div>
          <span className="label mr-2">{t("note.boundary")}</span>
          {meta.boundary}
        </div>
      )}
      {meta.unit && (
        <div>
          <span className="label mr-2">{t("note.unit")}</span>
          {meta.unit}
        </div>
      )}
      {meta.edition && (
        <div>
          <span className="label mr-2">{t("note.edition")}</span>
          {meta.edition}
        </div>
      )}
      {meta.computedAt && (
        <div>
          <span className="label mr-2">{t("note.computedAt")}</span>
          <span className="num">{fmt.date(meta.computedAt)}</span>
        </div>
      )}
      {meta.estimatedShare !== undefined && Number.isFinite(meta.estimatedShare) && (
        <div>
          <span className="label mr-2">{t("note.estimatedShare")}</span>
          <span className="num">{fmt.percent(meta.estimatedShare, 0)}</span>
        </div>
      )}
      {meta.periodWarning && (
        <div className="flex items-center gap-2">
          <span aria-hidden className="inline-block w-4 border-t-2 border-dotted border-[var(--warn)]" />
          <span className="text-[var(--warn)]">{meta.periodWarning}</span>
        </div>
      )}
      <div className="flex items-center gap-2">
        <span className="label">{t("note.status")}</span>
        <span aria-hidden className={cn("inline-block w-4 border-t-2", status === "verified" ? "border-solid border-[var(--ink)]" : status === "review" ? "border-dotted border-[var(--warn)]" : "border-dashed border-[var(--ink-2)]")} />
        <span className={cn(status === "review" && "text-[var(--warn)]")}>{t(`note.status_${status}`)}</span>
      </div>
      </div>
    </div>
  );
}

export function Figure({
  title,
  caption,
  children,
  table,
  csv,
  meta,
  legend,
}: {
  title: string;
  caption?: string;
  children: ReactNode;
  table?: ReactNode;
  csv?: { header: string[]; rows: (string | number)[][] };
  meta: NoteMeta;
  legend?: ReactNode;
}) {
  const { t } = useI18n();
  const [view, setView] = useState<"chart" | "table">("chart");
  const box = useRef<HTMLDivElement>(null);
  return (
    <figure className="glass sheet flex min-w-0 flex-col gap-4 p-5 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h3 className="text-[16px] font-semibold leading-tight text-[var(--ink)]">{title}</h3>
          {caption && <p className="mt-0.5 max-w-[68ch] text-[13px] text-[var(--ink-3)]">{caption}</p>}
        </div>
        <div className="no-print flex items-center gap-1">
          {table && (
            <Button variant="ghost" size="sm" onClick={() => setView(view === "chart" ? "table" : "chart")} aria-pressed={view === "table"}>
              {view === "chart" ? <Table2 size={15} aria-hidden /> : <LineIcon size={15} aria-hidden />}
              {view === "chart" ? t("figure.showTable") : t("figure.showChart")}
            </Button>
          )}
          {csv && (
            <Button variant="ghost" size="sm" onClick={() => downloadCsv(`${slug(title)}.csv`, csv.header, csv.rows)}>
              <Download size={15} aria-hidden />
              CSV
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const svg = box.current?.querySelector("svg[data-chart]") as SVGSVGElement | null;
              if (svg) downloadSvg(`${slug(title)}.svg`, svg);
            }}
            disabled={view !== "chart"}
          >
            <Download size={15} aria-hidden />
            SVG
          </Button>
        </div>
      </div>
      {legend && view === "chart" && <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-[12.5px] text-[var(--ink-2)]">{legend}</div>}
      <div ref={box} className="min-w-0">
        {view === "chart" ? children : <div className="overflow-x-auto">{table}</div>}
      </div>
      <figcaption>
        <SourceNote meta={meta} />
      </figcaption>
    </figure>
  );
}

export function LegendItem({ color, label, dash, kind = "line" }: { color: string; label: string; dash?: boolean; kind?: "line" | "swatch" | "band" }) {
  return (
    <span className="inline-flex items-center gap-2">
      {kind === "line" && <span aria-hidden className="inline-block w-5 border-t-2" style={{ borderColor: color, borderTopStyle: dash ? "dashed" : "solid" }} />}
      {kind === "swatch" && <span aria-hidden className="inline-block h-3 w-3" style={{ background: color }} />}
      {kind === "band" && <span aria-hidden className="inline-block h-3 w-5" style={{ background: color }} />}
      {label}
    </span>
  );
}
