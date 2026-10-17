"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { useEffect, useSyncExternalStore } from "react";
import { emptyClient, SAMPLE_CLIENT, type ClientData } from "@/data/sample";
import type { FactorSet } from "@/lib/factors";
import { emptyReconciliation } from "@/lib/reconcile";

export type ToolKey = Exclude<keyof ClientData, "id" | "name" | "sector" | "sample">;

type Workspace = {
  version: 4;
  clients: ClientData[];
  activeId: string;
  /** Workspace-wide custom factor sets (bring your own data); shared by every client. */
  customSets: FactorSet[];
  saveSet: (set: FactorSet) => void;
  removeSet: (id: string) => void;
  setActive: (id: string) => void;
  addClient: (name: string) => string;
  renameClient: (id: string, name: string) => void;
  removeClient: (id: string) => void;
  restoreSample: () => void;
  update: <K extends ToolKey>(key: K, value: ClientData[K]) => void;
  importWorkspace: (data: unknown) => { ok: true } | { ok: false; error: string };
};

/**
 * v3: a grid factor picked from the library feeds the location-based factor. In v2 it was written into the
 * supplier factor, so the link is dropped and the value stays as a typed supplier factor.
 */
export function unlinkV2GridPicks(clients: ClientData[]): ClientData[] {
  return clients.map((c) =>
    c.ghg?.electricity?.some((e) => e.factorRef) ? { ...c, ghg: { ...c.ghg, electricity: c.ghg.electricity.map((e) => ({ ...e, factorRef: undefined })) } } : c,
  );
}

/**
 * v4: clients gain reconciliation data and a stored green-claims text. The sample client gets the sample's
 * values so its demo works; every other client starts empty.
 */
export function addV4Fields(clients: ClientData[]): ClientData[] {
  return clients.map((c) => {
    const isSample = c.sample && c.id === SAMPLE_CLIENT.id;
    return {
      ...c,
      reconciliation: c.reconciliation ?? (isSample ? structuredClone(SAMPLE_CLIENT.reconciliation) : emptyReconciliation()),
      claims: c.claims ?? (isSample ? structuredClone(SAMPLE_CLIENT.claims) : { text: "", lang: "tr" }),
    };
  });
}

const newId = () => `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export const useWorkspace = create<Workspace>()(
  persist(
    (set) => ({
      version: 4,
      clients: [structuredClone(SAMPLE_CLIENT)],
      activeId: SAMPLE_CLIENT.id,
      customSets: [],
      saveSet: (fs) => set((s) => ({ customSets: s.customSets.some((x) => x.id === fs.id) ? s.customSets.map((x) => (x.id === fs.id ? fs : x)) : [...s.customSets, fs] })),
      removeSet: (id) => set((s) => ({ customSets: s.customSets.filter((x) => x.id !== id) })),
      setActive: (id) => set({ activeId: id }),
      addClient: (name) => {
        const id = newId();
        set((s) => ({ clients: [...s.clients, emptyClient(id, name)], activeId: id }));
        return id;
      },
      renameClient: (id, name) => set((s) => ({ clients: s.clients.map((c) => (c.id === id ? { ...c, name } : c)) })),
      removeClient: (id) =>
        set((s) => {
          const clients = s.clients.filter((c) => c.id !== id);
          const safe = clients.length ? clients : [structuredClone(SAMPLE_CLIENT)];
          return { clients: safe, activeId: s.activeId === id ? safe[0].id : s.activeId };
        }),
      restoreSample: () =>
        set((s) => {
          const others = s.clients.filter((c) => c.id !== SAMPLE_CLIENT.id);
          return { clients: [structuredClone(SAMPLE_CLIENT), ...others], activeId: SAMPLE_CLIENT.id };
        }),
      update: (key, value) =>
        set((s) => ({ clients: s.clients.map((c) => (c.id === s.activeId ? { ...c, [key]: value } : c)) })),
      importWorkspace: (data) => {
        const d = data as { app?: string; version?: number; clients?: ClientData[]; customSets?: FactorSet[] };
        if (!d || d.app !== "isoline" || !Array.isArray(d.clients) || d.clients.length === 0) {
          return { ok: false, error: "invalid" };
        }
        const valid = d.clients.every((c) => typeof c?.id === "string" && typeof c?.name === "string" && c.profile && c.ghg && c.cbam);
        if (!valid) return { ok: false, error: "invalid_client" };
        const clients = addV4Fields((d.version ?? 2) < 3 ? unlinkV2GridPicks(d.clients) : d.clients);
        set({ clients, activeId: clients[0].id, customSets: Array.isArray(d.customSets) ? d.customSets : [] });
        return { ok: true };
      },
    }),
    {
      name: "isoline-workspace",
      version: 4,
      migrate: (persisted, from) => {
        const st = persisted as Partial<Workspace>;
        const next: Partial<Workspace> = { ...st, version: 4, customSets: st.customSets ?? [] };
        if (st.clients) next.clients = addV4Fields(from < 3 ? unlinkV2GridPicks(st.clients) : st.clients);
        return next as Workspace;
      },
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ version: s.version, clients: s.clients, activeId: s.activeId, customSets: s.customSets }),
      skipHydration: true,
    },
  ),
);

export function exportWorkspace(): string {
  const { clients, customSets } = useWorkspace.getState();
  return JSON.stringify({ app: "isoline", version: 4, exportedAt: new Date().toISOString(), clients, customSets }, null, 2);
}

/** True once local storage has been read; tools render after this to avoid hydration mismatches. */
export function useHydrated(): boolean {
  const done = useSyncExternalStore(
    (cb) => useWorkspace.persist.onFinishHydration(cb),
    () => useWorkspace.persist.hasHydrated(),
    () => false,
  );
  useEffect(() => {
    if (!useWorkspace.persist.hasHydrated()) void useWorkspace.persist.rehydrate();
  }, []);
  return done;
}

export function useActiveClient(): ClientData {
  return useWorkspace((s) => s.clients.find((c) => c.id === s.activeId) ?? s.clients[0]);
}
