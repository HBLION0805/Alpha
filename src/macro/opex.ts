/**
 * DK addition: monthly equity-options expiration (OpEx), the 3rd Friday of each month.
 * When the 3rd Friday is an NYSE holiday (e.g. Juneteenth 2026-06-19, 2027-06-18) expiry moves to the previous trading day
 * (opexDate; holiday list in nyse.ts, 2026–2028). Quarterly (Mar/Jun/Sep/Dec) = quad witching.
 */
import type { CalendarEvent } from "../ingest/officialCalendar.ts";
import { NYSE_HOLIDAYS, prevTradingDay, addDays, dow } from "./nyse.ts";
export function thirdFriday(year: number, month0: number): string {
  const dow = new Date(Date.UTC(year, month0, 1)).getUTCDay();
  const day = 1 + ((5 - dow + 7) % 7) + 14;
  return `${year}-${String(month0 + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
/** Monthly OpEx expiry date: 3rd Friday, or the previous trading day when that Friday is an NYSE holiday. */
export function opexDate(year: number, month0: number): string { const f = thirdFriday(year, month0); return NYSE_HOLIDAYS[f] ? prevTradingDay(f) : f; }
export const isQuadWitching = (month0: number) => month0 % 3 === 2;
/** OpEx week (Mon–Fri) containing the given date, or null when the date's month OpEx isn't in that week. */
export function opexWeek(d: string): { opex: string; quad: boolean; monday: string } | null {
  const y = Number(d.slice(0, 4)), m = Number(d.slice(5, 7)) - 1, o = opexDate(y, m), monday = addDays(o, -((dow(o) + 6) % 7));
  return d >= monday && d <= addDays(monday, 4) ? { opex: o, quad: isQuadWitching(m), monday } : null;
}
export function opexEvents(year: number): CalendarEvent[] {
  return Array.from({ length: 12 }, (_, m) => ({ kind: "OPEX" as const, title: "月度期权到期 OpEx（DK 补充，每月第三个周五）", date: opexDate(year, m), timeEt: "16:00", source: "DK addition: rule = 3rd Friday of the month (previous trading day if NYSE holiday)" }));
}
/** append OpEx events unless the calendar already has them */
export function withOpex(cal: CalendarEvent[], year: number): CalendarEvent[] {
  return cal.some((e) => e.kind === "OPEX") ? cal : [...cal, ...opexEvents(year), ...opexEvents(year + 1).slice(0, 1)].sort((a, b) => a.date.localeCompare(b.date));
}
