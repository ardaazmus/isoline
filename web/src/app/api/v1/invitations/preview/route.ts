import { problem, route } from "@/server/http/api";
import { Token } from "@/server/http/schemas";
import { peekInvitation } from "@/server/tenancy/service";

/** What the invite screen shows before sign-in. POST keeps the token out of URLs and logs. */
export const POST = route({ public: true, body: Token, status: 200 }, async ({ input }) => {
  const v = await peekInvitation(input.token);
  if (!v) return problem(404, "invitation_invalid");
  // the address is masked: the invitee knows it, a leaked link should not reveal it
  const [local, domain] = v.email.split("@");
  return { ...v, email: `${local.slice(0, 2)}***@${domain}` };
});
