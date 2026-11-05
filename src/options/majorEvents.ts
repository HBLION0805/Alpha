/**
 * Flagged market-wide / ticker events for the 72-hour rule (src/options/psych.ts warn_72h_event).
 * data/in/major-events.json (local, gitignored; hand-edited additions) wins; otherwise the tracked official calendar
 * knowledge/calendar/major-events-2026-2027.json (FOMC decision days 14:00 ET, CPI and Employment Situation 08:30 ET; sources per entry).
 */
import { existsSync, readFileSync } from "node:fs";
import type { MajorEvent } from "./psych.ts";
export const TRACKED_EVENTS = new URL("../../knowledge/calendar/major-events-2026-2027.json", import.meta.url);
export function loadMajorEvents(local = "data/in/major-events.json"): { events: MajorEvent[]; from: string } {
  const read = (p: string | URL) => (JSON.parse(readFileSync(p, "utf8")).events ?? []) as MajorEvent[];
  if (existsSync(local)) return { events: read(local), from: local };
  if (existsSync(TRACKED_EVENTS)) return { events: read(TRACKED_EVENTS), from: "knowledge/calendar/major-events-2026-2027.json" };
  return { events: [], from: "none" };
}
