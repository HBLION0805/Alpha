/** Static, hand-registered earnings weeks (knowledge/calendar/earnings-week-*.json). Pure render: today's + tomorrow's (ET) reports. */
import { readdirSync, readFileSync } from "node:fs";

export interface EarningsWeekEvent { dateET: string; timing: "BMO" | "AMC"; symbol: string; themes: string[]; source: string; note?: string }
export interface EarningsWeekFile { window: [string, string]; reminders: string[]; events: EarningsWeekEvent[] }

export function loadEarningsWeeks(dir: URL): EarningsWeekFile[] {
  try { return readdirSync(dir).filter((f) => /^earnings-week-.*\.json$/.test(f)).map((f) => JSON.parse(readFileSync(new URL(f, dir), "utf8")) as EarningsWeekFile); } catch { return []; }
}

const addDay = (d: string) => { const t = new Date(`${d}T12:00:00Z`); t.setUTCDate(t.getUTCDate() + 1); return t.toISOString().slice(0, 10); };

/** day = YYYY-MM-DD in ET. Returns [] when neither day falls in a registered week. */
export function renderEarningsWeek(files: EarningsWeekFile[], day: string): string[] {
  const tomorrow = addDay(day), out: string[] = [];
  const active = files.filter((f) => (day >= f.window[0] && day <= f.window[1]) || (tomorrow >= f.window[0] && tomorrow <= f.window[1]));
  if (!active.length) return out;
  const ev = active.flatMap((f) => f.events);
  for (const [label, d] of [["今日", day], ["明日", tomorrow]] as const) {
    for (const t of ["BMO", "AMC"] as const) {
      const xs = ev.filter((e) => e.dateET === d && e.timing === t);
      if (xs.length) out.push(`- ${label} ${d} ${t === "BMO" ? "盘前 BMO" : "盘后 AMC"}：${xs.map((e) => e.symbol + (e.themes.length ? `【${e.themes.join("/")}】` : "")).join("、")}`);
    }
  }
  if (!out.length) out.push("- 今日/明日无已登记财报");
  for (const r of new Set(active.flatMap((f) => f.reminders))) out.push(`- ⚠️ ${r}`);
  return out;
}
