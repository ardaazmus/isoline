import { route } from "@/server/http/api";
import { CreateOrganization, TreeQuery } from "@/server/http/schemas";
import { createOrganization, organizationTree } from "@/server/orgs/service";

/** ORG-07: the organisation tree as it stood on ?asOf (default: everything with its periods). */
export const GET = route({ query: TreeQuery }, async ({ actor, input }) => organizationTree(actor, input));
export const POST = route({ body: CreateOrganization }, async ({ actor, input }) => ({ organizationId: await createOrganization(actor, input) }));
