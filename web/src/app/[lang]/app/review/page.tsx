import { redirect } from "next/navigation";

/** The reviewer queue joined "İşlerim" (UX review 19.10.2026); old links land there. */
export default async function ReviewPage({ params }: PageProps<"/[lang]/app/review">) {
  const { lang } = await params;
  redirect(`/${lang}/app/tasks`);
}
