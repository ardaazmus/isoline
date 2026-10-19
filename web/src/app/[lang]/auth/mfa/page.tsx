import { titled } from "@/platform/server";
import { MfaForm } from "@/platform/auth-forms";
import { safeNext } from "@/server/http/dal";

export const generateMetadata = titled("pf.auth.mfa.title");

export default async function MfaPage({ params, searchParams }: PageProps<"/[lang]/auth/mfa">) {
  const { lang } = await params;
  const sp = await searchParams;
  return <MfaForm next={safeNext(typeof sp.next === "string" ? sp.next : null, lang)} />;
}
