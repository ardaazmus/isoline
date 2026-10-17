"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { useEffect, useSyncExternalStore } from "react";
import { emptyClient, SAMPLE_CLIENT, type ClientData } from "@/data/sample";

export type ToolKey = Exclude<keyof ClientData, "id" | "name" | "sector" | "sample">;

type Workspace = {
  version: 1;
  clients: ClientData[];
  activeId: string;
  setActive: (id: string) => void;
  addClient: (name: string) => string;
  renameClient: (id: string, name: string) => void;
  removeClient: (id: string) => void;
  restoreSample: () => void;
  update: <K extends ToolKey>(key: K, value: ClientData[K]) => void;
  importWorkspace: (data: unknown) => { ok: true } | { ok: false; error: string };
};

const newId = () => `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export const useWorkspace = create<Workspace>()(
  persist(
    (set) => ({
      version: 1,
      clients: [structuredClone(SAMPLE_CLIENT)],
      activeId: SAMPLE_CLIENT.id,
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
        const d = data as { app?: string; clients?: ClientData[] };
        if (!d || d.app !== "isoline" || !Array.isArray(d.clients) || d.clients.length === 0) {
          return { ok: false, error: "invalid" };
        }
        const valid = d.clients.every((c) => typeof c?.id === "string" && typeof c?.name === "string" && c.profile && c.ghg && c.cbam);
        if (!valid) return { ok: false, error: "invalid_client" };
        set({ clients: d.clients, activeId: d.clients[0].id });
        return { ok: true };
      },
    }),
    {
      name: "isoline-workspace",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ version: s.version, clients: s.clients, activeId: s.activeId }),
      skipHydration: true,
    },
  ),
);

export function exportWorkspace(): string {
  const { clients } = useWorkspace.getState();
  return JSON.stringify({ app: "isoline", version: 1, exportedAt: new Date().toISOString(), clients }, null, 2);
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
