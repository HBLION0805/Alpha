import { readinessClock, readinessFingerprint } from "./OptionsReadinessEngine";
import type { ContextHistory } from "./OptionsContextCutoff";
import { reportReleaseCalendar, RELEASE_CALENDAR_URL, type ReleaseCalendarInput } from "../options-release-calendar/BlsReleaseCalendarEngine";
import { reportFomcCalendar, FOMC_CALENDAR_URL, type FomcCalendarInput } from "../options-fomc-calendar/FomcCalendarEngine";
import { exchangeLocalDate } from "../market-calendar/MarketCalendarValidation";

export interface CalendarBriefInputs { bls: ContextHistory<readonly ReleaseCalendarInput[]>; fomc: ContextHistory<readonly FomcCalendarInput[]> }
interface Entry {
  source: "BLS" | "FOMC"; sourceKey: string; title: string; precision: "SCHEDULED_INSTANT" | "DATE_ONLY";
  startDate: string; endDate: string; scheduledAt: string | null; localScheduledTime: string | null;
  sourceStatus: string; temporalRelation: string; projectionMarker: boolean | null; independentlyConfirmed: false;
}
function fail(code: string): never { throw Error("CALENDAR_BRIEF_" + code); }
function exact(v: unknown, keys: string[]) { if (!v || typeof v !== "object" || Array.isArray(v) || Object.keys(v).sort().join() !== [...keys].sort().join()) fail("SHAPE"); }
function freeze<T>(v: T): T { if (v && typeof v === "object") { Object.values(v).forEach(freeze); Object.freeze(v); } return v; }
const escape = (v: string) => v.replace(/[\u0000-\u001f\u007f-\u009f\u200e\u200f\u2028-\u202e\u2066-\u2069]/g, c => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
function localTime(at: string): string {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23", timeZoneName: "short" }).formatToParts(new Date(at)).map(p => [p.type, p.value]));
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second} ${p.timeZoneName} (America/New_York)`;
}
interface SourceReport { retrievalCount: number; latestRetrieval: { status: string; receivedAt: string; errorCode: string | null } | null; lastKnownSchedule: { receivedAt: string } | null; refreshOverdue: boolean }
function source<T, R extends SourceReport>(input: ContextHistory<T>, build: (v: T, at: string) => R, url: string) {
  let report: R | null = null, state: string = input.state, errorCode: string | null = input.errorCode;
  if (input.state === "AVAILABLE") { try { report = build(input.payload, input.checkedAt); } catch { state = "BLOCKED"; errorCode = "HISTORY_VALIDATION_FAILED"; } }
  return { report, summary: { state, checkedAt: input.checkedAt, sourceUrl: url, errorCode, reportSha256: report ? readinessFingerprint(report) : null,
    retrievalCount: report?.retrievalCount ?? null, latestAttempt: report?.latestRetrieval?.status ?? "NOT_KNOWN", sourceErrorCode: report?.latestRetrieval?.errorCode ?? null, latestReceivedAt: report?.latestRetrieval?.receivedAt ?? null,
    lastKnownReceivedAt: report?.lastKnownSchedule?.receivedAt ?? null, refreshOverdue: report?.refreshOverdue ?? null } };
}
/** Calendar context only: date-only listings are never converted into invented timestamps. */
export function buildOptionsCalendarBrief(inputs: CalendarBriefInputs, assessedAt: string) {
  readinessClock(assessedAt); exact(inputs, ["bls", "fomc"]); let previous: string | null = null;
  for (const input of [inputs.bls, inputs.fomc]) {
    exact(input, ["state", "checkedAt", "payload", "errorCode"]); readinessClock(input.checkedAt);
    if (input.checkedAt > assessedAt || previous !== null && input.checkedAt < previous) fail("CHECK_CLOCK_ORDER"); previous = input.checkedAt;
    if (input.state === "AVAILABLE") { if (!Array.isArray(input.payload) || input.errorCode !== null) fail("STORAGE_STATE"); }
    else if (!["MISSING", "BLOCKED"].includes(input.state) || input.payload !== null || (input.state === "MISSING" ? input.errorCode !== "STORE_MISSING" : !["STORE_BUSY", "STORE_UNSAFE", "RECOVERY_FAILED"].includes(input.errorCode))) fail("STORAGE_STATE");
  }
  const bls = source(inputs.bls, reportReleaseCalendar, RELEASE_CALENDAR_URL), fomc = source(inputs.fomc, reportFomcCalendar, FOMC_CALENDAR_URL);
  const today = exchangeLocalDate(assessedAt, "America/New_York"), endExclusive = new Date(Date.parse(today) + 30 * 86400000).toISOString().slice(0, 10);
  const lastDate = new Date(Date.parse(endExclusive) - 86400000).toISOString().slice(0, 10), entries: Entry[] = [];
  const b = bls.report?.latestRetrieval;
  if (b && b.status !== "FAILED") for (const e of b.events) {
    const date = exchangeLocalDate(e.scheduledAt, "America/New_York"); if (date < today || date >= endExclusive) continue;
    entries.push({ source: "BLS", sourceKey: e.uid, title: e.title, precision: "SCHEDULED_INSTANT", startDate: date, endDate: date,
      scheduledAt: e.scheduledAt, localScheduledTime: localTime(e.scheduledAt), sourceStatus: e.status,
      temporalRelation: e.scheduledAt < assessedAt ? "SCHEDULED_TIME_PASSED" : "SCHEDULED_TIME_NOT_YET_PASSED", projectionMarker: null, independentlyConfirmed: false });
  }
  for (const e of fomc.report?.latestRetrieval?.calendar?.meetings ?? []) {
    if (e.endDate < today || e.startDate >= endExclusive) continue;
    entries.push({ source: "FOMC", sourceKey: e.dateKey, title: e.kind === "NOTATION_VOTE" ? "FOMC notation vote date" : e.kind === "UNSCHEDULED" ? "FOMC unscheduled meeting date" : "FOMC meeting dates",
      precision: "DATE_ONLY", startDate: e.startDate, endDate: e.endDate, scheduledAt: null, localScheduledTime: null, sourceStatus: e.confirmationStatus,
      temporalRelation: e.startDate <= today ? "LISTED_DATES_OVERLAP_TODAY" : "LISTED_FUTURE_DATES", projectionMarker: e.projectionMarker, independentlyConfirmed: false });
  }
  if (entries.length > 1032) fail("ENTRY_LIMIT");
  const bucket = (e: Entry) => e.startDate < today ? today : e.startDate;
  const groups = [...new Set(entries.map(bucket))].sort().map(date => ({ date,
    dateOnlyEntries: entries.filter(e => bucket(e) === date && e.precision === "DATE_ONLY").sort((a, b) => a.sourceKey.localeCompare(b.sourceKey)),
    scheduledTimeEntries: entries.filter(e => bucket(e) === date && e.precision === "SCHEDULED_INSTANT").sort((a, b) => a.scheduledAt!.localeCompare(b.scheduledAt!) || a.sourceKey.localeCompare(b.sourceKey)) }));
  const sources = {
    bls: { ...bls.summary, missingSourceStampCount: b && b.status !== "FAILED" ? b.missingSourceStampCount : null, missingSourceModifiedCount: b && b.status !== "FAILED" ? b.missingSourceModifiedCount : null, originalPublicationTimeKnown: false },
    fomc: { ...fomc.summary, pageUpdatedDate: fomc.report?.latestRetrieval?.calendar?.pageUpdatedDate ?? null, originalPublicationTimesKnown: false, intradayTimesKnown: false }
  }, lines = ["Alpha GLD/IBIT public calendar context", "NO_REPLAY; no trading risk window or direction assigned.", `Assessed: ${assessedAt}`, `New York dates: ${today} through ${lastDate}`, ""];
  for (const [id, s] of Object.entries(sources)) lines.push(`${id.toUpperCase()}: ${s.state}${s.errorCode ? " / " + s.errorCode : ""}; checked ${s.checkedAt}`, `  Latest attempt: ${s.latestAttempt}${s.sourceErrorCode ? " / " + s.sourceErrorCode : ""}; received ${s.latestReceivedAt ?? "unknown"}; last known ${s.lastKnownReceivedAt ?? "unknown"}; refresh overdue ${s.refreshOverdue ?? "unknown"}.`, `  Source: ${s.sourceUrl}`);
  lines.push(`BLS latest schedule missing source stamp / modified counts: ${sources.bls.missingSourceStampCount ?? "unknown"} / ${sources.bls.missingSourceModifiedCount ?? "unknown"}.`, `FOMC latest page update date: ${sources.fomc.pageUpdatedDate ?? "unknown"}; this is not the original publication time of each meeting.`, "Original publication history is unknown for both sources.");
  lines.push("", `Selected calendar entries: ${entries.length}; shown in text: ${Math.min(entries.length, 40)}.`, "Date-only listings have unknown intraday timing and confirmation.", "A scheduled time passing does not prove the release occurred or that its values were collected.", "Missing entries or sources do not mean an event-free or safe trading session.");
  let shown = 0;
  for (const group of groups) {
    if (shown >= 40) break; lines.push("", group.date + " (first date overlapping this horizon)");
    for (const [label, rows] of [["Date-only listings; no order relative to timed releases is inferred", group.dateOnlyEntries], ["Scheduled release times", group.scheduledTimeEntries]] as const) {
      if (!rows.length || shown >= 40) continue; lines.push(label + ":");
      for (const row of rows) {
        if (shown >= 40) break; shown++;
        lines.push(`  ${row.precision === "DATE_ONLY" ? row.startDate + " through " + row.endDate : row.localScheduledTime} | ${escape(row.title)} | ${row.sourceStatus} | ${row.temporalRelation}${row.projectionMarker === null ? "" : " | projection marker " + row.projectionMarker}`);
      }
    }
  }
  const payload = { version: "OPTIONS_PUBLIC_CALENDAR_BRIEF_V1", assessedAt, sources, todayNewYork: today, horizonEndDateExclusive: endExclusive,
    groups, entryCount: entries.length, shownTextEntries: shown, text: lines.join("\n") + "\n", status: "NO_REPLAY",
    blockedStores: Object.entries(sources).filter(([,s]) => s.state === "BLOCKED").map(([id]) => id), missingStores: Object.entries(sources).filter(([,s]) => s.state === "MISSING").map(([id]) => id),
    snapshotAtomicAcrossStores: false, originalPublicationHistoryKnown: false, actualReleaseValuesCollected: false, tradingRiskWindow: null,
    networkAccess: false, sourceAppends: 0, reportFilesCreated: false, executionAllowed: false, replayAllowed: false, winProbability: null };
  return freeze({ ...payload, reportSha256: readinessFingerprint(payload) });
}
