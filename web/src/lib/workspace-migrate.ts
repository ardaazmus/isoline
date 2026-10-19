/**
 * Workspace file migrations v2 → v11 and the shape check (pure functions). Shared by the browser store
 * (src/store/workspace.ts) and the server-side legacy import (G1-11), so both read old files the same way.
 */
import { SAMPLE_CLIENT, type ClientData } from "@/data/sample";
import { defaultNonCo2 } from "@/lib/calc/ghg";
import { asRequests } from "@/lib/requests";
import { asAudit } from "@/lib/auditor";
import { asSites } from "@/lib/sites";
import { emptyReconciliation } from "@/lib/reconcile";

export const WORKSPACE_VERSION = 11;

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

/** v10: clients gain an auditor trail (notes + evidence requests); old files start empty. */
export function addV10Fields(clients: ClientData[]): ClientData[] {
  return clients.map((c) => (c.audit !== undefined ? { ...c, audit: asAudit(c.audit) } : { ...c, audit: asAudit(null) }));
}

/** v11: clients gain a site registry; old files start empty (sample keeps its demo sites). */
export function addV11Fields(clients: ClientData[]): ClientData[] {
  return clients.map((c) => (c.sites !== undefined ? { ...c, sites: asSites(c.sites) } : { ...c, sites: c.sample && c.id === SAMPLE_CLIENT.id ? structuredClone(SAMPLE_CLIENT.sites) : [] }));
}

/** Every migration step in order, for persisted state and imported workspace files. */
export function migrateClients(clients: ClientData[], from: number): ClientData[] {
  return addV11Fields(addV10Fields(addV9Fields(addV8Fields(addV7Fields(addV6Fields(addV5Fields(addV4Fields(from < 3 ? unlinkV2GridPicks(clients) : clients))))))));
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
