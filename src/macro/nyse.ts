/**
 * NYSE market holidays and early closes, hard-coded from the official list
 * https://www.nyse.com/markets/hours-calendars (fetched 2026-10-18; covers 2026–2028). Update when NYSE publishes 2029.
 * Dates outside 2026–2028 → `covered()` is false; callers must say so rather than guess.
 */
export const NYSE_SOURCE = "https://www.nyse.com/markets/hours-calendars";
export const NYSE_YEARS = [2026, 2027, 2028] as const;
export const NYSE_HOLIDAYS: Record<string, string> = {
  "2026-01-01": "元旦 New Year's Day", "2026-01-19": "马丁·路德·金纪念日 MLK Day", "2026-02-16": "总统日 Washington's Birthday", "2026-04-03": "耶稣受难日 Good Friday",
  "2026-05-25": "阵亡将士纪念日 Memorial Day", "2026-06-19": "六月节 Juneteenth", "2026-07-03": "独立日（补休）Independence Day observed", "2026-09-07": "劳动节 Labor Day",
  "2026-11-26": "感恩节 Thanksgiving", "2026-12-25": "圣诞节 Christmas",
  "2027-01-01": "元旦 New Year's Day", "2027-01-18": "马丁·路德·金纪念日 MLK Day", "2027-02-15": "总统日 Washington's Birthday", "2027-03-26": "耶稣受难日 Good Friday",
  "2027-05-31": "阵亡将士纪念日 Memorial Day", "2027-06-18": "六月节（补休）Juneteenth observed", "2027-07-05": "独立日（补休）Independence Day observed", "2027-09-06": "劳动节 Labor Day",
  "2027-11-25": "感恩节 Thanksgiving", "2027-12-24": "圣诞节（补休）Christmas observed",
  // 2028: no New Year's Day holiday (Jan 1 is a Saturday)
  "2028-01-17": "马丁·路德·金纪念日 MLK Day", "2028-02-21": "总统日 Washington's Birthday", "2028-04-14": "耶稣受难日 Good Friday", "2028-05-29": "阵亡将士纪念日 Memorial Day",
  "2028-06-19": "六月节 Juneteenth", "2028-07-04": "独立日 Independence Day", "2028-09-04": "劳动节 Labor Day", "2028-11-23": "感恩节 Thanksgiving", "2028-12-25": "圣诞节 Christmas",
};
/** 13:00 ET early closes (13:15 for eligible options), as listed by NYSE. */
export const NYSE_EARLY_CLOSE: Record<string, string> = {
  "2026-11-27": "感恩节次日（黑色星期五）13:00 收盘", "2026-12-24": "平安夜 13:00 收盘",
  "2027-11-26": "感恩节次日（黑色星期五）13:00 收盘",
  "2028-07-03": "独立日前一天 13:00 收盘", "2028-11-24": "感恩节次日（黑色星期五）13:00 收盘",
};
export const addDays = (d: string, n: number) => new Date(Date.parse(d + "T12:00:00Z") + n * 86400_000).toISOString().slice(0, 10);
export const dow = (d: string) => new Date(d + "T12:00:00Z").getUTCDay(); // 0 Sun … 6 Sat
export const covered = (d: string) => (NYSE_YEARS as readonly number[]).includes(Number(d.slice(0, 4)));
export const isTradingDay = (d: string) => dow(d) !== 0 && dow(d) !== 6 && !NYSE_HOLIDAYS[d];
export function nextTradingDay(d: string): string { let x = addDays(d, 1); while (!isTradingDay(x)) x = addDays(x, 1); return x; }
export function prevTradingDay(d: string): string { let x = addDays(d, -1); while (!isTradingDay(x)) x = addDays(x, -1); return x; }
/** 4th Thursday of November */
export function thanksgiving(year: number): string {
  const first = new Date(Date.UTC(year, 10, 1)).getUTCDay();
  return `${year}-11-${String(1 + ((4 - first + 7) % 7) + 21).padStart(2, "0")}`;
}
export const etDate = (now: Date) => now.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
