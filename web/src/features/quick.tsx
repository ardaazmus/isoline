"use client";

/**
 * Quick calculation mode (UX Faz 3): the toolkit's calculators run inside the platform as a browser-only sandbox.
 * In this mode nothing pretends to be a record — the typed-name approval bar and the source-note panel stay out
 * (approval in the platform is by verified identity), and "reset" fills the sample values.
 */
import { createContext, useContext, type ReactNode } from "react";

const QuickContext = createContext(false);

export function QuickMode({ children }: { children: ReactNode }) {
  return <QuickContext.Provider value={true}>{children}</QuickContext.Provider>;
}

export function useQuickMode(): boolean {
  return useContext(QuickContext);
}
