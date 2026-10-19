import { route, TENANT_COOKIE, tenantActor } from "@/server/http/api";
import { ChooseTenant } from "@/server/http/schemas";

/** Chooses the acting workspace (AUTH-09). Membership and the tenant's MFA rule are checked before the cookie is set. */
export const POST = route({ tenant: "optional", body: ChooseTenant, status: 200 }, async ({ session, input, requestId, req }) => {
  const a = await tenantActor(session, input.tenantId, requestId);
  const secure = new URL(req.url).protocol === "https:" ? "; Secure" : "";
  return new Response(JSON.stringify({ actingTenantId: a.actingTenantId, role: a.role }), {
    status: 200,
    headers: { "content-type": "application/json", "set-cookie": `${TENANT_COOKIE}=${a.actingTenantId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${secure}` },
  });
});
