import { createHash } from "node:crypto";
import { canonicalizeDeterministicValue } from "../../contracts/DeterministicFingerprint";
import { exchangeLocalDate } from "../market-calendar/MarketCalendarValidation";

export const RELEASE_CALENDAR_VERSION = "BLS_RELEASE_CALENDAR_V1";
export const RELEASE_CALENDAR_URL = "https://www.bls.gov/schedule/news_release/bls.ics";
export const RELEASE_CALENDAR_MAX_BYTES = 524288;
export const RELEASE_CALENDAR_ERRORS = ["NETWORK_FAILED", "DEADLINE_EXCEEDED", "HTTP_STATUS", "CONTENT_TYPE", "BODY_TOO_LARGE", "BODY_MISSING", "INVALID_UTF8", "SOURCE_SCHEMA"] as const;
export interface ReleaseCalendarInput { requestedAt: string; receivedAt: string; url: string; sourceText: string | null; errorCode: typeof RELEASE_CALENDAR_ERRORS[number] | null }
export interface BlsReleaseEvent {
  uid: string; sequence: number; title: string; family: string; sourceStart: string;
  sourceTimezone: "US-Eastern"; scheduledAt: string; sourceStampAt: string | null;
  sourceModifiedAt: string | null; status: "UNSPECIFIED" | "CONFIRMED" | "TENTATIVE" | "CANCELLED";
}
function fail(code: string): never { throw Error("RELEASE_CALENDAR_" + code); }
export const releaseCalendarSha = (text: string): string => createHash("sha256").update(text, "utf8").digest("hex");
export const releaseCalendarFingerprint = (value: unknown): string => releaseCalendarSha(canonicalizeDeterministicValue(value));
function freeze<T>(v: T): T { if (v && typeof v === "object") { Object.values(v).forEach(freeze); Object.freeze(v); } return v; }
export function releaseCalendarClock(v: unknown): asserts v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v) || !Number.isFinite(Date.parse(v)) || new Date(v).toISOString() !== v) fail("CLOCK");
}
export function releaseCalendarUrl(requestedAt: string): string { releaseCalendarClock(requestedAt); return RELEASE_CALENDAR_URL; }
function utc(raw: string): string {
  if (!/^(?:20\d{2}|2100)\d{4}T\d{6}Z$/.test(raw)) fail("SOURCE_DATE");
  const value = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}T${raw.slice(9, 11)}:${raw.slice(11, 13)}:${raw.slice(13, 15)}.000Z`;
  releaseCalendarClock(value); return value;
}
const easternFormat = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
export function blsEasternTime(raw: string): string {
  const nominal = utc(raw + "Z");
  if (Number(raw.slice(0, 4)) < 2007) fail("TIMEZONE_YEAR");
  const matches = [4, 5].map(hours => new Date(Date.parse(nominal) + hours * 3600000).toISOString()).filter(candidate => {
    const p = Object.fromEntries(easternFormat.formatToParts(new Date(candidate)).map(part => [part.type, part.value]));
    return `${p.year}${p.month}${p.day}T${p.hour}${p.minute}${p.second}` === raw;
  });
  if (matches.length !== 1) fail("AMBIGUOUS_OR_NONEXISTENT_TIME");
  return matches[0]!;
}
interface Node { name: string; fields: Record<string, string>; children: Node[] }
function tree(source: string): Node {
  if (typeof source !== "string" || new TextEncoder().encode(source).byteLength > RELEASE_CALENDAR_MAX_BYTES) fail("BODY_TOO_LARGE");
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff\ufeff]/u.test(source) || /[\ud800-\udfff]/u.test(source) || /\r(?!\n)/.test(source)) fail("ICS_CHARACTER");
  const physical = source.split(/\r?\n/), lines: string[] = [];
  if (physical.length > 20000) fail("ICS_LIMIT");
  for (const line of physical) {
    if (/^[ \t]/.test(line)) { if (!lines.length || !lines.at(-1)) fail("ICS_FOLD"); lines[lines.length - 1] += line.slice(1); }
    else lines.push(line);
    if (lines.at(-1)!.length > 4096) fail("ICS_LIMIT");
  }
  const stack: Node[] = [], roots: Node[] = []; let nodes = 0;
  for (const line of lines) {
    if (!line) continue;
    const match = /^([A-Z][A-Z0-9-]*(?:;TZID=US-Eastern)?):(.*)$/.exec(line);
    if (!match) fail("ICS_PROPERTY");
    const key = match[1]!, value = match[2]!;
    if (key === "BEGIN") {
      if (!/^(?:VCALENDAR|VTIMEZONE|DAYLIGHT|STANDARD|VEVENT)$/.test(value) || ++nodes > 1005 || stack.length > 2) fail("ICS_COMPONENT");
      const node: Node = { name: value, fields: Object.create(null) as Record<string, string>, children: [] };
      if (stack.length) stack.at(-1)!.children.push(node); else roots.push(node); stack.push(node);
    } else if (key === "END") { if (stack.pop()?.name !== value) fail("ICS_NESTING"); }
    else { const node = stack.at(-1); if (!node || Object.hasOwn(node.fields, key)) fail("ICS_DUPLICATE_OR_OUTSIDE_PROPERTY"); node.fields[key] = value; }
  }
  if (stack.length || roots.length !== 1 || roots[0]!.name !== "VCALENDAR") fail("ICS_INCOMPLETE");
  return roots[0]!;
}
function fields(node: Node, required: string[], optional: string[] = []) {
  if (required.some(key => !Object.hasOwn(node.fields, key)) || Object.keys(node.fields).some(key => ![...required, ...optional].includes(key))) fail("ICS_SCHEMA");
}
function text(raw: string): string {
  let result = "";
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] !== "\\") { result += raw[i]; continue; }
    const value = raw[++i]; if (value === undefined || !["\\", ",", ";", "n", "N"].includes(value)) fail("ICS_TEXT_ESCAPE");
    result += value === "n" || value === "N" ? "\n" : value;
  }
  return result;
}
const tags: Record<string, string> = {
  "Consumer Price Index": "CPI", "Producer Price Index": "PPI", "Employment Situation": "EMPLOYMENT_SITUATION",
  "Job Openings and Labor Turnover Survey": "JOLTS", "Employment Cost Index": "EMPLOYMENT_COST_INDEX",
  "U.S. Import and Export Price Indexes": "IMPORT_EXPORT_PRICES", "Productivity and Costs": "PRODUCTIVITY_COSTS",
};
function timezone(node: Node) {
  fields(node, ["TZID"]);
  if (node.fields.TZID !== "US-Eastern" || node.children.length !== 2 || new Set(node.children.map(c => c.name)).size !== 2) fail("TIMEZONE_SCHEMA");
  for (const c of node.children) {
    const expected = c.name === "DAYLIGHT" ? { TZOFFSETFROM: "-0500", TZOFFSETTO: "-0400", DTSTART: "20070311T020000", RRULE: "FREQ=YEARLY;BYMONTH=3;BYDAY=2SU", TZNAME: "EDT" } :
      c.name === "STANDARD" ? { TZOFFSETFROM: "-0400", TZOFFSETTO: "-0500", DTSTART: "20071104T020000", RRULE: "FREQ=YEARLY;BYMONTH=11;BYDAY=1SU", TZNAME: "EST" } : null;
    if (!expected || c.children.length || releaseCalendarFingerprint(c.fields) !== releaseCalendarFingerprint(expected)) fail("TIMEZONE_SCHEMA");
  }
}
export function parseBlsCalendar(source: string, receivedAt: string): BlsReleaseEvent[] {
  releaseCalendarClock(receivedAt);
  const root = tree(source);
  fields(root, ["PRODID", "VERSION", "CALSCALE", "METHOD", "SUMMARY", "X-WR-CALNAME", "X-WR-TIMEZONE"]);
  if (root.fields.PRODID !== "-//Department of Labor//Bureau of Labor Statistics//EN" || root.fields.VERSION !== "2.0" || root.fields.CALSCALE !== "GREGORIAN" || root.fields.METHOD !== "PUBLISH" || root.fields["X-WR-TIMEZONE"] !== "US-Eastern") fail("CALENDAR_IDENTITY");
  if (!root.fields.SUMMARY || !root.fields["X-WR-CALNAME"] || root.children.some(c => !["VTIMEZONE", "VEVENT"].includes(c.name))) fail("CALENDAR_SCHEMA");
  const zones = root.children.filter(c => c.name === "VTIMEZONE"); if (zones.length !== 1) fail("TIMEZONE_SCHEMA"); timezone(zones[0]!);
  const events: BlsReleaseEvent[] = [], ids = new Set<string>();
  for (const node of root.children.filter(c => c.name === "VEVENT")) {
    fields(node, ["SEQUENCE", "CLASS", "UID", "DTSTART;TZID=US-Eastern", "DURATION", "SUMMARY", "LOCATION", "TRANSP", "CATEGORIES"], ["DTSTAMP", "LAST-MODIFIED", "STATUS", "DESCRIPTION"]);
    const f = node.fields;
    if (node.children.length || f.CLASS !== "PUBLIC" || f.DURATION !== "PT0M" || f.TRANSP !== "TRANSPARENT" || f.CATEGORIES !== "IMPORTANT, BLS") fail("EVENT_SCHEMA");
    const uid = f.UID!;
    if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(uid) || ids.has(uid)) fail("EVENT_UID"); ids.add(uid);
    if (!/^(?:0|[1-9]\d{0,8})$/.test(f.SEQUENCE!)) fail("EVENT_SEQUENCE");
    const title = text(f.SUMMARY!); if (!title.trim() || title.length > 512) fail("EVENT_TITLE");
    text(f.LOCATION!); if (f.DESCRIPTION !== undefined) text(f.DESCRIPTION);
    const status = f.STATUS ?? "UNSPECIFIED";
    if (!["UNSPECIFIED", "CONFIRMED", "TENTATIVE", "CANCELLED"].includes(status)) fail("EVENT_STATUS");
    const stamp = f.DTSTAMP === undefined ? null : utc(f.DTSTAMP), modified = f["LAST-MODIFIED"] === undefined ? null : utc(f["LAST-MODIFIED"]);
    if (stamp !== null && stamp > receivedAt || modified !== null && modified > receivedAt) fail("SOURCE_CLOCK");
    events.push({ uid, sequence: Number(f.SEQUENCE), title, family: Object.hasOwn(tags, title) ? tags[title]! : "OTHER_BLS_RELEASE", sourceStart: f["DTSTART;TZID=US-Eastern"]!,
      sourceTimezone: "US-Eastern", scheduledAt: blsEasternTime(f["DTSTART;TZID=US-Eastern"]!), sourceStampAt: stamp, sourceModifiedAt: modified,
      status: status as BlsReleaseEvent["status"] });
  }
  if (events.length > 1000) fail("EVENT_LIMIT");
  return freeze(events.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt) || a.uid.localeCompare(b.uid)));
}
export function assessReleaseCalendar(input: ReleaseCalendarInput) {
  if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).sort().join() !== "errorCode,receivedAt,requestedAt,sourceText,url" || input.url !== RELEASE_CALENDAR_URL) fail("INPUT_SCOPE");
  releaseCalendarClock(input.requestedAt); releaseCalendarClock(input.receivedAt); if (input.receivedAt < input.requestedAt) fail("CLOCK_ORDER");
  if (input.sourceText === null ? input.errorCode === null || !RELEASE_CALENDAR_ERRORS.includes(input.errorCode) : input.errorCode !== null || typeof input.sourceText !== "string") fail("INPUT_STATE");
  const events = input.sourceText === null ? [] : parseBlsCalendar(input.sourceText, input.receivedAt);
  return freeze({ version: RELEASE_CALENDAR_VERSION, requestedAt: input.requestedAt, receivedAt: input.receivedAt, url: input.url,
    status: input.errorCode !== null ? "FAILED" : events.length ? "OBSERVED_SCHEDULE" : "EMPTY_SCHEDULE", errorCode: input.errorCode,
    sourceSha256: input.sourceText === null ? null : releaseCalendarSha(input.sourceText), events,
    missingSourceStampCount: events.filter(e => e.sourceStampAt === null).length, missingSourceModifiedCount: events.filter(e => e.sourceModifiedAt === null).length,
    originalPublicationTimeKnown: false, calendarProfile: "RESTRICTED_BLS_ICS_WITH_EXPLICIT_MISSING_METADATA" } as const);
}
export function reportReleaseCalendar(inputs: readonly ReleaseCalendarInput[], assessedAt: string) {
  releaseCalendarClock(assessedAt); if (!Array.isArray(inputs) || inputs.length > 366) fail("HISTORY_LIMIT");
  let priorAt: string | null = null;
  const assessments = inputs.map(input => { const r = assessReleaseCalendar(input); if (priorAt !== null && r.requestedAt < priorAt || r.receivedAt > assessedAt) fail("HISTORY_CLOCK"); priorAt = r.receivedAt; return r; });
  const latest = assessments.at(-1) ?? null, prior = assessments.at(-2) ?? null;
  const lastKnown = [...assessments].reverse().find(r => r.status !== "FAILED") ?? null;
  const comparisonAvailable = !!latest && latest.status !== "FAILED" && !!prior && prior.status !== "FAILED";
  const old = new Map((comparisonAvailable ? prior!.events : []).map(e => [e.uid, e])), current = new Map((comparisonAvailable ? latest!.events : []).map(e => [e.uid, e]));
  const changes = comparisonAvailable ? latest!.events.filter(e => old.has(e.uid) && releaseCalendarFingerprint(e) !== releaseCalendarFingerprint(old.get(e.uid))).map(e => ({ uid: e.uid, before: old.get(e.uid)!, after: e, observedAt: latest!.receivedAt, sequenceRegressed: e.sequence < old.get(e.uid)!.sequence })) : [];
  const currentEvents = latest && latest.status !== "FAILED" ? latest.events : [];
  const horizonEndAt = new Date(Date.parse(assessedAt) + 7 * 86400000).toISOString(), today = exchangeLocalDate(assessedAt, "America/New_York");
  const ageMs = latest && latest.status !== "FAILED" ? Date.parse(assessedAt) - Date.parse(latest.receivedAt) : null;
  return freeze({ version: RELEASE_CALENDAR_VERSION, assessedAt, relevantAssets: ["GLD", "IBIT"], source: "BLS_PUBLIC_RELEASE_CALENDAR", retrievalCount: inputs.length,
    latestRetrieval: latest, lastKnownSchedule: lastKnown ? { ...lastKnown, fromLatestRetrieval: lastKnown === latest } : null,
    retrievalAgeMs: ageMs, refreshOverdue: ageMs === null || ageMs > 26 * 3600000, publisherFreshnessKnown: false,
    horizonEndAt, upcoming: currentEvents.filter(e => e.status !== "CANCELLED" && e.scheduledAt >= assessedAt && e.scheduledAt < horizonEndAt),
    sameNewYorkDay: currentEvents.filter(e => e.status !== "CANCELLED" && exchangeLocalDate(e.scheduledAt, "America/New_York") === today),
    cancelledInLatest: currentEvents.filter(e => e.status === "CANCELLED"), tentativeInLatest: currentEvents.filter(e => e.status === "TENTATIVE"),
    comparison: { available: comparisonAvailable, issue: comparisonAvailable ? null : assessments.length < 2 ? "TWO_SNAPSHOTS_REQUIRED" : "CONSECUTIVE_SUCCESSFUL_SNAPSHOTS_REQUIRED",
      addedUids: comparisonAvailable ? [...current.keys()].filter(uid => !old.has(uid)) : [], absentUids: comparisonAvailable ? [...old.keys()].filter(uid => !current.has(uid)) : [],
      changes, absenceMeansCancellation: false, originalChangeTimeKnown: false },
    coverageComplete: false, missingCoverage: ["NON_BLS_RELEASES", "UNSCHEDULED_EVENTS", "RELEASED_VALUES_AND_SURPRISES", "ORIGINAL_PUBLICATION_HISTORY"],
    tradingRiskWindow: null, winProbability: null, strategySignal: null, executionAllowed: false, replayAllowed: false });
}
