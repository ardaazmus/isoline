"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { keysOf, makeFormatters, translate, type Formatters, type Vars } from "./core";

type I18n = {
  locale: string;
  t: (key: string, vars?: Vars) => string;
  keys: (key: string) => string[];
  fmt: Formatters;
};

const Ctx = createContext<I18n | null>(null);

export function I18nProvider({ locale, children }: { locale: string; children: ReactNode }) {
  const value = useMemo<I18n>(
    () => ({
      locale,
      t: (key, vars) => translate(locale, key, vars),
      keys: (key) => keysOf(locale, key),
      fmt: makeFormatters(locale),
    }),
    [locale],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}
