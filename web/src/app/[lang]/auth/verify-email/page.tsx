import { titled } from "@/platform/server";
import { VerifyNotice } from "@/platform/auth-forms";

export const generateMetadata = titled("pf.auth.verify.title");

export default async function VerifyEmailPage({ params }: PageProps<"/[lang]/auth/verify-email">) {
  const { lang } = await params;
  return <VerifyNotice lang={lang} />;
}
