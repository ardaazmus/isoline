"use client";

/**
 * Browser side of the platform: the Better Auth client (sign-in, sign-up, TOTP, sessions) and one fetch helper for
 * /api/v1 that adds an Idempotency-Key to every POST so a double click or a retry cannot create twice.
 */
import { twoFactorClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  plugins: [
    twoFactorClient({
      onTwoFactorRedirect() {
        const lang = window.location.pathname.split("/")[1] || "tr";
        const next = new URLSearchParams(window.location.search).get("next");
        // the plugin calls this outside any component, so there is no router to push with
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = `/${lang}/auth/mfa${next ? `?next=${encodeURIComponent(next)}` : ""}`;
      },
    }),
  ],
});

export type ApiResult<T> = { ok: true; status: number; data: T } | { ok: false; status: number; code: string; details?: unknown };

export async function api<T = Record<string, unknown>>(method: "GET" | "POST" | "PATCH" | "DELETE", path: string, body?: unknown, opts: { ifMatch?: string; form?: FormData } = {}): Promise<ApiResult<T>> {
  const headers: Record<string, string> = {};
  if (method === "POST" && !opts.form) headers["idempotency-key"] = crypto.randomUUID();
  if (opts.ifMatch) headers["if-match"] = opts.ifMatch;
  if (body !== undefined) headers["content-type"] = "application/json";
  let res: Response;
  try {
    res = await fetch(path, { method, headers, body: opts.form ?? (body === undefined ? undefined : JSON.stringify(body)), credentials: "same-origin" });
  } catch {
    return { ok: false, status: 0, code: "network_error" };
  }
  const text = await res.text();
  const json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  if (res.ok) return { ok: true, status: res.status, data: json as T };
  const err = (json.error ?? {}) as { code?: string; details?: unknown };
  return { ok: false, status: res.status, code: err.code ?? `http_${res.status}`, details: err.details };
}
