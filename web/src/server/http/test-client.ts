/**
 * In-process HTTP client for integration tests: real Better Auth (sign-up, e-mail verification through Mailpit,
 * sign-in cookies) and the real /api/v1 route handlers, without starting Next.js.
 */
import { randomUUID } from "node:crypto";
import { auth } from "../auth/auth";

export const BASE = "http://localhost:3210";

type Handler = (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;

export class Browser {
  cookies = new Map<string, string>();
  tenant: string | null = null;

  cookieHeader(): string {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
  }

  absorb(res: Response): void {
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(";");
      const i = pair.indexOf("=");
      const k = pair.slice(0, i).trim();
      const v = pair.slice(i + 1).trim();
      if (/max-age=0/i.test(c) || v === "") this.cookies.delete(k);
      else this.cookies.set(k, v);
    }
  }

  request(method: string, path: string, opts: { body?: unknown; headers?: Record<string, string>; form?: FormData; origin?: string | null } = {}): Request {
    const headers = new Headers(opts.headers);
    if (this.cookies.size) headers.set("cookie", this.cookieHeader());
    if (this.tenant && !headers.has("x-isoline-tenant")) headers.set("x-isoline-tenant", this.tenant);
    if (opts.origin !== null && method !== "GET") headers.set("origin", opts.origin ?? BASE);
    let body: BodyInit | undefined;
    if (opts.form) body = opts.form;
    else if (opts.body !== undefined) {
      headers.set("content-type", "application/json");
      body = JSON.stringify(opts.body);
    }
    return new Request(`${BASE}${path}`, { method, headers, body });
  }

  async auth(method: string, path: string, body?: unknown): Promise<Response> {
    const res = await auth().handler(this.request(method, `/api/auth${path}`, { body }));
    this.absorb(res);
    return res;
  }

  async call(handler: Handler, method: string, path: string, opts: { body?: unknown; params?: Record<string, string>; headers?: Record<string, string>; form?: FormData; origin?: string | null } = {}): Promise<{ status: number; json: Record<string, unknown>; res: Response }> {
    const res = await handler(this.request(method, path, opts), { params: Promise.resolve(opts.params ?? {}) });
    this.absorb(res);
    const text = await res.clone().text();
    return { status: res.status, json: text ? JSON.parse(text) : {}, res };
  }
}

const mailApi = () => process.env.MAIL_API_URL ?? "http://127.0.0.1:8125";

/** Waits for the newest message to `to` and returns its text body. */
export async function lastMail(to: string, timeoutMs = 8000): Promise<{ subject: string; text: string }> {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    const r = await fetch(`${mailApi()}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}&limit=1`);
    const j = (await r.json()) as { messages: { ID: string; Subject: string }[] };
    if (j.messages?.length) {
      const m = (await (await fetch(`${mailApi()}/api/v1/message/${j.messages[0].ID}`)).json()) as { Text: string; Subject: string };
      return { subject: m.Subject, text: m.Text };
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`no mail to ${to}`);
}

export const linkIn = (text: string) => {
  const m = /(https?:\/\/\S+)/.exec(text);
  if (!m) throw new Error("no link in mail");
  return m[1];
};

export const uniqueEmail = (label: string) => `${label}.${randomUUID().slice(0, 8)}@api-test.test`;

export const PASSWORD = "correct horse battery staple 42";

/** Sign-up → verification mail → link → signed-in browser (the full G1-02 path). */
export async function signedUp(label: string): Promise<{ b: Browser; email: string; userId: string }> {
  const b = new Browser();
  const email = uniqueEmail(label);
  const up = await b.auth("POST", "/sign-up/email", { email, password: PASSWORD, name: label });
  if (up.status !== 200) throw new Error(`sign-up ${up.status}: ${await up.text()}`);
  const link = new URL(linkIn((await lastMail(email)).text));
  b.cookies.clear();
  const v = await b.auth("GET", `${link.pathname.replace(/^\/api\/auth/, "")}${link.search}`);
  if (v.status >= 400) throw new Error(`verify ${v.status}`);
  const s = await b.auth("POST", "/sign-in/email", { email, password: PASSWORD });
  if (s.status !== 200) throw new Error(`sign-in ${s.status}: ${await s.text()}`);
  const j = (await s.json()) as { user: { id: string } };
  return { b, email, userId: j.user.id };
}
