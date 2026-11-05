/**
 * Regional Reserve Bank presidents' speaking events.
 * 1) OFFICIAL: each bank's own speeches/events page (scan for dates in the window near the president's name).
 * 2) SECONDARY (labeled): metalsmine.com economic calendar (ForexFactory network) weekly JSON — exact UTC timestamp
 *    per "US FOMC Member X Speaks" row; topic from the event's own history page.
 * Per-bank fetch failure → status "unavailable" with the reason. Nothing is ever invented.
 * 2026 voters verified 2026-10-15 from federalreserve.gov/monetarypolicy/fomc.htm + Jan 2026 minutes:
 * NY (permanent), Cleveland, Philadelphia, Dallas, Minneapolis. Atlanta: interim president Cheryl Venable (Bostic retired 2026-02-28).
 */
import type { FedSpeech } from "./fedSpeakers.ts";

export interface Bank { bank: string; president: string; last: string; voter2026: boolean; urls: string[] }
export const BANKS: Bank[] = [
  { bank: "Boston", president: "Susan M. Collins", last: "Collins", voter2026: false, urls: ["https://www.bostonfed.org/news-and-events/speeches.aspx", "https://www.bostonfed.org/news-and-events/events.aspx"] },
  { bank: "New York", president: "John C. Williams", last: "Williams", voter2026: true, urls: ["https://www.newyorkfed.org/newsevents/speeches", "https://www.newyorkfed.org/newsevents/events"] },
  { bank: "Philadelphia", president: "Anna Paulson", last: "Paulson", voter2026: true, urls: ["https://www.philadelphiafed.org/calendar-of-events"] },
  { bank: "Cleveland", president: "Beth M. Hammack", last: "Hammack", voter2026: true, urls: ["https://www.clevelandfed.org/collections/speeches", "https://www.clevelandfed.org/events"] },
  { bank: "Richmond", president: "Thomas I. Barkin", last: "Barkin", voter2026: false, urls: ["https://www.richmondfed.org/press_room/speeches"] },
  { bank: "Atlanta", president: "Cheryl L. Venable (interim)", last: "Venable", voter2026: false, urls: ["https://www.atlantafed.org/news/speeches"] },
  { bank: "Chicago", president: "Austan D. Goolsbee", last: "Goolsbee", voter2026: false, urls: ["https://www.chicagofed.org/utilities/about-us/office-of-the-president/office-of-the-president-speaking"] },
  { bank: "St. Louis", president: "Alberto G. Musalem", last: "Musalem", voter2026: false, urls: ["https://www.stlouisfed.org/from-the-president/speeches-and-presentations"] },
  { bank: "Minneapolis", president: "Neel Kashkari", last: "Kashkari", voter2026: true, urls: ["https://www.minneapolisfed.org/people/neel-kashkari"] },
  { bank: "Kansas City", president: "Jeffrey R. Schmid", last: "Schmid", voter2026: false, urls: ["https://www.kansascityfed.org/speeches/"] },
  { bank: "Dallas", president: "Lorie K. Logan", last: "Logan", voter2026: true, urls: ["https://www.dallasfed.org/news/speeches/logan"] },
  { bank: "San Francisco", president: "Mary C. Daly", last: "Daly", voter2026: false, urls: ["https://www.frbsf.org/news-and-media/speeches/mary-c-daly/"] },
];
const BOARD = ["Warsh", "Jefferson", "Bowman", "Barr", "Cook", "Waller", "Powell", "Miran"];
export const SECONDARY = "https://www.metalsmine.com/calendar";

export interface Coverage { bank: string; president: string; voter2026: boolean; official: string; secondary: string }

const MON = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
export function textLines(html: string): string[] {
  const t = html.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, "\n")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#8217;|&rsquo;/g, "’").replace(/&#\d+;/g, " ");
  return t.split("\n").map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
}
/** All YYYY-MM-DD dates written in a line ("October 16, 2026", "Oct. 16, 2026", "10/16/2026", "2026-10-16"). */
export function datesIn(line: string): string[] {
  const out: string[] = [];
  for (const m of line.matchAll(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2}),?\s+(20\d\d)\b/gi))
    out.push(`${m[3]}-${String(MON.indexOf(m[1]!.slice(0, 3).toLowerCase()) + 1).padStart(2, "0")}-${m[2]!.padStart(2, "0")}`);
  for (const m of line.matchAll(/\b(\d{1,2})\/(\d{1,2})\/(20\d\d)\b/g)) out.push(`${m[3]}-${m[1]!.padStart(2, "0")}-${m[2]!.padStart(2, "0")}`);
  for (const m of line.matchAll(/\b(20\d\d)-(\d\d)-(\d\d)\b/g)) out.push(m[0]);
  return out;
}
function etTime(s: string): string | null {
  const m = /\b(\d{1,2})(?::(\d\d))?\s*([ap])\.?m\.?\s*(ET|EDT|EST|Eastern)?/i.exec(s); if (!m || !m[4]) return null; // only explicit Eastern times
  let h = Number(m[1]) % 12; if (m[3]!.toLowerCase() === "p") h += 12; return `${String(h).padStart(2, "0")}:${m[2] ?? "00"}`;
}

/** Official page scan: each line naming the president is paired with its NEAREST dated line (±3); kept only if that date is in the window. */
export function scanOfficial(html: string, b: Bank, from: string, to: string, url: string): FedSpeech[] {
  const L = textLines(html), out: FedSpeech[] = [], seen = new Set<string>();
  L.forEach((l, i) => {
    if (!l.includes(b.last)) return;
    let j = -1; for (let k = 0; k <= 3 && j < 0; k++) { if (datesIn(L[i + k] ?? "").length) j = i + k; else if (k && datesIn(L[i - k] ?? "").length) j = i - k; }
    if (j < 0) return;
    for (const d of datesIn(L[j]!)) {
      if (d < from || d > to || seen.has(d)) continue; seen.add(d);
      const ctx = L.slice(Math.max(0, Math.min(i, j) - 1), Math.max(i, j) + 2);
      const topic = ctx.find((c) => c.length > 15 && !datesIn(c).length && !c.includes(b.last)) ?? "";
      out.push({ date: d, timeEt: etTime(ctx.join(" ")), kind: /testimony/i.test(ctx.join(" ")) ? "testimony" : "speech", speaker: b.president, role: `${b.bank} Fed President`,
        voter: b.voter2026, topic, location: "", source: url, bank: b.bank, sourceKind: "official" });
    }
  });
  return out;
}

/** Secondary: metalsmine weekly calendar JSON rows. Returns US Fed-speaker rows with exact ET time from the UTC dateline. */
export function parseSecondaryWeek(html: string): Array<{ last: string; dateEt: string; timeEt: string; solo: string; title: string }> {
  const out: Array<{ last: string; dateEt: string; timeEt: string; solo: string; title: string }> = [];
  for (const m of html.matchAll(/"name":"([^"]*)"[^{}]*?"dateline":(\d+),"country":"US"[^{}]*?"timeLabel":"([^"]*)"[^{}]*?"soloUrl":"([^"]*)"/g)) {
    const name = m[1]!, nm = /(?:FOMC Member|Fed Chair(?:man)?|Fed Vice Chair(?: for Supervision)?|Fed Governor)\s+([A-Z][a-z]+)\s+(Speaks|Testifies)/.exec(name);
    if (!nm || !/\d/.test(m[3]!)) continue; // "Tentative"/"All Day" → no time claimed
    const d = new Date(Number(m[2]) * 1000), f = (o: Intl.DateTimeFormatOptions) => d.toLocaleString("en-CA", { timeZone: "America/New_York", ...o });
    out.push({ last: nm[1]!, dateEt: f({ year: "numeric", month: "2-digit", day: "2-digit" }), timeEt: f({ hour: "2-digit", minute: "2-digit", hour12: false }).replace(/^24/, "00"), solo: m[4]!.replace(/\\\//g, "/"), title: name });
  }
  return out;
}
/** Topic from the event's history page row "Oct 15, 2026 | Due to speak at ...". */
export function secondaryTopic(html: string, date: string): string {
  const L = textLines(html);
  for (let i = 0; i < L.length; i++) if (datesIn(L[i]!).includes(date)) { const t = [L[i], L[i + 1]].find((x) => x && /Due to|testify|speak/i.test(x)); if (t) return t.replace(/^.*?(Due to)/, "$1"); }
  return "";
}

const wkStart = (d: string) => { const t = new Date(d + "T12:00:00Z"); t.setUTCDate(t.getUTCDate() - t.getUTCDay()); return t; };
const wkParam = (t: Date) => `${MON[t.getUTCMonth()]}${t.getUTCDate()}.${t.getUTCFullYear()}`;

import { execFile } from "node:child_process";
/** curl (some bank sites reset Node's fetch / HTTP2); -f → HTTP errors reject. */
function curlGet(url: string): Promise<string> {
  return new Promise((res, rej) => execFile("curl", ["-sSLf", "--http1.1", "-A", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", "--max-time", "20", url], { maxBuffer: 64e6 },
    (e, out, err) => (e ? rej(new Error((err || e.message).trim().split("\n").pop()!.replace(/^curl: /, ""))) : res(out))));
}
async function get(url: string): Promise<string> {
  try { return await curlGet(url); } catch (e1) {
    try { const r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (alpha research)" }, signal: AbortSignal.timeout(15_000) }); if (!r.ok) throw new Error(`HTTP ${r.status}`); return await r.text(); }
    catch (e2) { throw new Error(`curl ${(e1 as Error).message} / fetch ${(e2 as Error).message}`); }
  }
}
/** A page with no parseable dates at all is treated as unavailable (JS-rendered/empty), not as "no speeches". */
export function hasDates(html: string): boolean { return textLines(html).some((l) => datesIn(l).length > 0); }

export async function fetchRegional(from: string, to: string): Promise<{ speeches: FedSpeech[]; coverage: Coverage[] }> {
  const speeches: FedSpeech[] = [], cov = new Map<string, Coverage>(BANKS.map((b) => [b.bank, { bank: b.bank, president: b.president, voter2026: b.voter2026, official: "", secondary: "" }]));
  await Promise.all(BANKS.map(async (b) => {
    const errs: string[] = []; let found = 0, okPages = 0;
    for (const u of b.urls) { try { const h = await get(u); if (!hasDates(h)) throw new Error("页面无可解析日期（可能 JS 渲染）"); okPages++; const s = scanOfficial(h, b, from, to, u); found += s.length; speeches.push(...s); } catch (e) { errs.push(`${new URL(u).host}: ${(e as Error).message}`); } }
    cov.get(b.bank)!.official = okPages ? `ok（${okPages}/${b.urls.length} 页可读，窗口内找到 ${found}）${errs.length ? `；部分失败 ${errs.join("; ")}` : ""}` : `unavailable（${errs.join("; ")}）`;
  }));
  // secondary weeks covering [from, to]
  const weeks: string[] = []; for (let t = wkStart(from); t.toISOString().slice(0, 10) <= to; t = new Date(t.getTime() + 7 * 86400_000)) weeks.push(wkParam(t));
  const rows: ReturnType<typeof parseSecondaryWeek> = []; const secErr: string[] = [];
  for (const w of weeks) { try { rows.push(...parseSecondaryWeek(await get(`${SECONDARY}?week=${w}`))); } catch (e) { secErr.push(`${w}: ${(e as Error).message}`); } }
  const seen = new Set<string>(), topics = new Map<string, string>();
  for (const r of rows) {
    const k = `${r.dateEt}|${r.timeEt}|${r.last}`; if (seen.has(k) || r.dateEt < from || r.dateEt > to) continue; seen.add(k);
    const b = BANKS.find((x) => x.last === r.last), solo = `https://www.metalsmine.com${r.solo}`;
    if (!topics.has(solo)) { try { topics.set(solo, await get(solo)); } catch { topics.set(solo, ""); } }
    speeches.push({ date: r.dateEt, timeEt: r.timeEt, kind: /Testif/.test(r.title) ? "testimony" : "speech", speaker: b ? b.president : r.last, role: b ? `${b.bank} Fed President` : BOARD.includes(r.last) ? "Board" : "?",
      voter: b ? b.voter2026 : BOARD.includes(r.last) ? true : null, topic: secondaryTopic(topics.get(solo) ?? "", r.dateEt), location: "", source: solo, bank: b?.bank ?? (BOARD.includes(r.last) ? "Board" : undefined), sourceKind: "secondary" });
  }
  for (const c of cov.values()) {
    const n = speeches.filter((s) => s.bank === c.bank && s.sourceKind === "secondary").length;
    c.secondary = weeks.length && secErr.length === weeks.length ? `unavailable（${secErr.join("; ")}）` : `ok（找到 ${n}）${secErr.length ? `；部分周失败 ${secErr.join("; ")}` : ""}`;
  }
  return { speeches, coverage: [...cov.values()] };
}
