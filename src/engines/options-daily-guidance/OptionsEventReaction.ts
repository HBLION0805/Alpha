import type { EventReactionInput, ReactionEvent } from "../../contracts/OptionsEventReaction";
import { readinessClock } from "../options-readiness/OptionsReadinessEngine";

const SECOND = 1000000000n, MINUTE = 60n * SECOND, DAY = 1440n * MINUTE, MICRO = 1000000n;
const fail = (code: string): never => { throw Error("EVENT_REACTION_" + code); };
// Preserve fractional source clocks at event boundaries instead of truncating to milliseconds.
function clock(v: string | null): bigint | null {
  if (typeof v !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,9})?Z$/.test(v)) return null;
  const ms = Date.parse(v);
  if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 19) !== v.slice(0, 19)) return null;
  return BigInt(Date.parse(v.slice(0, 19) + "Z")) * 1000000n + BigInt((v.split(".")[1]?.slice(0, -1) ?? "").padEnd(9, "0"));
}
function amount(v: string | null): bigint | null {
  if (typeof v !== "string" || !/^\d{1,8}(?:\.\d{1,6})?$/.test(v)) return null;
  const [w, f = ""] = v.split("."), n = BigInt(w!) * MICRO + BigInt(f.padEnd(6, "0"));
  return n > 0n ? n : null;
}
function decimal(n: bigint, scale: bigint, digits: number): string {
  const magnitude = n < 0n ? -n : n;
  return (n < 0n ? "-" : "") + magnitude / scale + "." + (magnitude % scale).toString().padStart(digits, "0");
}
function change(before: string, after: string) {
  const base = amount(before)!, delta = amount(after)! - base, abs = delta < 0n ? -delta : delta;
  const hundredths = (abs * 10000n + base / 2n) / base;
  return { priceChangeUsd: decimal(delta, MICRO, 6), percentChange: decimal(delta < 0n ? -hundredths : hundredths, 100n, 2),
    direction: delta > 0n ? "UP" : delta < 0n ? "DOWN" : "UNCHANGED" };
}
const seconds = (n: bigint) => Number(n) / 1e9;
interface Point {
  symbol: string; priceUsd: string; sourceAt: string; receivedAt: string; capturedAt: string; recordedAt: string; path: string;
}
const stamp = (p: Point) => clock(p.sourceAt)!;
const compareClock = (a: string, b: string) => clock(a)! < clock(b)! ? -1 : clock(a)! > clock(b)! ? 1 : 0;
const sortPoints = (a: Point, b: Point) => compareClock(a.sourceAt, b.sourceAt) || compareClock(a.recordedAt, b.recordedAt) || a.path.localeCompare(b.path);
const date = (v: string) => /^\d{4}-\d\d-\d\d$/.test(v) && clock(v + "T00:00:00Z") !== null;
function eventClock(e: ReactionEvent) {
  if (!e.key || !e.title || !["BLS", "FOMC"].includes(e.source) ||
    !date(e.startDate) || !date(e.endDate) || e.endDate < e.startDate || clock(e.calendarReceivedAt) === null) fail("EVENT");
  const t = clock(e.scheduledAt);
  if (e.scheduledAt !== null && t === null) fail("EVENT_CLOCK");
  return t;
}

/** Retrospective observations only: no input to the original guidance or fill engines. */
export function assessEventReactions(input: EventReactionInput) {
  readinessClock(input.at); const at = clock(input.at)!;
  if (!Array.isArray(input.events) || input.events.length > 100 || !Array.isArray(input.frames) || input.frames.length > 1000 ||
    !Array.isArray(input.notes) || input.notes.length > 240 || !["HOST_MARKET_TOOL_RESPONSES", "SYNTHETIC_FIXTURE"].includes(input.origin)) fail("INPUT");
  if (new Set(input.events.map(e => e.key)).size !== input.events.length) fail("DUPLICATE_EVENT");
  input.events.forEach(eventClock);
  const exclusions: Record<string, number> = {}, points: Point[] = [];
  const exclude = (reason: string) => { exclusions[reason] = (exclusions[reason] ?? 0) + 1; };
  for (const frame of input.frames) {
    const receipt = clock(frame.equityReceivedAt), capture = clock(frame.capturedAt), stored = clock(frame.recordedAt);
    if (frame.origin !== input.origin) { exclude("WRONG_ORIGIN"); continue; }
    if (receipt === null || capture === null || stored === null || receipt > capture || capture > stored) { exclude("FRAME_CLOCK_INVALID"); continue; }
    if (stored > at) { exclude("NOT_YET_SAVED_AT_ASSESSMENT"); continue; }
    if (new Set(frame.equities.map(e => e.symbol)).size !== frame.equities.length) { exclude("DUPLICATE_ASSET_IN_FRAME"); continue; }
    for (const equity of frame.equities) {
      if (!["GLD", "IBIT"].includes(equity.symbol) || amount(equity.price) === null) { exclude("PRICE_MISSING_OR_INVALID"); continue; }
      const source = clock(equity.sourceAt);
      if (source === null || source > receipt) { exclude("SOURCE_CLOCK_MISSING_OR_FUTURE"); continue; }
      if (receipt - source > 120n * SECOND) { exclude("STALE_AT_EQUITY_RECEIPT"); continue; }
      points.push({symbol: equity.symbol, priceUsd: equity.price!, sourceAt: equity.sourceAt!, receivedAt: frame.equityReceivedAt!,
        capturedAt: frame.capturedAt, recordedAt: frame.recordedAt, path: frame.path});
    }
  }
  const groups = new Map<string, Point[]>();
  for (const p of points) { const k = p.symbol + ":" + stamp(p), group = groups.get(k) ?? []; group.push(p); groups.set(k, group); }
  const unique: Point[] = [], conflicts: Point[] = []; let duplicateObservations = 0;
  for (const group of groups.values()) {
    if (new Set(group.map(p => amount(p.priceUsd)!.toString())).size > 1) conflicts.push(group[0]!);
    else { unique.push([...group].sort(sortPoints)[0]!); duplicateObservations += group.length - 1; }
  }
  unique.sort(sortPoints);
  const events = input.events.map(event => {
    const t = eventClock(event);
    if (clock(event.calendarReceivedAt)! > at) fail("FUTURE_CALENDAR");
    const timingState = event.status === "CANCELLED" ? "CANCELLED" : event.status === "TENTATIVE" ? "TENTATIVE" : t === null ? "DATE_ONLY" : "SCHEDULED_TIME_ONLY";
    const timed = timingState === "SCHEDULED_TIME_ONLY" && t !== null;
    const confounders = timed ? input.events.filter(e => e.key !== event.key && e.status !== "CANCELLED" && (e.scheduledAt === null
      ? e.startDate <= event.endDate && e.endDate >= event.startDate
      : clock(e.scheduledAt)! >= t! - DAY && clock(e.scheduledAt)! <= t! + 120n * MINUTE)).map(e => ({key: e.key, title: e.title, scheduledAt: e.scheduledAt})) : [];
    return { ...event, timingState, releaseOccurred: null, cause: "NOT_ESTABLISHED", confounders,
      calendarTiming: t === null ? "DATE_ONLY" : clock(event.calendarReceivedAt)! < t ? "SAVED_SCHEDULE_BEFORE_EVENT" : "RETROSPECTIVE_CALENDAR_CONTEXT",
      assets: (["GLD", "IBIT"] as const).map(symbol => {
        const samples = unique.filter(p => p.symbol === symbol);
        const preConflict = timed && conflicts.some(p => p.symbol === symbol && stamp(p) >= t! - DAY && stamp(p) < t!);
        const baseline = timed && !preConflict ? samples.filter(p => stamp(p) >= t! - DAY && stamp(p) < t! && clock(p.recordedAt)! < t!).at(-1) ?? null : null;
        const notes = timed ? input.notes.filter(n => {
          const assessed = clock(n.assessedAt), saved = clock(n.recordedAt), asset = n.assets.find(a => a.symbol === symbol);
          return assessed !== null && saved !== null && assessed <= saved && saved <= at && saved < t! && assessed >= t! - DAY && assessed < t! &&
            asset && asset.sources.length > 0 && asset.sources.every(s => { const r = clock(s.retrievedAt); return r !== null && r <= assessed; });
        }).sort((a, b) => compareClock(b.assessedAt, a.assessedAt) || compareClock(a.recordedAt, b.recordedAt) || a.path.localeCompare(b.path)) : [];
        const note = notes[0], assetNote = note?.assets.find(a => a.symbol === symbol);
        const priorView = note && assetNote ? {path: note.path, assessedAt: note.assessedAt, recordedAt: note.recordedAt, bias: assetNote.bias,
          summary: assetNote.summary, interpretation: "GENERAL_PRE_EVENT_CONTEXT_NOT_AN_EVENT_SPECIFIC_HYPOTHESIS"} : null;
        return { symbol, baseline, baselineGapSeconds: baseline ? seconds(t! - stamp(baseline)) : null,
          baselineCoverage: baseline ? t! - stamp(baseline) > 30n * MINUTE ? "WIDE_OR_OVERNIGHT_BASELINE" : "WITHIN_30_MINUTES" : "MISSING",
          priorView, hypothesisStatus: "NOT_TESTED",
          windows: [30, 120].map(minutes => {
            const end = timed ? t! + BigInt(minutes) * MINUTE : null;
            const conflict = preConflict || timed && conflicts.some(p => p.symbol === symbol && stamp(p) > t! && stamp(p) <= end!);
            const eligible = timed && !conflict ? samples.filter(p => stamp(p) > t! && stamp(p) <= end!) : [];
            const post = eligible.at(-1) ?? null;
            const missing = !timed ? timingState : conflict ? "CONFLICTING_SOURCE_PRICES" : at <= t! ? "EVENT_NOT_YET_PASSED" : !baseline ? "PRE_EVENT_OBSERVATION_MISSING" : !post ? "POST_EVENT_OBSERVATION_MISSING" : null;
            const delta = baseline && post && !missing ? change(baseline.priceUsd, post.priceUsd) : null;
            return { minutes, state: !timed ? "TIMING_UNAVAILABLE" : at <= t! ? "WAITING_FOR_EVENT" : at < end! ? "WINDOW_OPEN" : "WINDOW_ENDED",
              missingReason: missing, post, eligiblePostObservations: eligible.length,
              postOffsetSeconds: post ? seconds(stamp(post) - t!) : null,
              postSavedAfterWindow: post && end !== null ? clock(post.recordedAt)! > end : null,
              sampleGapSeconds: baseline && post ? seconds(stamp(post) - stamp(baseline)) : null,
              ...delta, comparisonAvailable: delta !== null,
              priceChangeUsd: delta?.priceChangeUsd ?? null, percentChange: delta?.percentChange ?? null, direction: delta?.direction ?? "UNKNOWN",
              priorBiasComparison: !delta || !assetNote || !["BULLISH", "BEARISH"].includes(assetNote.bias) ? "UNASSESSED" : delta.direction === "UNCHANGED" ? "UNCHANGED" :
                (assetNote.bias === "BULLISH") === (delta.direction === "UP") ? "SAME_DIRECTION_ONLY" : "OPPOSITE_DIRECTION_ONLY" };
          }) };
      }) };
  });
  return {version: "OPTIONS_EVENT_REACTION_V1", assessedAt: input.at, origin: input.origin, events, exclusions,
    observations: {eligibleUnique: unique.length, duplicates: duplicateObservations, conflictingInstants: conflicts.length},
    preWindowHours: 24, postWindowMinutes: [30, 120], freshnessAtReceiptSeconds: 120,
    interpretation: "Saved last-trade observations around scheduled times. Actual release, surprise, causation, intrawindow path and option profit are unestablished. Sparse or overnight samples include other market influences. Current calendar evidence is not a reconstruction of historical knowledge.",
    actualReleaseValues: null, consensus: null, technicalConfirmation: "MISSING_QUALIFIED_OHLCV", winProbability: null,
    sourceRefresh: false, executionAllowed: false, guidanceChanged: false, paperGatesAdvanced: false};
}
