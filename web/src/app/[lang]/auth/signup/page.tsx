import type { Metadata } from "next";
import { translate } from "@/i18n/core";
import { SignupForm } from "@/platform/auth-forms";
import { safeNext } from "@/server/http/dal";

export async function generateMetadata({ params }: PageProps<"/[lang]/auth/signup">): Promise<Metadata> {
  const { lang } = await params;
  return { title: translate(lang, "pf.auth.signup.title") };
}

export default async function SignupPage({ params, searchParams }: PageProps<"/[lang]/auth/signup">) {
  const { lang } = await params;
  const sp = await searchParams;
  return <SignupForm lang={lang} next={safeNext(typeof sp.next === "string" ? sp.next : null, lang)} />;
}
