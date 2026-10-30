/**
 * Geopolitical / election events (knowledge/calendar/geo-events-2026.json). DISPLAY + 72h pre-event REMINDER ONLY:
 * lines for brief §1.1 and §6 日历. Never added to the release calendar or the major-events list, so NO_TRADE,
 * the 48h event window, the 72h post-event psych tag and the 能不能睡 section are not affected (US trades).
 */
import { readFileSync, existsSync } from "node:fs";

export const GEO_FILE = "knowledge/calendar/geo-events-2026.json";
export const GEO_REMIND_H = 72, GEO_AFTER_H = 24;
export interface GeoEvent { id: string; category: string; subtype: string; country: string; sector: string; title: string; dateET: string; at: string; timeET: string;
  localTime?: string; resultsAt?: string; assets: string[]; context?: string; sources: string[]; verifiedAt?: string }

export function parseGeo(json: unknown): GeoEvent[] {
  const e = (json as { events?: unknown })?.events;
  if (!Array.isArray(e)) throw new Error("geo-events: events[] missing");
  for (const [k, x] of e.entries()) { const g = x as GeoEvent;
    if (!g.id || !/^\d{4}-\d{2}-\d{2}$/.test(g.dateET ?? "") || !Number.isFinite(Date.parse(g.at)) || !Array.isArray(g.assets) || !g.sources?.length) throw new Error(`geo-events entry ${k} invalid`); }
  return (e as GeoEvent[]).slice().sort((a, b) => a.at.localeCompare(b.at));
}
export function loadGeoEvents(path = GEO_FILE): { events: GeoEvent[]; error?: string } {
  if (!existsSync(path)) return { events: [], error: `${path} missing` };
  try { return { events: parseGeo(JSON.parse(readFileSync(path, "utf8"))) }; } catch (e) { return { events: [], error: (e as Error).message }; }
}
const wd = (d: string) => "日一二三四五六"[new Date(d + "T12:00:00Z").getUTCDay()]!;
const end = (g: GeoEvent) => Date.parse(g.resultsAt ?? g.at);
/** 72h before polls open → reminder; stays until 24h after results (Monday gap risk) */
export function geoReminderLines(events: GeoEvent[], now: Date): string[] {
  const t = now.getTime();
  return events.filter((g) => t >= Date.parse(g.at) - GEO_REMIND_H * 3600_000 && t <= end(g) + GEO_AFTER_H * 3600_000).flatMap((g) => {
    const h = (Date.parse(g.at) - t) / 3600_000;
    const when = h > 0 ? `还有 ${Math.round(h)} 小时` : t < end(g) ? "投票进行中" : `结果已出 ${Math.round((t - end(g)) / 3600_000)} 小时`;
    return [`- 🌎 **地缘/选举事件 72 小时提醒**：${g.dateET}（周${wd(g.dateET)}）${g.timeET} ET · ${g.title} — ${when}（${g.sector} 板块：${g.assets.join(" / ")}）`,
      `  - ${g.localTime ?? ""}${g.context ? `；${g.context}` : ""}`,
      "  - 只提醒、只显示：持有或打算做这些标的时提前想好跳空风险；不改 NO_TRADE、48h/72h 规则和「能不能睡」（美股交易）。"];
  });
}
/** §6 日历 rows: today and the next 14 days */
export function geoCalendarLines(events: GeoEvent[], now: Date): string[] {
  const day = now.toLocaleDateString("en-CA", { timeZone: "America/New_York" }), to = new Date(now.getTime() + 14 * 864e5).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  return events.filter((g) => g.dateET >= day && g.dateET <= to).map((g) =>
    `- ${g.dateET === day ? "**今天** " : ""}${g.dateET}（周${wd(g.dateET)}）${g.timeET} ET · 🌎 ${g.title}（${g.category}/${g.subtype} · ${g.sector}：${g.assets.join(" / ")}）（地缘：只显示 + 72h 提醒，不触发 48h/72h 事件规则）`);
}
