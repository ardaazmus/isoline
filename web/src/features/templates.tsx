"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, FileDown } from "lucide-react";
import { useI18n } from "@/i18n/provider";
import { TEMPLATES, type Template } from "@/data/templates";
import { SOURCES } from "@/data/sources";
import { FAMILY_COLOR, NAV } from "@/data/nav";
import { toolSummary } from "@/lib/summary";
import { buildDocx } from "@/lib/docx";
import { download, slug } from "@/lib/export";
import { useActiveClient } from "@/store/workspace";
import { PageHeader } from "@/components/shell";
import { SourceNote } from "@/components/figure";
import { Button, StatusMark, Tabs } from "@/components/ui";
import { Hydrated } from "./common";

const KINDS = ["all", "sustainability", "annual", "carbon", "finance"] as const;

export function TemplateLibrary() {
  const { t, locale } = useI18n();
  const [kind, setKind] = useState<(typeof KINDS)[number]>("all");
  const list = TEMPLATES.filter((tp) => kind === "all" || tp.kind === kind);
  return (
    <div data-family="reporting">
      <PageHeader title={t("nav.templates")} result={t("tpl.result", { n: TEMPLATES.length })} />
      <div className="flex flex-col gap-8">
        <Tabs label={t("tpl.kind")} value={kind} onChange={setKind} items={KINDS.map((k) => ({ value: k, label: t(`tpl.kinds.${k}`) }))} />
        <ul className="grid gap-x-10 md:grid-cols-2">
          {list.map((tp) => (
            <li key={tp.id} className="border-t border-[var(--rule)]">
              <Link href={`/${locale}/templates/${tp.id}`} className="group flex flex-col gap-2 py-5 no-underline">
                <span className="flex items-center gap-3">
                  <span aria-hidden className="h-[3px] w-8" style={{ background: FAMILY_COLOR[tp.family].strong }} />
                  <span className="label">{t(`tpl.kinds.${tp.kind}`)}</span>
                </span>
                <span className="text-[18px] font-semibold text-[var(--ink)] group-hover:underline">{t(`tpl.${tp.id}.title`)}</span>
                <span className="max-w-[60ch] text-[14px] text-[var(--ink-2)]">{t(`tpl.${tp.id}.summary`)}</span>
                <span className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[12.5px] text-[var(--ink-3)]">
                  <span className="num">{t("tpl.sectionCount", { n: tp.sections.length })}</span>
                  <StatusMark kind={tp.status === "verified" ? "verified" : "review"} label={t(`tpl.status.${tp.status}`)} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function TemplateDetail({ id }: { id: string }) {
  return (
    <Hydrated>
      <Detail tp={TEMPLATES.find((x) => x.id === id)!} />
    </Hydrated>
  );
}

function Detail({ tp }: { tp: Template }) {
  const { t, fmt, locale } = useI18n();
  const client = useActiveClient();
  const [busy, setBusy] = useState(false);
  const navHref = (tool: string) => NAV.flatMap((g) => g.items).find((i) => i.id === tool)?.href ?? "";

  const exportDocx = async () => {
    setBusy(true);
    try {
      const blob = await buildDocx({
        title: t(`tpl.${tp.id}.title`),
        subtitle: t(`tpl.kinds.${tp.kind}`),
        client: client.name,
        intro: t("tpl.docIntro"),
        labels: { refs: t("tpl.refs"), figures: t("tpl.figures"), draft: t("tpl.draftHere"), sources: t("note.source") },
        sources: tp.sources.map((s) => `${SOURCES[s].cite} — ${SOURCES[s].url}`),
        sections: tp.sections.map((s) => ({
          title: t(`tpl.${tp.id}.sections.${s.id}.title`),
          guide: t(`tpl.${tp.id}.sections.${s.id}.guide`),
          refs: s.refs,
          figures: (s.tools ?? []).flatMap((tool) => toolSummary(client, tool, t, fmt)),
          status: client.sample ? t("tpl.sampleFigures") : undefined,
        })),
      });
      download(`${slug(client.name)}-${tp.id}.docx`, blob, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-family={tp.family}>
      <Link href={`/${locale}/templates`} className="mb-4 inline-flex items-center gap-1.5 text-[13.5px] text-[var(--ink-2)]">
        <ArrowLeft size={14} aria-hidden /> {t("nav.templates")}
      </Link>
      <PageHeader
        family={tp.family}
        title={t(`tpl.${tp.id}.title`)}
        result={t(`tpl.${tp.id}.summary`)}
        actions={
          <Button variant="onBandPrimary" onClick={exportDocx} disabled={busy}>
            <FileDown size={15} aria-hidden /> {busy ? t("tpl.preparing") : t("tpl.exportDocx")}
          </Button>
        }
      />
      <div className="grid gap-12 xl:grid-cols-[minmax(0,1fr)_320px]">
        <ol className="flex min-w-0 flex-col">
          {tp.sections.map((s, i) => {
            const figs = (s.tools ?? []).flatMap((tool) => toolSummary(client, tool, t, fmt).slice(0, 2).map((r) => ({ ...r, tool })));
            return (
              <li key={s.id} className="grid gap-x-6 gap-y-2 border-t border-[var(--rule)] py-5 md:grid-cols-[48px_minmax(0,1fr)]">
                <span className="figure-num text-[28px] text-[var(--ink-3)]">{i + 1}</span>
                <div className="flex min-w-0 flex-col gap-2">
                  <h2 className="text-[17px] font-semibold">{t(`tpl.${tp.id}.sections.${s.id}.title`)}</h2>
                  <p className="max-w-[70ch] text-[14.5px] leading-relaxed text-[var(--ink-2)]">{t(`tpl.${tp.id}.sections.${s.id}.guide`)}</p>
                  <p className="text-[12.5px] text-[var(--ink-3)]">
                    <span className="label mr-2">{t("tpl.refs")}</span>
                    {s.refs.join(" · ")}
                  </p>
                  {figs.length > 0 && (
                    <dl className="mt-1 grid gap-x-8 sm:grid-cols-2">
                      {figs.map((f) => (
                        <div key={f.tool + f.label} className="flex items-baseline justify-between gap-3 border-b border-[var(--rule)] py-1.5 text-[13.5px]">
                          <dt className="min-w-0 truncate text-[var(--ink-3)]">
                            <Link href={`/${locale}${navHref(f.tool)}`}>{f.label}</Link>
                          </dt>
                          <dd className="num shrink-0 font-medium">{f.value}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
        <aside className="flex flex-col gap-4 xl:sticky xl:top-[88px] xl:self-start">
          <StatusMark kind={tp.status === "verified" ? "verified" : "review"} label={t(`tpl.status.${tp.status}`)} />
          <p className="text-[13.5px] text-[var(--ink-2)]">{t(`tpl.statusHint.${tp.status}`)}</p>
          <SourceNote compact meta={{ sources: tp.sources, status: tp.status === "review" ? "review" : undefined }} />
          <p className="text-[12.5px] text-[var(--ink-3)]">{t("tpl.figuresFrom", { client: client.name })}</p>
        </aside>
      </div>
    </div>
  );
}
