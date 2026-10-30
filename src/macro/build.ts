import type { DatabaseSync } from "node:sqlite";
import { SERIES, INTRADAY } from "./series.ts";
import { fetchDailyOnce, fetchIntraday, type Obs } from "./fetch.ts";
import { initMacro, saveObs, loadObs, recordFetch, fetchReport } from "./store.ts";
import { computeStats, type SeriesStats } from "./stats.ts";
import { classifyAxes, classifyRegime, type Regime } from "./regime.ts";
import { confirmReaction, type Confirmation } from "./confirm.ts";
import { riskView, type RiskView } from "./risk.ts";
import type { ScoredCluster } from "../score.ts";
import type { CalendarEvent } from "../ingest/officialCalendar.ts";

export interface MacroReport {
  generatedAt: string;
  regime: Regime;
  stats: Record<string, SeriesStats>;
  confirmations: Array<{ headline: string; firstSeen: string; sources: number; c: Confirmation }>;
  risk: RiskView;
  sources: Array<{ series: string; ok: number; error: string | null; last_t: string | null; n: number }>;
  overrides: Record<string, number>;
}

export async function refreshMacro(db: DatabaseSync, opts: { offline?: boolean; log?: (s: string) => void } = {}): Promise<void> {
  initMacro(db);
  if (opts.offline) return;
  await Promise.all(
    SERIES.map(async (s) => {
      try {
        const obs = await fetchDailyOnce(s);
        if (!obs.length) throw new Error("no observations");
        saveObs(db, s.id, obs);
        let n = obs.length;
        if ((INTRADAY as readonly string[]).includes(s.id)) {
          const intr = await fetchIntraday(s);
          saveObs(db, s.id, intr, true);
          n += intr.length;
        }
        recordFetch(db, s.id, true, null, obs[obs.length - 1]!.t, n);
      } catch (e) {
        recordFetch(db, s.id, false, (e as Error).message, null, 0);
        opts.log?.(`[macro] ${s.id} (${s.provider}:${s.ref}) failed: ${(e as Error).message}`);
      }
    }),
  );
}

/** Macro-relevant clusters to test against market reaction. */
export const CONFIRM_TOPICS = new Set(["fed", "inflation", "jobs", "growth"]);

export function buildMacroReport(db: DatabaseSync, ranked: ScoredCluster[], calendar: CalendarEvent[], now = new Date(), overrides: Record<string, number> = {}): MacroReport {
  initMacro(db);
  const stats: Record<string, SeriesStats> = {};
  for (const s of SERIES) {
    let obs = loadObs(db, s.id);
    const o = overrides[s.id];
    if (o !== undefined) {
      // replace (not append) the latest session's value so 1d/5d/20d windows stay aligned
      const last = obs[obs.length - 1];
      const todayEt = now.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
      obs = last && last.t >= todayEt ? [...obs.slice(0, -1), { t: last.t, v: o }] : [...obs, { t: todayEt, v: o }];
    }
    const weekly = s.frequency === "weekly";
    stats[s.id] = computeStats(s.id, obs, s.unit === "pct" || s.id === "NFCI", weekly ? { s1: 1, s5: 1, s20: 4 } : undefined, weekly ? 52 : 252);
  }
  const regime = classifyRegime(classifyAxes(stats), now.toISOString());
  const intraday: Record<string, Obs[]> = {};
  for (const id of INTRADAY) intraday[id] = loadObs(db, id, true);
  const confirmations = ranked
    .filter((r) => r.topics.some((t) => CONFIRM_TOPICS.has(t.id)) && r.sources.length >= 2)
    .slice(0, 5)
    .map((r) => ({ headline: r.headline, firstSeen: r.cluster.firstSeen, sources: r.sources.length, c: confirmReaction(r.cluster.items.map((i) => i.title), r.cluster.firstSeen, intraday, 6, now) }));
  const risk = riskView(regime, confirmations, calendar, now);
  return { generatedAt: now.toISOString(), regime, stats, confirmations, risk, sources: fetchReport(db), overrides };
}
