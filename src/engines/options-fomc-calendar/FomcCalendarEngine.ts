import { createHash } from "node:crypto";
import { canonicalizeDeterministicValue } from "../../contracts/DeterministicFingerprint";
import { exchangeLocalDate } from "../market-calendar/MarketCalendarValidation";

export const FOMC_CALENDAR_VERSION = "FOMC_DATE_CALENDAR_V1";
export const FOMC_CALENDAR_URL = "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm";
export const FOMC_CALENDAR_MAX_BYTES = 512 * 1024;
export const FOMC_CALENDAR_ERRORS = ["NETWORK_FAILED", "DEADLINE_EXCEEDED", "HTTP_STATUS", "CONTENT_TYPE", "BODY_TOO_LARGE", "BODY_MISSING", "INVALID_UTF8", "SOURCE_SCHEMA"] as const;
export interface FomcCalendarInput { requestedAt: string; receivedAt: string; url: string; sourceText: string | null; errorCode: typeof FOMC_CALENDAR_ERRORS[number] | null }
export const fomcCalendarSha = (text: string): string => createHash("sha256").update(text, "utf8").digest("hex");
export const fomcCalendarFingerprint = (v: unknown): string => fomcCalendarSha(canonicalizeDeterministicValue(v));
function fail(code: string): never { throw Error("FOMC_CALENDAR_" + code); }
function freeze<T>(v: T): T { if (v && typeof v === "object") { Object.values(v).forEach(freeze); Object.freeze(v); } return v; }
export function fomcCalendarClock(v: unknown): string { if (typeof v !== "string" || !Number.isFinite(Date.parse(v)) || new Date(v).toISOString() !== v || !/^20\d{2}-/.test(v)) fail("CLOCK"); return v; }
export function fomcCalendarUrl(at: string): string { fomcCalendarClock(at); return FOMC_CALENDAR_URL; }
const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
function month(text: string): number { const index = months.findIndex(m => m === text || m.slice(0, 3) === text); return index < 0 ? fail("MONTH") : index + 1; }
function day(year: number, month: number, day: number): string {
  const value = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const parsed = Date.parse(value + "T00:00:00.000Z");
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString().slice(0, 10) !== value) fail("DATE");
  return value;
}
interface Meeting {
  dateKey: string; calendarYear: number; sourceMonth: string; sourceDays: string; startDate: string; endDate: string;
  kind: "MEETING_DATE_RANGE" | "NOTATION_VOTE" | "UNSCHEDULED"; projectionMarker: boolean;
  datePrecision: "CALENDAR_DATE_ONLY"; intradayTime: null; confirmationStatus: "NOT_INDEPENDENTLY_VERIFIED";
}
function interval(year: number, sourceMonth: string, sourceDays: string): Meeting {
  const parts = sourceMonth.split("/"); if (parts.length < 1 || parts.length > 2) fail("MONTH");
  const firstMonth = month(parts[0]!), lastMonth = parts.length === 2 ? month(parts[1]!) : firstMonth;
  if (parts.length === 2 && lastMonth !== firstMonth % 12 + 1) fail("MONTH_SEQUENCE");
  const match = /^(\d{1,2})(?:-(\d{1,2}))?(\*)?(?: \((notation vote|unscheduled)\))?$/.exec(sourceDays);
  if (!match || !match[2] && !match[4] || match[2] && match[4] || parts.length === 2 && !match[2]) fail("DAY_LABEL");
  const startDate = day(year, firstMonth, Number(match[1])), endDate = day(year + (lastMonth < firstMonth ? 1 : 0), lastMonth, Number(match[2] ?? match[1]));
  const length = Date.parse(endDate) - Date.parse(startDate); if (length < 0 || length > 6 * 86400000) fail("INTERVAL");
  const kind = match[4] === "notation vote" ? "NOTATION_VOTE" : match[4] === "unscheduled" ? "UNSCHEDULED" : "MEETING_DATE_RANGE";
  return { dateKey: `${startDate}/${endDate}/${kind}`, calendarYear: year, sourceMonth, sourceDays, startDate, endDate, kind,
    projectionMarker: !!match[3], datePrecision: "CALENDAR_DATE_ONLY", intradayTime: null, confirmationStatus: "NOT_INDEPENDENTLY_VERIFIED" };
}
function divs(html: string, className: string) {
  return [...html.matchAll(/<div\b[^>]*>/g)].filter(m => {
    const c = /\bclass="([^"]*)"/.exec(m[0]); return !!c && c[1]!.split(/\s+/).includes(className);
  });
}
function field(html: string, className: string, strong: boolean): string {
  const tags = divs(html, className); if (tags.length !== 1) fail("ROW_FIELD_COUNT");
  const tag = tags[0]!; if (!/^<div class="[A-Za-z0-9_ -]+">$/.test(tag[0])) fail("ROW_FIELD_ATTRIBUTES");
  const start = tag.index + tag[0].length, end = html.indexOf("</div>", start); if (end < 0) fail("ROW_FIELD_END");
  let value = html.slice(start, end).trim();
  if (strong) { const m = /^<strong>([^<>]+)<\/strong>$/.exec(value); if (!m) fail("MONTH_MARKUP"); value = m[1]!; }
  if (/[<>&]/.test(value) || value.length > 64) fail("ROW_FIELD_TEXT"); return value.trim();
}
export function parseFomcCalendar(source: string, receivedAt: string) {
  fomcCalendarClock(receivedAt);
  if (typeof source !== "string" || new TextEncoder().encode(source).byteLength > FOMC_CALENDAR_MAX_BYTES) fail("BODY_TOO_LARGE");
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(source)) fail("SOURCE_TEXT");
  const clean = source.replace(/<!--[\s\S]*?-->/g, "").replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "").replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, "");
  if (/<!--|-->|<\/?script\b|<\/?style\b|<!ENTITY/i.test(clean)) fail("UNSUPPORTED_MARKUP");
  const titles = [...clean.matchAll(/<title>([^<>]*)<\/title>/g)];
  if (titles.length !== 1 || titles[0]![1]!.trim() !== "The Fed - Meeting calendars and information") fail("PAGE_IDENTITY");
  const headers = [...clean.matchAll(/<div class="panel panel-default"><div class="panel-heading"><h4><a id="\d+">(20\d{2}) FOMC Meetings<\/a><\/h4><\/div>/g)];
  if (!headers.length || headers.length > 12) fail("YEAR_PANELS");
  const currentYear = Number(exchangeLocalDate(receivedAt, "America/New_York").slice(0, 4)), meetings: Meeting[] = [], selectedYears: number[] = [];
  let previousEnd: string | null = null;
  for (const year of [currentYear, currentYear + 1]) {
    const selected = headers.filter(h => Number(h[1]) === year);
    if (selected.length > 1 || year === currentYear && selected.length !== 1) fail("SELECTED_YEAR_PANEL");
    if (!selected.length) continue;
    const header = selected[0]!, next = headers.find(h => h.index > header.index);
    const section = clean.slice(header.index + header[0].length, next?.index ?? clean.length);
    const footers = divs(section, "panel-footer"); if (footers.length !== 1) fail("PANEL_FOOTER");
    const footer = footers[0]!, rows = section.slice(0, footer.index);
    if (!section.slice(footer.index, section.indexOf("</div>", footer.index)).includes("* Meeting associated with a Summary of Economic Projections.")) fail("PROJECTION_LEGEND");
    const starts = divs(rows, "fomc-meeting");
    if (starts.length < 1 || starts.length > 16 || divs(rows, "fomc-meeting__month").length !== starts.length || divs(rows, "fomc-meeting__date").length !== starts.length) fail("ROW_COUNT");
    for (const [i, tag] of starts.entries()) {
      if (!/^<div class="(?:row|fomc-meeting|fomc-meeting--shaded| )+"\s*"?>$/.test(tag[0])) fail("ROW_ATTRIBUTES");
      const row = rows.slice(tag.index + tag[0].length, starts[i + 1]?.index ?? rows.length);
      const meeting = interval(year, field(row, "fomc-meeting__month", true), field(row, "fomc-meeting__date", false));
      if (previousEnd !== null && meeting.startDate <= previousEnd) fail("MEETING_ORDER_OR_OVERLAP");
      previousEnd = meeting.endDate; meetings.push(meeting);
    }
    selectedYears.push(year);
  }
  const updates = [...clean.matchAll(/<div class=['"]lastUpdate['"] id="lastUpdate">Last Update:\s*([A-Za-z]+) (\d{1,2}), (20\d{2})\s*<\/div>/g)];
  const updateFields = [...clean.matchAll(/<div\b[^>]*\bid=['"]lastUpdate['"][^>]*>/g)];
  if (updates.length > 1 || updateFields.length !== updates.length) fail("PAGE_UPDATE_DATE");
  const update = updates[0], pageUpdatedDate = update ? day(Number(update[3]), month(update[1]!), Number(update[2])) : null;
  if (pageUpdatedDate !== null && pageUpdatedDate > exchangeLocalDate(receivedAt, "America/New_York")) fail("PAGE_UPDATE_AFTER_RECEIPT");
  return freeze({ currentYearAtReceipt: currentYear, selectedYears, nextYearPanelPresent: selectedYears.includes(currentYear + 1), meetings, pageUpdatedDate,
    tentativeUntilPrecedingMeetingNotePresent: clean.includes("Each meeting date is tentative until confirmed at the meeting immediately preceding it."),
    originalPublicationTimesKnown: false, stableOfficialEventIdsKnown: false, additionalDateNotesParsed: false, intradayTimesKnown: false });
}
export function assessFomcCalendar(input: FomcCalendarInput) {
  if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).sort().join() !== "errorCode,receivedAt,requestedAt,sourceText,url" || input.url !== FOMC_CALENDAR_URL) fail("INPUT_SCOPE");
  fomcCalendarClock(input.requestedAt); fomcCalendarClock(input.receivedAt); if (input.receivedAt < input.requestedAt) fail("CLOCK_ORDER");
  if (input.sourceText === null ? input.errorCode === null || !FOMC_CALENDAR_ERRORS.includes(input.errorCode) : input.errorCode !== null || typeof input.sourceText !== "string") fail("INPUT_STATE");
  const calendar = input.sourceText === null ? null : parseFomcCalendar(input.sourceText, input.receivedAt);
  return freeze({ version: FOMC_CALENDAR_VERSION, requestedAt: input.requestedAt, receivedAt: input.receivedAt, url: input.url,
    status: input.errorCode !== null ? "FAILED" : "OBSERVED_DATE_SCHEDULE", errorCode: input.errorCode,
    sourceSha256: input.sourceText === null ? null : fomcCalendarSha(input.sourceText), calendar, journalAppendTimeKnown: false } as const);
}
export function reportFomcCalendar(inputs: readonly FomcCalendarInput[], assessedAt: string) {
  fomcCalendarClock(assessedAt); if (!Array.isArray(inputs) || inputs.length > 366) fail("HISTORY_LIMIT");
  let previousReceipt: string | null = null;
  const assessments = inputs.map(input => { const r = assessFomcCalendar(input); if (previousReceipt !== null && r.requestedAt < previousReceipt || r.receivedAt > assessedAt) fail("HISTORY_CLOCK"); previousReceipt = r.receivedAt; return r; });
  const latest = assessments.at(-1) ?? null, prior = assessments.at(-2) ?? null, lastKnown = [...assessments].reverse().find(r => r.calendar !== null) ?? null;
  const today = exchangeLocalDate(assessedAt, "America/New_York"), horizonEndDateExclusive = new Date(Date.parse(today) + 30 * 86400000).toISOString().slice(0, 10);
  const meetings = latest?.calendar?.meetings ?? [], sameYears = !!latest?.calendar && !!prior?.calendar && JSON.stringify(latest.calendar.selectedYears) === JSON.stringify(prior.calendar.selectedYears);
  const before = new Map((sameYears ? prior!.calendar!.meetings : []).map(m => [m.dateKey, m])), after = new Map((sameYears ? meetings : []).map(m => [m.dateKey, m]));
  const ageMs = latest?.calendar ? Date.parse(assessedAt) - Date.parse(latest.receivedAt) : null;
  return freeze({ version: FOMC_CALENDAR_VERSION, assessedAt, relevantAssets: ["GLD", "IBIT"], source: "FEDERAL_RESERVE_PUBLIC_MEETING_CALENDAR", retrievalCount: inputs.length,
    latestRetrieval: latest, lastKnownSchedule: lastKnown ? { ...lastKnown, fromLatestRetrieval: lastKnown === latest } : null,
    retrievalAgeMs: ageMs, refreshOverdue: ageMs === null || ageMs > 26 * 3600000, publisherFreshnessKnown: false,
    todayNewYork: today, horizonEndDateExclusive, upcoming: meetings.filter(m => m.endDate >= today && m.startDate < horizonEndDateExclusive),
    overlappingToday: meetings.filter(m => m.startDate <= today && m.endDate >= today),
    comparison: { available: sameYears, issue: sameYears ? null : latest?.calendar && prior?.calendar ? "SELECTED_YEAR_SCOPE_CHANGED" : "CONSECUTIVE_SUCCESSFUL_SNAPSHOTS_REQUIRED",
      addedDateKeys: sameYears ? [...after.keys()].filter(k => !before.has(k)) : [], absentDateKeys: sameYears ? [...before.keys()].filter(k => !after.has(k)) : [],
      changed: sameYears ? meetings.filter(m => before.has(m.dateKey) && fomcCalendarFingerprint(m) !== fomcCalendarFingerprint(before.get(m.dateKey))).map(m => ({ dateKey: m.dateKey, before: before.get(m.dateKey)!, after: m, observedAt: latest!.receivedAt })) : [],
      absenceMeansCancellation: false, dateKeyChangesProveRescheduling: false, originalChangeTimeKnown: false },
    coverageComplete: false, missingCoverage: ["INTRADAY_RELEASE_TIMES", "INDEPENDENT_DATE_CONFIRMATION", "FREE_FORM_DATE_NOTES", "NON_FOMC_EVENTS", "ORIGINAL_PUBLICATION_HISTORY"],
    tradingRiskWindow: null, winProbability: null, strategySignal: null, executionAllowed: false, replayAllowed: false });
}
