import { titled } from "@/platform/server";
import { ResetForm } from "@/platform/auth-forms";

export const generateMetadata = titled("pf.auth.reset.title");

/** Better Auth sends the person here with ?token=… (or ?error=INVALID_TOKEN for a used or expired link). */
export default async function ResetPasswordPage({ params, searchParams }: PageProps<"/[lang]/auth/reset-password">) {
  const { lang } = await params;
  const sp = await searchParams;
  return <ResetForm lang={lang} token={typeof sp.token === "string" ? sp.token : null} linkError={typeof sp.error === "string" ? sp.error : null} />;
}
