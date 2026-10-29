/**
 * Dated archive copy of the premarket / close brief (brief-latest.md is overwritten every 30-min run, so the 07:30 and
 * 16:30 versions were lost — qa/checklist.md C1). Path: <outDir>/briefs/YYYY-MM-DD_HHMM_{premarket|close}.md, ET clock.
 * Windows (ET, NYSE trading days and weekends alike — futures/briefs still run): premarket 07:00–09:29, close 16:00–18:59.
 */
import { join } from "node:path";

export type BriefSession = "premarket" | "close";
export function briefSession(now: Date): BriefSession | null {
  const hm = Number(now.toLocaleTimeString("en-GB", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", hour12: false }).replace(":", ""));
  return hm >= 700 && hm < 930 ? "premarket" : hm >= 1600 && hm < 1900 ? "close" : null;
}
/** null outside the premarket / close windows (no archive) */
export function briefArchivePath(now: Date, outDir: string, session: BriefSession | null = briefSession(now)): string | null {
  if (!session) return null;
  const d = now.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const hm = now.toLocaleTimeString("en-GB", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", hour12: false }).replace(":", "");
  return join(outDir, "briefs", `${d}_${hm}_${session}.md`);
}
