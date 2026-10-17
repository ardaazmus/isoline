/**
 * Green-claim screening against Directive (EU) 2024/825 (Empowering Consumers for the Green Transition),
 * applicable from 27.09.2026. It amends the Unfair Commercial Practices Directive:
 *   Annex I 4a — generic environmental claims without recognised excellent environmental performance
 *   Annex I 4c — claims that a product has a neutral, reduced or positive impact based on offsetting
 *   Art. 6(2)(d) — future environmental performance claims without clear, verifiable commitments and an
 *                  independently verified implementation plan
 * The screen flags wording for human review; it does not decide whether a claim is unlawful.
 * Phrase lists are language data: add a language by adding its list.
 */

export type ClaimRule = "generic" | "offset" | "future" | "absolute";

export type ClaimHit = { rule: ClaimRule; start: number; end: number; text: string };

type Pattern = { rule: ClaimRule; re: RegExp };

const W = "[\\p{L}\\p{N}]"; // a word character in any script
const b = (s: string) => `(?<!${W})(?:${s})(?!${W})`;

/** Phrase patterns per language. Turkish is matched on a Turkish-lowercased copy of the text. */
const PATTERNS: Record<string, Pattern[]> = {
  tr: [
    { rule: "generic", re: new RegExp(b("çevre dostu|doğa dostu|iklim dostu|ekolojik|eko dostu|yeşil (?:ürün|üretim|şirket|marka|çözüm|enerji)|çevreye duyarlı|doğaya saygılı|sürdürülebilir (?:ürün|ambalaj|üretim)|karbon dostu|gezegen dostu"), "gu") },
    { rule: "offset", re: new RegExp(b("karbon nötr|iklim nötr|karbonsuz|sıfır karbon|net sıfır (?:ürün|hizmet|ambalaj)|karbon (?:dengelenmiş|telafi edilmiş|ayak izi sıfır)|emisyonları(?:nı)? dengeledik|co2 nötr|co₂ nötr"), "gu") },
    { rule: "future", re: new RegExp(`${b("(?:20[2-6]\\d|20[2-6]\\d yılına kadar|20[2-6]\\d'?(?:e|a|te|ta|de|da) kadar)")}[^.!?\\n]{0,60}${b("net sıfır|karbon nötr|iklim nötr|nötr|sıfır emisyon")}|${b("net sıfır|karbon nötr|iklim nötr|sıfır emisyon")}[^.!?\\n]{0,40}${b("20[2-6]\\d")}`, "gu") },
    { rule: "absolute", re: new RegExp(b("%100 (?:yeşil|temiz|doğal|çevre dostu|geri dönüştürülebilir)|tamamen (?:yeşil|temiz|zararsız)|en yeşil|sıfır etki|zararsız"), "gu") },
  ],
  en: [
    { rule: "generic", re: new RegExp(b("eco-?friendly|environmentally friendly|nature'?s friend|climate[- ]friendly|planet[- ]friendly|green (?:product|company|brand|solution|energy)|ecological|eco|earth[- ]friendly|sustainable (?:product|packaging|production)|conscious"), "giu") },
    { rule: "offset", re: new RegExp(b("carbon[- ]neutral|climate[- ]neutral|co2[- ]neutral|co₂[- ]neutral|carbon[- ]free|net[- ]zero (?:product|service|packaging)|climate[- ]positive|carbon[- ](?:offset|compensated)|we offset (?:our|all) emissions"), "giu") },
    { rule: "future", re: new RegExp(`${b("(?:by |until |before )?20[2-6]\\d")}[^.!?\\n]{0,60}${b("net[- ]zero|carbon[- ]neutral|climate[- ]neutral|zero emissions?")}|${b("net[- ]zero|carbon[- ]neutral|climate[- ]neutral|zero emissions?")}[^.!?\\n]{0,40}${b("20[2-6]\\d")}`, "giu") },
    { rule: "absolute", re: new RegExp(b("100% (?:green|clean|natural|recyclable)|completely (?:green|clean|harmless)|greenest|zero impact|harmless"), "giu") },
  ],
};

export const CLAIM_LANGS = Object.keys(PATTERNS);

/** Severity order used to keep one hit per overlapping span. */
const RANK: Record<ClaimRule, number> = { offset: 0, future: 1, absolute: 2, generic: 3 };

export function screenClaims(text: string, lang: string): ClaimHit[] {
  const patterns = PATTERNS[lang] ?? PATTERNS.tr;
  // Turkish lower-casing keeps string length (İ→i, I→ı), so indexes map back to the original text.
  const hay = lang === "tr" ? text.toLocaleLowerCase("tr") : text;
  const raw: ClaimHit[] = [];
  for (const p of patterns) {
    for (const m of hay.matchAll(p.re)) {
      const start = m.index ?? 0;
      raw.push({ rule: p.rule, start, end: start + m[0].length, text: text.slice(start, start + m[0].length) });
    }
  }
  raw.sort((a, c) => a.start - c.start || RANK[a.rule] - RANK[c.rule] || c.end - a.end);
  const out: ClaimHit[] = [];
  for (const h of raw) {
    const prev = out[out.length - 1];
    if (prev && h.start < prev.end) {
      if (RANK[h.rule] < RANK[prev.rule]) out[out.length - 1] = { ...h, start: Math.min(h.start, prev.start), end: Math.max(h.end, prev.end), text: text.slice(Math.min(h.start, prev.start), Math.max(h.end, prev.end)) };
      else if (h.end > prev.end && h.rule === prev.rule) out[out.length - 1] = { ...prev, end: h.end, text: text.slice(prev.start, h.end) };
      continue;
    }
    out.push(h);
  }
  return out;
}

export function countByRule(hits: ClaimHit[]): Record<ClaimRule, number> {
  const c: Record<ClaimRule, number> = { offset: 0, future: 0, absolute: 0, generic: 0 };
  hits.forEach((h) => c[h.rule]++);
  return c;
}
