import { LOCALES, MESSAGES } from "./generated";

export type LocaleCode = (typeof LOCALES)[number]["code"];
export type Vars = Record<string, string | number>;

export const DEFAULT_LOCALE = "tr";

export function isLocale(value: string): value is LocaleCode {
  return LOCALES.some((l) => l.code === value);
}

export function localeInfo(code: string) {
  return LOCALES.find((l) => l.code === code) ?? LOCALES.find((l) => l.code === DEFAULT_LOCALE)!;
}

function lookup(tree: unknown, key: string): unknown {
  let node: unknown = tree;
  for (const part of key.split(".")) {
    if (node && typeof node === "object" && part in (node as Record<string, unknown>)) {
      node = (node as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return node;
}

export function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

/** Resolves a key in the requested language, then Turkish, then returns the key itself. */
export function resolve(locale: string, key: string): unknown {
  const own = lookup(MESSAGES[locale], key);
  if (own !== undefined) return own;
  return lookup(MESSAGES[DEFAULT_LOCALE], key);
}

export function translate(locale: string, key: string, vars?: Vars): string {
  const value = resolve(locale, key);
  if (typeof value === "string") return interpolate(value, vars);
  if (process.env.NODE_ENV !== "production") {
    console.warn(`[i18n] missing string: ${key}`);
  }
  return key;
}

/** Lists the child keys of a message object, e.g. the section ids of a template. */
export function keysOf(locale: string, key: string): string[] {
  const value = resolve(locale, key);
  return value && typeof value === "object" ? Object.keys(value as object) : [];
}

export function makeFormatters(locale: string) {
  const intl = localeInfo(locale).intl;
  const cache = new Map<string, Intl.NumberFormat>();
  const nf = (opts: Intl.NumberFormatOptions) => {
    const k = JSON.stringify(opts);
    let f = cache.get(k);
    if (!f) {
      f = new Intl.NumberFormat(intl, opts);
      cache.set(k, f);
    }
    return f;
  };
  return {
    number: (v: number, digits = 0) =>
      Number.isFinite(v) ? nf({ maximumFractionDigits: digits, minimumFractionDigits: digits }).format(v) : "—",
    compact: (v: number) =>
      Number.isFinite(v) ? nf({ notation: "compact", maximumFractionDigits: 1 }).format(v) : "—",
    percent: (v: number, digits = 1) =>
      Number.isFinite(v) ? nf({ style: "percent", maximumFractionDigits: digits, minimumFractionDigits: digits }).format(v) : "—",
    currency: (v: number, currency = "EUR", digits = 0) =>
      Number.isFinite(v)
        ? nf({ style: "currency", currency, maximumFractionDigits: digits, minimumFractionDigits: digits }).format(v)
        : "—",
    date: (iso: string) => {
      const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
      return Number.isNaN(d.getTime())
        ? iso
        : new Intl.DateTimeFormat(intl, { day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
    },
  };
}

export type Formatters = ReturnType<typeof makeFormatters>;
