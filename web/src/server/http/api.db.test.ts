/**
 * G1-02/03/04/06/09/10/12 through the real HTTP surface: Better Auth sessions (sign-up, e-mail verification,
 * sign-in, sign-out), the /api/v1 pipeline (tenant header, CSRF origin, idempotency, If-Match, MFA policy) and the
 * evidence path (quarantine → scan → presigned download). Needs PostgreSQL, Mailpit and SeaweedFS (docker compose).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as auditRoute from "@/app/api/v1/audit/route";
import * as downloadRoute from "@/app/api/v1/evidence/[evidenceId]/download/route";
import * as grantRevokeRoute from "@/app/api/v1/grants/[grantId]/route";
import * as invitationsRoute from "@/app/api/v1/invitations/route";
import * as acceptRoute from "@/app/api/v1/invitations/accept/route";
import * as previewRoute from "@/app/api/v1/invitations/preview/route";
import * as meRoute from "@/app/api/v1/me/route";
import * as memberRoute from "@/app/api/v1/members/[membershipId]/route";
import * as membersRoute from "@/app/api/v1/members/route";
import * as evidenceRoute from "@/app/api/v1/projects/[projectId]/evidence/route";
import * as grantsRoute from "@/app/api/v1/projects/[projectId]/grants/route";
import * as projectsRoute from "@/app/api/v1/projects/route";
import * as chooseRoute from "@/app/api/v1/session/tenant/route";
import * as tenantRoute from "@/app/api/v1/tenant/route";
import * as tenantsRoute from "@/app/api/v1/tenants/route";
import { closeDb, systemDb } from "../db/client";
import { eicarBytes } from "../evidence/scanner";
import { ensureBucket } from "../evidence/storage";
import { runOnce } from "../jobs/worker";
import { Browser, lastMail, linkIn, PASSWORD, signedUp, uniqueEmail } from "./test-client";

const pdf = (label: string) => new TextEncoder().encode(`%PDF-1.4\n% ${label}\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n`);
const form = (bytes: Uint8Array, filename: string) => {
  const f = new FormData();
  f.set("file", new File([bytes as BlobPart], filename));
  f.set("classification", "internal");
  return f;
};

async function openWorkspace(b: Browser, name: string, kind: "company" | "advisory") {
  const r = await b.call(tenantsRoute.POST, "POST", "/api/v1/tenants", { body: { name, kind, acceptTerms: true, termsVersion: "terms-2026-10" } });
  expect(r.status).toBe(201);
  b.tenant = String(r.json.tenantId);
  return b.tenant;
}

beforeAll(async () => {
  await ensureBucket();
});

afterAll(async () => {
  await closeDb();
});

describe("identity (G1-02)", () => {
  it("an unverified account cannot sign in; the verification link activates it", async () => {
    const b = new Browser();
    const email = uniqueEmail("unverified");
    expect((await b.auth("POST", "/sign-up/email", { email, password: PASSWORD, name: "U" })).status).toBe(200);
    const denied = await b.auth("POST", "/sign-in/email", { email, password: PASSWORD });
    expect(denied.status).toBe(403);
    const link = new URL(linkIn((await lastMail(email)).text));
    await b.auth("GET", `${link.pathname.replace(/^\/api\/auth/, "")}${link.search}`);
    expect((await b.auth("POST", "/sign-in/email", { email, password: PASSWORD })).status).toBe(200);
  });

  it("short passwords are refused", async () => {
    const r = await new Browser().auth("POST", "/sign-up/email", { email: uniqueEmail("short"), password: "kisa-sifre", name: "S" });
    expect(r.status).toBe(400);
  });

  it("no session → 401; sign-out ends the session", async () => {
    const anon = await new Browser().call(meRoute.GET, "GET", "/api/v1/me");
    expect(anon.status).toBe(401);
    const { b } = await signedUp("signout");
    expect((await b.call(meRoute.GET, "GET", "/api/v1/me")).status).toBe(200);
    const stale = b.cookieHeader();
    await b.auth("POST", "/sign-out", {});
    const again = new Browser();
    for (const p of stale.split("; ")) again.cookies.set(p.split("=")[0], p.split("=").slice(1).join("="));
    expect((await again.call(meRoute.GET, "GET", "/api/v1/me")).status).toBe(401);
  });
});

describe("tenant pipeline (G1-03/04)", () => {
  it("one person, two workspaces; the header selects, membership decides", async () => {
    const { b } = await signedUp("twohats");
    const first = await openWorkspace(b, "Birinci A.Ş.", "company");
    const second = await openWorkspace(b, "İkinci Danışmanlık", "advisory");
    const me = await b.call(meRoute.GET, "GET", "/api/v1/me");
    expect((me.json.memberships as unknown[]).length).toBe(2);
    b.tenant = first;
    const p1 = await b.call(projectsRoute.POST, "POST", "/api/v1/projects", { body: { name: "Birinci proje" } });
    b.tenant = second;
    const list = await b.call(projectsRoute.GET, "GET", "/api/v1/projects");
    expect((list.json.projects as { id: string }[]).map((p) => p.id)).not.toContain(p1.json.projectId);

    const { b: stranger } = await signedUp("stranger");
    stranger.tenant = first;
    expect((await stranger.call(projectsRoute.GET, "GET", "/api/v1/projects")).status).toBe(404);
    stranger.tenant = "not-a-uuid";
    expect((await stranger.call(projectsRoute.GET, "GET", "/api/v1/projects")).status).toBe(404);
    stranger.tenant = null;
    expect((await stranger.call(projectsRoute.GET, "GET", "/api/v1/projects")).json).toMatchObject({ error: { code: "tenant_required" } });
  });

  it("the workspace cookie is set only for a real membership", async () => {
    const { b } = await signedUp("chooser");
    const t = await openWorkspace(b, "Seçim A.Ş.", "company");
    b.tenant = null;
    const ok = await b.call(chooseRoute.POST, "POST", "/api/v1/session/tenant", { body: { tenantId: t } });
    expect(ok.status).toBe(200);
    expect(b.cookies.get("isoline_tenant")).toBe(t);
    expect((await b.call(projectsRoute.GET, "GET", "/api/v1/projects")).status).toBe(200);
    const { b: other } = await signedUp("chooser2");
    expect((await other.call(chooseRoute.POST, "POST", "/api/v1/session/tenant", { body: { tenantId: t } })).status).toBe(404);
  });

  it("refuses foreign origins on writes (CSRF)", async () => {
    const { b } = await signedUp("csrf");
    await openWorkspace(b, "CSRF A.Ş.", "company");
    const r = await b.call(projectsRoute.POST, "POST", "/api/v1/projects", { body: { name: "x" }, origin: "https://evil.example" });
    expect(r.status).toBe(403);
    expect(r.json).toMatchObject({ error: { code: "bad_origin" } });
  });

  it("validates input and replays an Idempotency-Key", async () => {
    const { b } = await signedUp("idem");
    await openWorkspace(b, "Idem A.Ş.", "company");
    expect((await b.call(projectsRoute.POST, "POST", "/api/v1/projects", { body: { name: "" } })).status).toBe(422);
    const h = { "idempotency-key": "key-0000-proj-1" };
    const a = await b.call(projectsRoute.POST, "POST", "/api/v1/projects", { body: { name: "Bir kez" }, headers: h });
    const again = await b.call(projectsRoute.POST, "POST", "/api/v1/projects", { body: { name: "Bir kez" }, headers: h });
    expect(again.json.projectId).toBe(a.json.projectId);
    expect(again.res.headers.get("idempotent-replay")).toBe("true");
    expect((await b.call(projectsRoute.POST, "POST", "/api/v1/projects", { body: { name: "Başka" }, headers: h })).status).toBe(422);
    const all = await b.call(projectsRoute.GET, "GET", "/api/v1/projects");
    expect((all.json.projects as { name: string }[]).filter((p) => p.name === "Bir kez")).toHaveLength(1);
  });

  it("settings use If-Match; a stale version gets 409", async () => {
    const { b } = await signedUp("ifmatch");
    await openWorkspace(b, "Sürüm A.Ş.", "company");
    const t = await b.call(tenantRoute.GET, "GET", "/api/v1/tenant");
    const etag = t.res.headers.get("etag")!;
    const ok = await b.call(tenantRoute.PATCH, "PATCH", "/api/v1/tenant", { body: { name: "Sürüm A.Ş. (yeni)" }, headers: { "if-match": etag } });
    expect(ok.status).toBe(200);
    const stale = await b.call(tenantRoute.PATCH, "PATCH", "/api/v1/tenant", { body: { name: "Eski sürümle" }, headers: { "if-match": etag } });
    expect(stale.status).toBe(409);
  });

  it("a workspace that requires MFA refuses members without it", async () => {
    const { b: owner } = await signedUp("mfaowner");
    await openWorkspace(owner, "MFA A.Ş.", "company");
    const { b: member, email } = await signedUp("mfamember");
    await owner.call(invitationsRoute.POST, "POST", "/api/v1/invitations", { body: { email, role: "contributor" } });
    await runOnce(50);
    const token = decodeURIComponent(new URL(linkIn((await lastMail(email)).text)).pathname.split("/").pop()!);
    expect((await member.call(acceptRoute.POST, "POST", "/api/v1/invitations/accept", { body: { token } })).status).toBe(200);
    member.tenant = owner.tenant;
    expect((await member.call(projectsRoute.GET, "GET", "/api/v1/projects")).status).toBe(200);
    // the owner also lacks MFA, so the owner turns the rule on and is then refused too: policy applies to everyone
    expect((await owner.call(tenantRoute.PATCH, "PATCH", "/api/v1/tenant", { body: { requireMfa: true } })).status).toBe(200);
    const r = await member.call(projectsRoute.GET, "GET", "/api/v1/projects");
    expect(r.status).toBe(403);
    expect(r.json).toMatchObject({ error: { code: "mfa_required" } });
  });
});

describe("invitations and members over HTTP (G1-06, G1-12)", () => {
  it("invite mail → preview (masked) → accept once; a revoked member loses API access at once", async () => {
    const { b: owner } = await signedUp("invowner");
    await openWorkspace(owner, "Davet A.Ş.", "company");
    const { b: invitee, email } = await signedUp("invitee");
    const inv = await owner.call(invitationsRoute.POST, "POST", "/api/v1/invitations", { body: { email, role: "data_owner" } });
    expect(inv.status).toBe(201);
    expect(inv.json.token).toBeUndefined();
    await runOnce(50);
    const mail = await lastMail(email);
    expect(mail.subject).toContain("Davet A.Ş.");
    const token = decodeURIComponent(new URL(linkIn(mail.text)).pathname.split("/").pop()!);

    const preview = await new Browser().call(previewRoute.POST, "POST", "/api/v1/invitations/preview", { body: { token } });
    expect(preview.status).toBe(200);
    expect(String(preview.json.email)).toMatch(/\*\*\*@/);
    expect((await invitee.call(acceptRoute.POST, "POST", "/api/v1/invitations/accept", { body: { token } })).status).toBe(200);
    expect((await invitee.call(acceptRoute.POST, "POST", "/api/v1/invitations/accept", { body: { token } })).status).toBe(410);

    // the sealed token is scrubbed from the outbox after delivery
    const ev = await systemDb().selectFrom("core.outbox_events").select(["payload", "status"]).where("dedupe_key", "=", `invitation:${inv.json.invitationId}`).executeTakeFirstOrThrow();
    expect(ev.status).toBe("done");
    expect(JSON.stringify(ev.payload)).not.toContain("sealedToken");

    invitee.tenant = owner.tenant;
    expect((await invitee.call(projectsRoute.GET, "GET", "/api/v1/projects")).status).toBe(200);
    const members = await owner.call(membersRoute.GET, "GET", "/api/v1/members");
    const m = (members.json.members as { id: string; email: string }[]).find((x) => x.email === email)!;
    expect((await owner.call(memberRoute.DELETE, "DELETE", `/api/v1/members/${m.id}`, { params: { membershipId: m.id } })).status).toBe(200);
    expect((await invitee.call(projectsRoute.GET, "GET", "/api/v1/projects")).status).toBe(404);
  });
});

describe("grants and evidence over HTTP (G1-07, G1-09, G1-10)", () => {
  it("customer grants one project; the advisory sees only it; revocation is immediate; audit chain holds", async () => {
    const { b: customer } = await signedUp("customer");
    await openWorkspace(customer, "Müşteri A.Ş.", "company");
    const shared = (await customer.call(projectsRoute.POST, "POST", "/api/v1/projects", { body: { name: "Paylaşılan" } })).json.projectId as string;
    const hidden = (await customer.call(projectsRoute.POST, "POST", "/api/v1/projects", { body: { name: "Gizli" } })).json.projectId as string;

    const { b: advisor } = await signedUp("advisor");
    const advisory = await openWorkspace(advisor, "Danışman Ltd.", "advisory");
    const g = await customer.call(grantsRoute.POST, "POST", `/api/v1/projects/${shared}/grants`, {
      params: { projectId: shared },
      body: { recipientTenantId: advisory, role: "preparer", purpose: "Rapor hazırlığı", days: 30, canDownload: true, acceptTerms: true, termsVersion: "grant-2026-10" },
    });
    expect(g.status).toBe(201);
    const seen = (await advisor.call(projectsRoute.GET, "GET", "/api/v1/projects")).json.projects as { id: string }[];
    expect(seen.map((p) => p.id)).toContain(shared);
    expect(seen.map((p) => p.id)).not.toContain(hidden);
    expect((await advisor.call(evidenceRoute.GET, "GET", `/api/v1/projects/${hidden}/evidence`, { params: { projectId: hidden } })).status).toBe(404);

    // the advisor uploads evidence into the customer's project; it is quarantined until scanned
    const up = await advisor.call(evidenceRoute.POST, "POST", `/api/v1/projects/${shared}/evidence`, { params: { projectId: shared }, form: form(pdf("fatura"), "Fatura Ocak.pdf") });
    expect(up.status).toBe(201);
    expect(up.json.scanStatus).toBe("scanning");
    const evId = String(up.json.id);
    expect((await customer.call(downloadRoute.GET, "GET", `/api/v1/evidence/${evId}/download`, { params: { evidenceId: evId } })).status).toBe(404); // not visible before release
    await runOnce(50);
    const dl = await customer.call(downloadRoute.GET, "GET", `/api/v1/evidence/${evId}/download?format=json`, { params: { evidenceId: evId } });
    expect(dl.status).toBe(200);
    const fetched = new Uint8Array(await (await fetch(String(dl.json.url))).arrayBuffer());
    expect(new TextDecoder().decode(fetched)).toContain("fatura");
    const redirect = await customer.call(downloadRoute.GET, "GET", `/api/v1/evidence/${evId}/download`, { params: { evidenceId: evId } });
    expect(redirect.status).toBe(303);

    // same content again is a duplicate, not a second object
    const dup = await advisor.call(evidenceRoute.POST, "POST", `/api/v1/projects/${shared}/evidence`, { params: { projectId: shared }, form: form(pdf("fatura"), "kopya.pdf") });
    expect(dup.json.duplicate).toBe(true);
    // disguised executables and test malware never become available
    expect((await advisor.call(evidenceRoute.POST, "POST", `/api/v1/projects/${shared}/evidence`, { params: { projectId: shared }, form: form(new Uint8Array([0x4d, 0x5a, 0x90, 0]), "fatura.pdf") })).status).toBe(415);
    const bad = await advisor.call(evidenceRoute.POST, "POST", `/api/v1/projects/${shared}/evidence`, { params: { projectId: shared }, form: form(eicarBytes(), "test.txt") });
    expect(bad.status).toBe(201);
    await runOnce(50);
    const row = await systemDb().selectFrom("core.evidence_objects").select(["scan_status", "storage_key"]).where("id", "=", String(bad.json.id)).executeTakeFirstOrThrow();
    expect(row.scan_status).toBe("quarantined");
    expect(row.storage_key.startsWith("q/")).toBe(true);

    // revocation: the advisor's next request is refused
    const grantId = String(g.json.grantId);
    expect((await customer.call(grantRevokeRoute.DELETE, "DELETE", `/api/v1/grants/${grantId}`, { params: { grantId } })).status).toBe(200);
    expect((await advisor.call(evidenceRoute.GET, "GET", `/api/v1/projects/${shared}/evidence`, { params: { projectId: shared } })).status).toBe(404);
    expect((await advisor.call(downloadRoute.GET, "GET", `/api/v1/evidence/${evId}/download`, { params: { evidenceId: evId } })).status).toBe(404);

    // the customer's audit trail shows the advisor's actions and its chain verifies
    const audit = await customer.call(auditRoute.GET, "GET", "/api/v1/audit?limit=200");
    const actions = (audit.json.events as { action: string }[]).map((e) => e.action);
    expect(actions).toEqual(expect.arrayContaining(["grant.create", "evidence.upload", "evidence.scan_clean", "evidence.quarantine", "grant.revoke"]));
    expect(audit.json.chain).toMatchObject({ ok: true });
    // the advisor reads its own workspace's trail only: none of the customer's project events appear there
    const own = await advisor.call(auditRoute.GET, "GET", "/api/v1/audit?limit=200");
    expect(own.status).toBe(200);
    expect((own.json.events as { project_id: string | null }[]).some((e) => e.project_id === shared)).toBe(false);
    advisor.tenant = customer.tenant;
    expect((await advisor.call(auditRoute.GET, "GET", "/api/v1/audit")).status).toBe(404);
  });
});
