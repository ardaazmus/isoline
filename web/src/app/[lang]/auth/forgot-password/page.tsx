import { titled } from "@/platform/server";
import { ForgotForm } from "@/platform/auth-forms";

export const generateMetadata = titled("pf.auth.forgot.title");

export default async function ForgotPasswordPage({ params }: PageProps<"/[lang]/auth/forgot-password">) {
  const { lang } = await params;
  return <ForgotForm lang={lang} />;
}
