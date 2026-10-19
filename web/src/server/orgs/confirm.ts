/** Confirmation that an imported ("unmapped") organisation was checked by a person (G0 risk R1). */
import { audit } from "../audit/audit";
import { withActor, type Actor } from "../db/client";
import { notFound } from "../policy/policy";
import { ownerFor } from "./service";

export async function confirmOrganizationMapping(actor: Actor, organizationId: string): Promise<void> {
  await withActor(actor, async (tx) => {
    const o = await tx.selectFrom("core.organizations").select(["owner_tenant_id", "mapping_status"]).where("id", "=", organizationId).executeTakeFirst();
    if (!o) throw notFound();
    await ownerFor(tx, actor, o.owner_tenant_id);
    if (o.mapping_status === "mapped") return;
    await tx.updateTable("core.organizations").set({ mapping_status: "mapped" }).where("id", "=", organizationId).execute();
    await audit(tx, actor, { action: "org.mapping_confirm", objectType: "organization", objectId: organizationId, ownerTenantId: o.owner_tenant_id });
  });
}
