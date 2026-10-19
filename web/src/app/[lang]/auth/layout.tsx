import Link from "next/link";

/** Identity screens (AUTH-01..08): one calm centred card, no navigation. */
export default async function AuthLayout({ children, params }: LayoutProps<"/[lang]/auth">) {
  const { lang } = await params;
  return (
    <main id="main" className="relative z-[1] grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-[440px]">
        <Link href={`/${lang}`} className="mb-6 flex items-center justify-center gap-2 no-underline">
          <svg width="26" height="26" viewBox="0 0 22 22" aria-hidden>
            <path d="M2 14c3-5 6-7 9-7s6 2 9 7" fill="none" stroke="var(--b-600)" strokeWidth="2" strokeLinecap="round" />
            <path d="M5 16c2-3 4-4.5 6-4.5s4 1.5 6 4.5" fill="none" stroke="var(--b-400)" strokeWidth="2" strokeLinecap="round" />
            <circle cx="11" cy="17" r="1.8" fill="var(--b-800)" />
          </svg>
          <span className="text-[20px] font-semibold tracking-[-0.02em] text-[var(--ink)]">Isoline</span>
        </Link>
        <div className="glass glass-strong flex flex-col gap-5 p-6 md:p-8">{children}</div>
      </div>
    </main>
  );
}
