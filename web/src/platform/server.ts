/** Server-side helpers for platform pages: run a service call and turn a refusal into a screen state, not a crash. */
import { HttpError } from "@/server/policy/policy";
import { translate } from "@/i18n/core";
import { dateTimeFormat } from "@/lib/intl";

export type Attempt<T> = { ok: true; data: T } | { ok: false; status: number; code: string };

export async function attempt<T>(fn: () => Promise<T>): Promise<Attempt<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof HttpError) return { ok: false, status: e.status, code: e.code };
    throw e;
  }
}

export const tr = (lang: string) => (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars);

export function dateTime(lang: string, d: Date | string): string {
  const intl = lang === "en" ? "en-GB" : "tr-TR";
  return dateTimeFormat(intl, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(d));
}

export function dateOnly(lang: string, d: Date | string): string {
  const intl = lang === "en" ? "en-GB" : "tr-TR";
  return dateTimeFormat(intl, { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(d));
}

/** Page title per screen (WCAG 2.4.2): `export const generateMetadata = titled("pf.projects.title")`. */
export const titled =
  (key: string) =>
  async ({ params }: { params: Promise<{ lang: string }> }): Promise<{ title: string }> => ({ title: translate((await params).lang, key) });
