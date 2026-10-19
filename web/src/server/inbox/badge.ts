/**
 * The menu's "My work" count. It is a convenience, so it is served from a short in-process cache per person and
 * workspace (counts only, nothing else is kept): page renders no longer wait for the whole inbox, and a person
 * clicking through pages costs one inbox computation per window (G8-07 load test).
 */
import type { Actor } from "../db/client";
import { inboxCount } from "./service";

const TTL_MS = 30_000;
const MAX_ENTRIES = 5_000;
const memo = new Map<string, { n: number; at: number }>();

export async function inboxBadge(actor: Actor): Promise<number> {
  const key = `${actor.userId}:${actor.actingTenantId ?? ""}`;
  const now = Date.now();
  const hit = memo.get(key);
  if (hit && now - hit.at < TTL_MS) return hit.n;
  const n = await inboxCount(actor);
  if (memo.size >= MAX_ENTRIES) for (const [k, v] of memo) if (now - v.at >= TTL_MS || memo.size >= MAX_ENTRIES) memo.delete(k);
  memo.set(key, { n, at: now });
  return n;
}
