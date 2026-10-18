"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Eraser, FileText } from "lucide-react";
import { useI18n } from "@/i18n/provider";
import { CLAIM_LANGS, countByRule, screenClaims, type ClaimHit, type ClaimRule } from "@/lib/claims";
import { FiguresRow, InputGroup, PageHeader, ToolLayout } from "@/components/shell";
import { SourceNote } from "@/components/figure";
import { Button, Callout, SelectField, StatusMark, cn } from "@/components/ui";
import { Hydrated, SectionTitle, useTool } from "./common";
import { ApprovalBar, useApproval } from "./approval";

const RULES: ClaimRule[] = ["offset", "future", "absolute", "generic"];
const TONE: Record<ClaimRule, "crit" | "warn"> = { offset: "crit", future: "crit", absolute: "warn", generic: "warn" };

export function ClaimsTool() {
  return (
    <Hydrated>
      <Inner />
    </Hydrated>
  );
}

function Inner() {
  const { t, locale } = useI18n();
  const { locked } = useApproval("claims");
  // The text is stored on the client so reconciliation rule U10 screens the same text.
  const [claims, setClaims] = useTool("claims");
  const uiLang = CLAIM_LANGS.includes(locale) ? locale : "tr";
  const text = claims?.text ?? "";
  const lang = claims?.lang && CLAIM_LANGS.includes(claims.lang) ? claims.lang : uiLang;
  const setText = (v: string) => setClaims({ text: v, lang });
  const setLang = (v: string) => setClaims({ text, lang: v });
  const [focus, setFocus] = useState<ClaimRule | null>(null);
  const hits = useMemo(() => screenClaims(text, lang), [text, lang]);
  const counts = countByRule(hits);
  const shown = focus ? hits.filter((h) => h.rule === focus) : hits;

  return (
    <div data-family="reporting">
      <PageHeader
        title={t("nav.claims")}
        result={hits.length ? t("claims.result", { n: hits.length, high: counts.offset + counts.future }) : t("claims.clean")}
      />
      <ApprovalBar section="claims" />
      <ToolLayout
        locked={locked}
        family="reporting"
        inputs={
          <>
            <InputGroup title={t("claims.input")}>
              <SelectField label={t("claims.lang")} value={lang} onChange={setLang} options={CLAIM_LANGS.map((l) => ({ value: l, label: t(`claims.langs.${l}`) }))} />
              <div className="flex flex-col gap-1">
                <label htmlFor="claims-text" className="text-[13px] font-medium text-[var(--ink-2)]">
                  {t("claims.text")}
                </label>
                <textarea id="claims-text" className="field-input min-h-[320px] resize-y leading-relaxed" value={text} onChange={(e) => setText(e.target.value)} />
                <p className="text-[12px] text-[var(--ink-3)]">{t("claims.textHint")}</p>
                <p className="text-[12px] text-[var(--ink-3)]">{t("claims.savedHint")}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="ghost" size="sm" onClick={() => setText("")} disabled={!text}>
                  <Eraser size={14} aria-hidden /> {t("claims.clear")}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setClaims({ text: t("claims.sample"), lang: uiLang })}>
                  <FileText size={14} aria-hidden /> {t("claims.loadSample")}
                </Button>
              </div>
            </InputGroup>
          </>
        }
      >
        <FiguresRow
          pulseKey={hits.length}
          items={[
            { label: t("claims.figTotal"), value: String(hits.length), tone: "fam" },
            { label: t("claims.rules.offset.title"), value: String(counts.offset), tone: counts.offset ? "crit" : undefined },
            { label: t("claims.rules.future.title"), value: String(counts.future), tone: counts.future ? "crit" : undefined },
            { label: t("claims.figOther"), value: String(counts.absolute + counts.generic) },
          ]}
        />
        <section className="glass flex min-w-0 flex-col gap-4 p-5 md:p-6">
          <SectionTitle
            aside={
              <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("claims.filter")}>
                {RULES.map((r) => (
                  <button
                    key={r}
                    type="button"
                    aria-pressed={focus === r}
                    onClick={() => setFocus(focus === r ? null : r)}
                    className={cn("h-7 rounded-full border px-2.5 text-[12px] font-medium", focus === r ? "border-[var(--ink)] bg-[var(--ink)] text-white" : "border-[var(--rule)] bg-[var(--glass-strong)]")}
                  >
                    {t(`claims.rules.${r}.title`)} · {counts[r]}
                  </button>
                ))}
              </div>
            }
          >
            {t("claims.marked")}
          </SectionTitle>
          <p className="max-w-[80ch] whitespace-pre-wrap text-[15px] leading-[1.75] text-[var(--ink)]">{highlight(text, shown)}</p>
          <SourceNote meta={{ sources: ["ecgt"], status: "review" }} />
        </section>
        <div className="grid gap-6 lg:grid-cols-2">
          {RULES.map((r) => (
            <section key={r} className="glass flex min-w-0 flex-col gap-2 p-5">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-[16px] font-semibold">{t(`claims.rules.${r}.title`)}</h2>
                <StatusMark kind={TONE[r] === "crit" ? "critical" : "review"} label={t(`claims.severity.${TONE[r]}`)} />
              </div>
              <p className="text-[14px] leading-relaxed text-[var(--ink-2)]">{t(`claims.rules.${r}.why`)}</p>
              <p className="text-[13.5px] leading-relaxed">
                <span className="font-semibold">{t("claims.fix")}: </span>
                {t(`claims.rules.${r}.fix`)}
              </p>
              <p className="text-[12px] text-[var(--ink-3)]">{t(`claims.rules.${r}.ref`)}</p>
              {counts[r] > 0 && (
                <ul className="mt-1 flex flex-wrap gap-1.5">
                  {[...new Set(hits.filter((h) => h.rule === r).map((h) => h.text))].map((x) => (
                    <li key={x} className="rounded-full border border-[var(--rule)] bg-[var(--glass-strong)] px-2.5 py-0.5 text-[12.5px]">
                      {x}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
        <Callout>{t("claims.disclaimer")}</Callout>
      </ToolLayout>
    </div>
  );
}

function highlight(text: string, hits: ClaimHit[]): ReactNode[] {
  const out: ReactNode[] = [];
  let pos = 0;
  hits.forEach((h, i) => {
    if (h.start > pos) out.push(text.slice(pos, h.start));
    out.push(
      <mark
        key={i}
        className={cn(
          "rounded-[4px] px-0.5 text-[var(--ink)] underline decoration-2 underline-offset-4",
          TONE[h.rule] === "crit" ? "bg-[var(--crit-wash)] decoration-[var(--crit)]" : "bg-[var(--warn-wash)] decoration-[var(--warn)] decoration-dotted",
        )}
        title={h.rule}
      >
        {h.text}
      </mark>,
    );
    pos = h.end;
  });
  if (pos < text.length) out.push(text.slice(pos));
  return out;
}
