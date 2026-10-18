"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { useEffect, useSyncExternalStore } from "react";
import { emptyClient, SAMPLE_CLIENT, type ClientData } from "@/data/sample";
import { defaultNonCo2 } from "@/lib/calc/ghg";
import { lockedBy } from "@/lib/approval";
import { asRequests, requestsLockedBy, type Requests } from "@/lib/requests";
import type { FactorSet } from "@/lib/factors";
import { emptyReconciliation } from "@/lib/reconcile";

export type ToolKey = Exclude<keyof ClientData, "id" | "name" | "sector" | "sample">;

type Workspace = {
  version: 9;
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

/** v6: clients gain an import evidence log (the sample's records its trial balance import). */
export function addV6Fields(clients: ClientData[]): ClientData[] {
  return clients.map((c) => (Array.isArray(c.importLog) ? c : { ...c, importLog: c.sample && c.id === SAMPLE_CLIENT.id && c.trialBalance?.sha256 === SAMPLE_CLIENT.trialBalance?.sha256 ? structuredClone(SAMPLE_CLIENT.importLog) : [] }));
}

/**
 * v7: fuel lines gain CH₄ and N₂O factors. Lines without them get the IPCC default for their fuel and use,
 * written into the line so the stored value is the value used.
 */
export function addV7Fields(clients: ClientData[]): ClientData[] {
  return clients.map((c) =>
    c.ghg?.fuels?.some((l) => l.ch4 === undefined || l.n2o === undefined)
      ? {
          ...c,
          ghg: {
            ...c.ghg,
            fuels: c.ghg.fuels.map((l) => {
              const d = defaultNonCo2(l.fuel, l.mobile);
              return { ...l, ch4: l.ch4 ?? d.ch4, n2o: l.n2o ?? d.n2o };
            }),
          },
        }
      : c,
  );
}

/** v8: clients gain approval status per tool section; every section starts as a draft. */
export function addV8Fields(clients: ClientData[]): ClientData[] {
  return clients.map((c) => (c.approvals && typeof c.approvals === "object" ? c : { ...c, approvals: {} }));
}

/**
 * v9: clients gain a data request list. The sample client gets the sample's tracking (its accepted trial
 * balance only while the sample file is in place); every other client starts with none. Stored tracking is
 * repaired field by field so a hand-edited file cannot break the screen.
 */
export function addV9Fields(clients: ClientData[]): ClientData[] {
  return clients.map((c) => {
    if (c.requests !== undefined) return { ...c, requests: asRequests(c.requests) };
    if (!(c.sample && c.id === SAMPLE_CLIENT.id)) return { ...c, requests: asRequests(null) };
    const requests = structuredClone(SAMPLE_CLIENT.requests);
    if (c.trialBalance?.sha256 !== SAMPLE_CLIENT.trialBalance?.sha256) delete requests.items.tb_export;
    return { ...c, requests };
  });
}

/** Every migration step in order, for persisted state and imported workspace files. */
export function migrateClients(clients: ClientData[], from: number): ClientData[] {
  return addV9Fields(addV8Fields(addV7Fields(addV6Fields(addV5Fields(addV4Fields(from < 3 ? unlinkV2GridPicks(clients) : clients))))));
}

/** v5: clients gain an imported trial balance; the sample client gets the sample's, others start with none. */
export function addV5Fields(clients: ClientData[]): ClientData[] {
  return clients.map((c) => (c.trialBalance !== undefined ? c : { ...c, trialBalance: c.sample && c.id === SAMPLE_CLIENT.id ? structuredClone(SAMPLE_CLIENT.trialBalance) : null }));
}

/**
 * Shape check of an imported client: the parts the screens index into. A file that fails it is refused at
 * import rather than crashing a screen later.
 */
export function isClientShape(c: unknown): boolean {
  const x = c as Partial<ClientData> | null;
  const ghg = x?.ghg as unknown as Record<string, unknown> | undefined;
  return (
    typeof x?.id === "string" &&
    typeof x?.name === "string" &&
    Array.isArray(x.profile?.history) &&
    !!ghg &&
    ["fuels", "process", "refrigerants", "electricity", "scope3"].every((k) => Array.isArray(ghg[k])) &&
    Array.isArray(x.cbam?.products)
  );
}

const newId = () => `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export const useWorkspace = create<Workspace>()(
  persist(
    (set) => ({
      version: 9,
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
      // A change to an approved (locked) section is refused here as well as on screen; reopening unlocks it.
      // Request tracking follows the same lock, item by item.
      update: (key, value) =>
        set((s) => ({
          clients: s.clients.map((c) =>
            c.id === s.activeId && !lockedBy(c, key, value) && !(key === "requests" && requestsLockedBy(c, value as Requests)) ? { ...c, [key]: value } : c,
          ),
        })),
      importWorkspace: (data) => {
        const d = data as { app?: string; version?: number; clients?: ClientData[]; customSets?: FactorSet[] };
        if (!d || d.app !== "isoline" || !Array.isArray(d.clients) || d.clients.length === 0) {
          return { ok: false, error: "invalid" };
        }
        const valid = d.clients.every(isClientShape);
        if (!valid) return { ok: false, error: "invalid_client" };
        const clients = migrateClients(d.clients, d.version ?? 2);
        set({ clients, activeId: clients[0].id, customSets: Array.isArray(d.customSets) ? d.customSets : [] });
        return { ok: true };
      },
    }),
    {
      name: "isoline-workspace",
      version: 9,
      migrate: (persisted, from) => {
        const st = persisted as Partial<Workspace>;
        const next: Partial<Workspace> = { ...st, version: 9, customSets: st.customSets ?? [] };
        if (st.clients) next.clients = migrateClients(st.clients, from);
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
  return JSON.stringify({ app: "isoline", version: 9, exportedAt: new Date().toISOString(), clients, customSets }, null, 2);
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
