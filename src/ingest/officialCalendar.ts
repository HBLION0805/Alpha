import { USER_AGENT } from "./rss.ts";

export type ReleaseKind = "FOMC" | "CPI" | "NFP" | "PPI" | "PCE" | "GDP" | "RETAIL" | "JOLTS" | "CLAIMS" | "HOUSING" | "DURABLES" | "TRADE" | "OPEX";

export interface CalendarEvent {
  kind: ReleaseKind;
  title: string;
  /** YYYY-MM-DD (FOMC: decision day, second day of meeting) */
  date: string;
  /** HH:MM America/New_York */
  timeEt: string;
  sep?: boolean; // FOMC * = Summary of Economic Projections
  source: string; // citation URL
  /** 2 = minor 08:30 release (claims, housing starts, durables, trade): listed in the brief/calendar only — never a
   *  high-impact / 48h / 72h / NO_TRADE / 不能睡 trigger. Omitted = the original major tier. */
  tier?: 1 | 2;
  /** claims dates generated from DOL's rule ("every Thursday 8:30 ET") rather than listed one by one */
  inferred?: boolean;
}

/** Minor (tier-2) release kinds. risk.ts HIGH_IMPACT, premarket's 盘前重大数据 rule and the 72h-rule / 能不能睡 major events never include them. */
export const MINOR_KINDS = new Set<ReleaseKind>(["CLAIMS", "HOUSING", "DURABLES", "TRADE"]);
export const isMinorRelease = (e: Pick<CalendarEvent, "kind" | "tier">) => e.tier === 2 || MINOR_KINDS.has(e.kind);
export const RELEASE_ZH: Partial<Record<ReleaseKind, string>> = { CLAIMS: "初请失业金", HOUSING: "新屋开工/营建许可", DURABLES: "耐用品订单", TRADE: "贸易差额" };

/** Census economic-indicator calendar (official; the undated page shows next year, -YYYY.html a given year). */
export const censusCalendarUrl = (year: number) => `https://www.census.gov/economic-indicators/calendar-listview-${year}.html`;
const CENSUS_KINDS: Array<{ re: RegExp; kind: ReleaseKind; title: string }> = [
  { re: /^New Residential Construction/, kind: "HOUSING", title: "新屋开工/营建许可 Housing starts & building permits (Census)" },
  { re: /^Advance Report on Durable Goods/, kind: "DURABLES", title: "耐用品订单 Durable goods, advance (Census)" },
  { re: /^U\.S\. International Trade in Goods and Services/, kind: "TRADE", title: "贸易差额 Trade balance (Census/BEA)" },
];
/** Parse the Census calendar table: name · sortable YYYYMMDDHHMM key · time. Only the tier-2 kinds above; deduped by kind+date. */
export function parseCensusCalendar(html: string, source: string): CalendarEvent[] {
  const out: CalendarEvent[] = [], seen = new Set<string>();
  const re = /<tr[^>]*>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td sorttable_customkey="(\d{12})">/g;
  for (const m of html.matchAll(re)) {
    const name = m[1]!.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim(), k = m[2]!;
    const c = CENSUS_KINDS.find((x) => x.re.test(name)); if (!c) continue;
    const date = `${k.slice(0, 4)}-${k.slice(4, 6)}-${k.slice(6, 8)}`, timeEt = `${k.slice(8, 10)}:${k.slice(10, 12)}`;
    if (seen.has(c.kind + date)) continue; seen.add(c.kind + date);
    out.push({ kind: c.kind, title: c.title, date, timeEt, source, tier: 2 });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** DOL weekly claims: "published each week on Thursday morning at 8:30am" except when the Thursday is a federal holiday;
 *  the official exception list (fetched 2026-10-19) gives the replacement dates. */
export const DOL_CLAIMS_URL = "https://oui.doleta.gov/unemploy/claims_arch.asp";
export const DOL_CLAIMS_EXCEPTIONS: Record<string, string> = { "2026-11-26": "2026-11-25", "2027-11-11": "2027-11-10", "2027-11-25": "2027-11-24" };
/** Federal holidays that can fall on a Thursday: fixed-date ones on their actual date, plus Thanksgiving (4th Thursday of November). */
export function federalThursdayHolidays(year: number): string[] {
  const fixed = ["01-01", "06-19", "07-04", "11-11", "12-25"].map((md) => `${year}-${md}`).filter((d) => new Date(d + "T12:00:00Z").getUTCDay() === 4);
  const first = new Date(Date.UTC(year, 10, 1)).getUTCDay(), tg = `${year}-11-${String(1 + ((4 - first + 7) % 7) + 21).padStart(2, "0")}`;
  return [...fixed, tg].sort();
}
export function claimsEvents(year: number): { events: CalendarEvent[]; skipped: string[] } {
  const events: CalendarEvent[] = [], skipped: string[] = [], hol = new Set(federalThursdayHolidays(year));
  const d = new Date(Date.UTC(year, 0, 1)); while (d.getUTCDay() !== 4) d.setUTCDate(d.getUTCDate() + 1);
  for (; d.getUTCFullYear() === year; d.setUTCDate(d.getUTCDate() + 7)) {
    const thu = d.toISOString().slice(0, 10), ex = DOL_CLAIMS_EXCEPTIONS[thu];
    const base = { kind: "CLAIMS" as const, title: "初请失业金 Initial jobless claims (DOL)", timeEt: "08:30", source: DOL_CLAIMS_URL, tier: 2 as const };
    if (ex) events.push({ ...base, date: ex, title: `${base.title}（${thu.slice(5)} 联邦假日，DOL 官方改到周三）` });
    else if (hol.has(thu)) skipped.push(`${thu}（联邦假日，DOL 未列出替代日期 → 不登记）`);
    else events.push({ ...base, date: thu, inferred: true });
  }
  return { events, skipped };
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
