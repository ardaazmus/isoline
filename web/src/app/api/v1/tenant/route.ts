import { ifMatch, route } from "@/server/http/api";
import { TenantSettings } from "@/server/http/schemas";
import { tenantProfile, updateTenantSettings } from "@/server/tenancy/service";

export const GET = route({}, async ({ actor }) => {
  const t = await tenantProfile(actor);
  return Response.json(t, { headers: { etag: `"${t.row_version}"`, "cache-control": "no-store" } });
});

/** Name and MFA policy (SET-02); If-Match carries the row_version the editor saw. */
export const PATCH = route({ body: TenantSettings }, async ({ actor, input, req }) => {
  const version = await updateTenantSettings(actor, input, ifMatch(req));
  return Response.json({ rowVersion: version }, { headers: { etag: `"${version}"` } });
});
