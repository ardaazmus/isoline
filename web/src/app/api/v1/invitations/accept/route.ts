import { route } from "@/server/http/api";
import { Token } from "@/server/http/schemas";
import { acceptInvitation } from "@/server/tenancy/service";

export const POST = route({ tenant: "optional", body: Token, status: 200 }, async ({ session, input }) => acceptInvitation(session.identity, input.token));
