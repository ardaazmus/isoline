import { titled } from "@/platform/server";
import { InviteView } from "@/platform/auth-forms";
import { getSession } from "@/server/http/dal";
import { peekInvitation } from "@/server/tenancy/service";

export const generateMetadata = titled("pf.invite.title");

/** AUTH-08: what the invitation is for, then sign up / sign in / accept. The address is shown masked. */
export default async function InvitePage({ params }: PageProps<"/[lang]/auth/invite/[token]">) {
  const { lang, token } = await params;
  const raw = decodeURIComponent(token);
  const view = raw.length >= 16 && raw.length <= 200 ? await peekInvitation(raw) : null;
  const session = await getSession();
  const masked = view ? { ...view, email: `${view.email.split("@")[0].slice(0, 2)}***@${view.email.split("@")[1]}` } : null;
  return <InviteView lang={lang} token={raw} preview={masked} signedInAs={session?.identity.email ?? null} />;
}
