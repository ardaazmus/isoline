import { redirect } from "next/navigation";
import { requireWorkspace } from "@/server/http/dal";

export default async function PlatformEntry({ params }: PageProps<"/[lang]/app">) {
  const { lang } = await params;
  await requireWorkspace(lang);
  redirect(`/${lang}/app/home`);
}
