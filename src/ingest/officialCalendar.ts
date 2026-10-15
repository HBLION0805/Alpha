import { USER_AGENT } from "./rss.ts";

export type ReleaseKind = "FOMC" | "CPI" | "NFP" | "PPI" | "PCE" | "GDP" | "RETAIL" | "JOLTS" | "CLAIMS" | "OPEX";

export interface CalendarEvent {
  kind: ReleaseKind;
  title: string;
  /** YYYY-MM-DD (FOMC: decision day, second day of meeting) */
  date: string;
  /** HH:MM America/New_York */
  timeEt: string;
  sep?: boolean; // FOMC * = Summary of Economic Projections
  source: string; // citation URL
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
      out.push({ kind: "FOMC", title: `FOMC decision${dateRaw.includes("*") ? " + SEP/dot plot" : ""}`, date, timeEt: "14:00", sep: dateRaw.includes("*"), source: FOMC_URL });
    }
  }
  return out;
}

/** FRED release-calendar ids. FRED mirrors BLS/BEA/Census schedules and is reachable when bls.gov blocks us. */
export const FRED_RELEASES: Array<{ kind: ReleaseKind; rid: number; title: string }> = [
  { kind: "CPI", rid: 10, title: "CPI (BLS)" },
  { kind: "NFP", rid: 50, title: "Employment Situation / NFP (BLS)" },
  { kind: "PPI", rid: 46, title: "PPI (BLS)" },
  { kind: "PCE", rid: 54, title: "Personal Income & Outlays / PCE (BEA)" },
  { kind: "GDP", rid: 53, title: "GDP (BEA)" },
  { kind: "RETAIL", rid: 9, title: "Retail sales (Census)" },
  { kind: "JOLTS", rid: 192, title: "JOLTS (BLS)" },
];
export const fredCalendarUrl = (rid: number, year: number) => `https://fred.stlouisfed.org/releases/calendar?rid=${rid}&y=${year}`;

const MONTH_RE = "(January|February|March|April|May|June|July|August|September|October|November|December)";

/** FRED lists "Tuesday November 10, 2026 ... 7:30 am ... <name>" in US Central time; convert to ET (+1h, both zones share DST rules). */
export function parseFredCalendar(html: string, kind: ReleaseKind, title: string, source: string): CalendarEvent[] {
  const text = html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
  const re = new RegExp(`(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday) ${MONTH_RE} (\\d{1,2}), (\\d{4}) (?:Updated )?(\\d{1,2}):(\\d{2}) (am|pm)`, "g");
  const out: CalendarEvent[] = [];
  for (const m of text.matchAll(re)) {
    const mi = MONTHS.indexOf(m[1]!.toLowerCase());
    let h = Number(m[4]) % 12 + (m[6] === "pm" ? 12 : 0);
    h += 1; // CT -> ET
    out.push({ kind, title, date: `${m[3]}-${String(mi + 1).padStart(2, "0")}-${m[2]!.padStart(2, "0")}`, timeEt: `${String(h).padStart(2, "0")}:${m[5]}`, source });
  }
  return out;
}

export const BEA_SCHEDULE_URL = "https://www.bea.gov/news/schedule";

/** BEA's own schedule (cross-check for GDP / PCE). Times are listed as 8:30 AM ET. */
export function parseBeaSchedule(html: string, year: number): CalendarEvent[] {
  const out: CalendarEvent[] = [];
  const re = /release-date">\s*([A-Za-z]+) (\d{1,2})[\s\S]*?release-title[^>]*>\s*([^<]+?)\s*</g;
  for (const m of html.matchAll(re)) {
    const mi = MONTHS.indexOf(m[1]!.toLowerCase());
    if (mi < 0) continue;
    const name = m[3]!.trim();
    const kind: ReleaseKind | null = /^GDP \(/.test(name) ? "GDP" : /^Personal Income and Outlays/.test(name) ? "PCE" : null;
    if (!kind) continue;
    out.push({ kind, title: `${name} (BEA)`, date: `${year}-${String(mi + 1).padStart(2, "0")}-${m[2]!.padStart(2, "0")}`, timeEt: "08:30", source: BEA_SCHEDULE_URL });
  }
  return out;
}

async function getText(url: string, timeoutMs: number): Promise<string> {
  const res = await fetch(url, { headers: { "user-agent": USER_AGENT }, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`${url} HTTP ${res.status}`);
  return res.text();
}

export interface CalendarResult {
  events: CalendarEvent[];
  errors: string[];
  usedStatic: boolean;
}

/**
 * Live calendar: Fed FOMC page + FRED release calendars (+ BEA cross-check). Any release kind that fails live
 * falls back to the committed static snapshot `calendar/releases-2026.json` (with source citations).
 */
export async function fetchReleaseCalendar(year: number, staticEvents: CalendarEvent[] = [], timeoutMs = 10_000): Promise<CalendarResult> {
  const errors: string[] = [];
  const events: CalendarEvent[] = [];
  const jobs: Array<Promise<void>> = [
    getText(FOMC_URL, timeoutMs).then((h) => void events.push(...parseFomcCalendar(h).filter((e) => e.date.startsWith(String(year)) || e.date.startsWith(String(year + 1))))),
    ...FRED_RELEASES.map((r) => getText(fredCalendarUrl(r.rid, year), timeoutMs).then((h) => void events.push(...parseFredCalendar(h, r.kind, r.title, fredCalendarUrl(r.rid, year))))),
  ];
  const results = await Promise.allSettled(jobs);
  results.forEach((r) => r.status === "rejected" && errors.push(String((r.reason as Error).message)));
  let usedStatic = false;
  const have = new Set(events.map((e) => e.kind));
  for (const e of staticEvents) if (!have.has(e.kind)) {
    events.push(e);
    usedStatic = true;
  }
  const seen = new Set<string>();
  const dedup = events.filter((e) => {
    const k = `${e.kind}|${e.date}`;
    return seen.has(k) ? false : (seen.add(k), true);
  });
  return { events: dedup.sort((a, b) => (a.date + a.timeEt).localeCompare(b.date + b.timeEt)), errors, usedStatic };
}

export function upcoming(events: CalendarEvent[], from: Date, days = 45): CalendarEvent[] {
  const lo = from.toISOString().slice(0, 10);
  const hi = new Date(from.getTime() + days * 86400_000).toISOString().slice(0, 10);
  return events.filter((e) => e.date >= lo && e.date <= hi).sort((a, b) => a.date.localeCompare(b.date));
}
