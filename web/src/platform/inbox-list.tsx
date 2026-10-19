/** Rows of waiting work (inbox-items.ts): what, where, which step, due — one link that opens the work. */
import Link from "next/link";
import { cn } from "@/components/ui";
import type { InboxItem } from "./inbox-items";
import { dateOnly, tr } from "./server";

export function InboxRows({ lang, items, showProject = true, showKind = true }: { lang: string; items: InboxItem[]; showProject?: boolean; showKind?: boolean }) {
  const t = tr(lang);
  return (
    <ul className="flex flex-col divide-y divide-[var(--rule)]">
      {items.map((x) => (
        <li key={x.key} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2.5 text-[14px]">
          {showKind && <span className="w-[118px] shrink-0 text-[12px] font-medium text-[var(--ink-3)]">{t(`pf.today.kind.${x.kind}`)}</span>}
          <span className="flex min-w-0 flex-1 flex-col">
            <Link href={x.href} className="font-medium text-[var(--b-700)]">
              {x.label}
            </Link>
            {(x.detail || showProject) && (
              <span className="text-[12.5px] text-[var(--ink-3)]">
                {[showProject ? x.project : null, x.detail || null].filter(Boolean).join(" · ")}
              </span>
            )}
          </span>
          <span className="text-[12px] text-[var(--ink-3)]">{t(`pf.steps.name.${x.step}`)}</span>
          {x.due && <span className={cn("w-[96px] text-right text-[12.5px] tabular-nums", x.overdue ? "font-semibold text-[var(--crit)]" : "text-[var(--ink-2)]")}>{dateOnly(lang, x.due)}</span>}
        </li>
      ))}
    </ul>
  );
}
