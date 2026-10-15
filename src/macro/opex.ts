/**
 * DK addition: monthly equity-options expiration (OpEx), the 3rd Friday of each month.
 * Exchange holidays aren't handled; when the 3rd Friday is a holiday, expiry moves to Thursday. Check the exchange calendar.
 */
import type { CalendarEvent } from "../ingest/officialCalendar.ts";
export function thirdFriday(year: number, month0: number): string {
  const dow = new Date(Date.UTC(year, month0, 1)).getUTCDay();
  const day = 1 + ((5 - dow + 7) % 7) + 14;
  return `${year}-${String(month0 + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
export function opexEvents(year: number): CalendarEvent[] {
  return Array.from({ length: 12 }, (_, m) => ({ kind: "OPEX" as const, title: "月度期权到期 OpEx（DK 补充，每月第三个周五）", date: thirdFriday(year, m), timeEt: "16:00", source: "DK addition: rule = 3rd Friday of the month" }));
}
/** append OpEx events unless the calendar already has them */
export function withOpex(cal: CalendarEvent[], year: number): CalendarEvent[] {
  return cal.some((e) => e.kind === "OPEX") ? cal : [...cal, ...opexEvents(year), ...opexEvents(year + 1).slice(0, 1)].sort((a, b) => a.date.localeCompare(b.date));
}
