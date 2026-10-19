import type { Metadata } from "next";
import { translate } from "@/i18n/core";
import { LoginForm } from "@/platform/auth-forms";
import { OkNote } from "@/platform/ui";
import { safeNext } from "@/server/http/dal";

export async function generateMetadata({ params }: PageProps<"/[lang]/auth/login">): Promise<Metadata> {
  const { lang } = await params;
  return { title: translate(lang, "pf.auth.login.title") };
}

export default async function LoginPage({ params, searchParams }: PageProps<"/[lang]/auth/login">) {
  const { lang } = await params;
  const sp = await searchParams;
  const next = safeNext(typeof sp.next === "string" ? sp.next : null, lang);
  return (
    <>
      {sp.reset === "1" && <OkNote>{translate(lang, "pf.auth.reset.done")}</OkNote>}
      <LoginForm lang={lang} next={next} />
    </>
  );
}
