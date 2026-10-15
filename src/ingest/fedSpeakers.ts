/**
 * Fed speakers from the Board's official calendar JSON (https://www.federalreserve.gov/json/calendar.json — the data
 * behind federalreserve.gov/newsevents/calendar.htm). Covers Board members (Chair, Vice Chairs, Governors) only;
 * regional Reserve Bank presidents are NOT on this calendar → reported as unavailable, never guessed.
 * FOMC blackout: from the second Saturday before the meeting's first day through midnight ET the day after it ends.
 */
export const FED_CAL_JSON = "https://www.federalreserve.gov/json/calendar.json";
export const FED_CAL_PAGE = "https://www.federalreserve.gov/newsevents/calendar.htm";

export interface FedSpeech { date: string; timeEt: string | null; kind: "speech" | "discussion" | "testimony" | "other"; speaker: string; role: string; voter: boolean | null; topic: string; location: string; source: string }
export interface Blackout { meetingStart: string; meetingEnd: string; from: string; to: string }

/** 2026 FOMC voters: all Board members + NY + Cleveland, Philadelphia, Dallas, Minneapolis (rotation). */
const VOTER_PRESIDENTS_2026 = ["Williams", "Hammack", "Paulson", "Logan", "Kashkari"];
export function isVoter(title: string, year: number): boolean | null {
  if (/Chair|Governor/i.test(title)) return true; // Board members always vote
  if (year !== 2026) return null;
  return VOTER_PRESIDENTS_2026.some((n) => title.includes(n)) ? true : null;
}

const decode = (s: string) => s.replace(/&#8217;/g, "’").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#10;/g, " ").replace(/<[^>]+>/g, "").trim();
export function to24(t: string): string | null {
  const m = /^(\d{1,2}):(\d{2})\s*([ap])\.?m\.?$/i.exec(t.trim()); if (!m) return null;
  let h = Number(m[1]) % 12; if (m[3]!.toLowerCase() === "p") h += 12;
  return `${String(h).padStart(2, "0")}:${m[2]}`;
}

export function parseFedCalendar(json: unknown): { speeches: FedSpeech[]; fomcMeetings: Array<{ start: string; end: string }> } {
  const ev = ((json as { events?: unknown[] })?.events ?? []) as Array<Record<string, string>>;
  const speeches: FedSpeech[] = [], fomc: Array<{ start: string; end: string }> = [];
  for (const e of ev) {
    const month = e.month ?? "", days = String(e.days ?? "").split(",").map((d) => d.trim()).filter(Boolean);
    if (!/^\d{4}-\d{2}$/.test(month)) continue;
    if (e.type === "FOMC" && /FOMC Meeting/i.test(e.title ?? "")) {
      const end = `${month}-${days[0]!.padStart(2, "0")}`, m = /(\w+)\s+(\d{1,2})\s*-\s*(?:(\w+)\s+)?(\d{1,2})/.exec(decode(e.description ?? ""));
      const start = m ? new Date(Date.parse(end + "T12:00:00Z") - (Number(m[4]) - Number(m[2]) >= 0 ? Number(m[4]) - Number(m[2]) : 1) * 86400_000).toISOString().slice(0, 10) : new Date(Date.parse(end + "T12:00:00Z") - 86400_000).toISOString().slice(0, 10);
      fomc.push({ start, end }); continue;
    }
    if (e.type !== "Speeches" && e.type !== "Testimony") continue;
    const title = decode(e.title ?? ""), [lead, ...rest] = title.split(" - "), who = rest.join(" - ").trim();
    const role = (/(Chairman|Chair|Vice Chair for Supervision|Vice Chair|Governor)/.exec(who)?.[1]) ?? "";
    for (const d of days) {
      const date = `${month}-${d.padStart(2, "0")}`;
      speeches.push({ date, timeEt: e.time ? to24(e.time) : null, kind: e.type === "Testimony" ? "testimony" : /discussion/i.test(lead ?? "") ? "discussion" : /speech/i.test(lead ?? "") ? "speech" : "other",
        speaker: who.replace(role, "").trim() || who, role, voter: isVoter(who, Number(month.slice(0, 4))), topic: decode(e.description ?? ""), location: decode(e.location ?? ""), source: FED_CAL_PAGE });
    }
  }
  const k = new Set<string>();
  return { speeches: speeches.filter((s) => { const key = `${s.date}|${s.timeEt}|${s.speaker}`; return k.has(key) ? false : (k.add(key), true); }).sort((a, b) => (a.date + (a.timeEt ?? "")).localeCompare(b.date + (b.timeEt ?? ""))), fomcMeetings: fomc.sort((a, b) => a.start.localeCompare(b.start)) };
}

const addDays = (d: string, n: number) => new Date(Date.parse(d + "T12:00:00Z") + n * 86400_000).toISOString().slice(0, 10);
/** Blackout window for one meeting (Fed rule: second Saturday before first day → midnight after last day). */
export function blackout(meetingStart: string, meetingEnd: string): Blackout {
  const dow = new Date(meetingStart + "T12:00:00Z").getUTCDay(); // 0 Sun..6 Sat
  const back = ((dow - 6 + 7) % 7 || 7) + 7; // second Saturday strictly before
  return { meetingStart, meetingEnd, from: addDays(meetingStart, -back), to: addDays(meetingEnd, 1) };
}
export function inBlackout(date: string, b: Blackout[]): Blackout | null { return b.find((x) => date >= x.from && date < x.to) ?? null; }

export function renderFedSpeakers(speeches: FedSpeech[], blackouts: Blackout[], from: string, days: number, status: string): string[] {
  const to = addDays(from, days), L: string[] = [];
  const list = speeches.filter((s) => s.date >= from && s.date <= to);
  L.push(...(list.length ? list.map((s) => `- ${s.date} ${s.timeEt ?? "时间未定"} ET · ${s.role} ${s.speaker}（${s.voter ? "票委" : s.voter === false ? "非票委" : "票委状态未知"}）· ${s.kind === "testimony" ? "国会作证" : s.kind === "discussion" ? "对谈" : "讲话"}：${s.topic || "主题未公布"}`) : [`- ${from}～${to} 官方日历上没有理事会成员讲话`]));
  for (const b of blackouts.filter((x) => x.to >= from && x.from <= to)) L.push(`- 🔇 FOMC 静默期 ${b.from} ～ ${addDays(b.to, -1)}（会议 ${b.meetingStart}～${b.meetingEnd}）：官员不谈货币政策`);
  L.push(`- ⚠️ 地区联储主席的讲话不在理事会日历上 → 未覆盖（不可用，未猜测）· 来源 ${FED_CAL_PAGE} · ${status}`);
  return L;
}

export interface FedCache { fetchedAt: string; speeches: FedSpeech[]; blackouts: Blackout[] }
/** Live fetch (refreshes data/in/fed-speakers.json); falls back to the cache; null when neither exists. */
export async function loadFedSpeakers(opts: { offline?: boolean; cache?: string; now?: Date } = {}): Promise<{ data: FedCache | null; status: string }> {
  const { existsSync, readFileSync, writeFileSync, mkdirSync } = await import("node:fs");
  const cache = opts.cache ?? "data/in/fed-speakers.json";
  if (!opts.offline) {
    try {
      const r = await fetch(FED_CAL_JSON, { headers: { "user-agent": "Mozilla/5.0 (alpha research)" }, signal: AbortSignal.timeout(10_000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const p = parseFedCalendar(JSON.parse((await r.text()).replace(/^\uFEFF/, "")));
      const data: FedCache = { fetchedAt: (opts.now ?? new Date()).toISOString(), speeches: p.speeches, blackouts: p.fomcMeetings.map((m) => blackout(m.start, m.end)) };
      mkdirSync(cache.replace(/\/[^/]+$/, ""), { recursive: true }); writeFileSync(cache, JSON.stringify(data, null, 1));
      return { data, status: `实时获取 ${data.fetchedAt}` };
    } catch (e) { if (!existsSync(cache)) return { data: null, status: `获取失败：${(e as Error).message}；无缓存 → 不可用` }; }
  }
  if (!existsSync(cache)) return { data: null, status: "无缓存 → 不可用" };
  const data = JSON.parse(readFileSync(cache, "utf8")) as FedCache;
  return { data, status: `缓存 ${data.fetchedAt}` };
}
