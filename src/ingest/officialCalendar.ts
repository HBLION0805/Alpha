import { USER_AGENT } from "./rss.ts";

export interface CalendarEvent {
  kind: "FOMC";
  title: string;
  /** decision day (second day of meeting), YYYY-MM-DD; statement at 14:00 ET */
  date: string;
  sep: boolean; // * = Summary of Economic Projections / press-heavy meeting
}

export const FOMC_URL = "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm";
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

/** Parse the Fed's FOMC calendar page. Handles "27-28", "17-18*", "Oct/Nov 31-1". */
export function parseFomcCalendar(html: string): CalendarEvent[] {
  const out: CalendarEvent[] = [];
  const yearParts = html.split(/<h4><a id="\d+">(\d{4}) FOMC Meetings/i);
  for (let i = 1; i < yearParts.length; i += 2) {
    const year = Number(yearParts[i]);
    const body = yearParts[i + 1] ?? "";
    const re = /fomc-meeting__month[^>]*>(?:<strong>)?([^<]+)<[\s\S]*?fomc-meeting__date[^>]*>([^<]+)</gi;
    for (const m of body.matchAll(re)) {
      const monthRaw = (m[1] ?? "").trim().toLowerCase();
      const dateRaw = (m[2] ?? "").trim();
      const days = dateRaw.match(/(\d{1,2})(?:-(\d{1,2}))?/);
      if (!days) continue;
      const lastDay = Number(days[2] ?? days[1]);
      const monthNames = monthRaw.split("/");
      // multi-month meetings ("Oct/Nov 31-1") always end in the last-named month
      const mi = MONTHS.findIndex((n) => n.startsWith((monthNames[monthNames.length - 1] ?? "").trim().slice(0, 3)));
      if (mi < 0) continue;
      const y = year;
      const date = `${y}-${String(mi + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      out.push({ kind: "FOMC", title: `FOMC decision${dateRaw.includes("*") ? " + SEP/dot plot" : ""}`, date, sep: dateRaw.includes("*") });
    }
  }
  return out;
}

export async function fetchFomcCalendar(timeoutMs = 10_000): Promise<CalendarEvent[]> {
  const res = await fetch(FOMC_URL, { headers: { "user-agent": USER_AGENT }, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`FOMC calendar HTTP ${res.status}`);
  return parseFomcCalendar(await res.text());
}

export function upcoming(events: CalendarEvent[], from: Date, days = 45): CalendarEvent[] {
  const lo = from.toISOString().slice(0, 10);
  const hi = new Date(from.getTime() + days * 86400_000).toISOString().slice(0, 10);
  return events.filter((e) => e.date >= lo && e.date <= hi).sort((a, b) => a.date.localeCompare(b.date));
}
