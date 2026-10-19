import { route } from "@/server/http/api";
import { ProvisionalClient } from "@/server/http/schemas";
import { createProvisionalClient } from "@/server/tenancy/service";

/** Advisory opens a provisional client (path D); the claim link goes to the customer's contact by e-mail. */
export const POST = route({ body: ProvisionalClient }, async ({ actor, input }) => {
  const r = await createProvisionalClient(actor, input);
  return { tenantId: r.tenantId };
});
