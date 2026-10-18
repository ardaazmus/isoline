import { useSyncExternalStore } from "react";

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Calendar day (YYYY-MM-DD) of a timestamp in the viewer's time zone; ISO strings are UTC, so slicing them can show yesterday. */
export function localDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return ymd(d);
}

/** Today's calendar day in the viewer's time zone. */
export function todayLocal(now: Date = new Date()): string {
  return ymd(now);
}

/** A calendar day `n` days after `day` (negative goes back); works on the calendar, not on 24-hour steps. */
export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return ymd(new Date(y, m - 1, d + n));
}

const noSubscribe = () => () => {};

/**
 * Today on the client. While a static page is rendered on the server or hydrated it is null, so no build
 * date is baked into the HTML; the client then renders again with the real day.
 */
export function useToday(): string | null {
  return useSyncExternalStore(noSubscribe, () => todayLocal(), () => null);
}
