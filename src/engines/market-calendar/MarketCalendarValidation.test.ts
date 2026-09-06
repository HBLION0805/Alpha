import { deterministicFingerprint } from "../../contracts/DeterministicFingerprint";
import { MarketCalendarSessionStatus, MarketDataOrigin, type MarketCalendarSessionEvidence } from "../../contracts/MarketCalendar";
import { exchangeLocalDate, latestCompletedTradingSession, validateMarketCalendarEvidence } from "./MarketCalendarValidation";

let passed = 0;
function test(name: string, run: () => void): void { run(); passed++; console.log(`PASS ${name}`); }
function assert(value: unknown): asserts value { if (!value) throw new Error("Calendar assertion failed"); }
function session(date: string, open = "14:30", close = "21:00", status = MarketCalendarSessionStatus.Completed): MarketCalendarSessionEvidence {
  const body = {
    calendarEvidenceId: `calendar-evidence:${date}`, calendarId: "calendar:us-equity:fixture",
    sessionId: `session:${date}:regular`, sessionDate: date, sessionType: "REGULAR" as const,
    timezone: "America/New_York", marketOpen: `${date}T${open}:00.000Z`, marketClose: `${date}T${close}:00.000Z`,
    closureBufferSeconds: 30, status, provenanceReference: `fixture:calendar:${date}`, dataOrigin: MarketDataOrigin.Fixture,
  };
  return {...body, calendarEvidenceFingerprint: deterministicFingerprint(body)};
}
function rehash(value: MarketCalendarSessionEvidence): MarketCalendarSessionEvidence {
  const {calendarEvidenceFingerprint: ignored, ...body} = value;
  return {...body, calendarEvidenceFingerprint: deterministicFingerprint(body)};
}
const regular = session("2026-11-25");
const asOf = "2026-11-27T18:02:00.000Z";
const holiday = session("2026-11-26", "14:30", "21:00", MarketCalendarSessionStatus.HolidayClosed);
const earlyClose = session("2026-11-27", "14:30", "18:00");

test("regular, holiday and early-close evidence survives extraction", () => {
  assert(validateMarketCalendarEvidence([regular, holiday, earlyClose], asOf).valid);
  assert(latestCompletedTradingSession(asOf, [regular, holiday, earlyClose])?.sessionDate === "2026-11-27");
});
test("calendar selection excludes holiday and future closure", () => {
  assert(latestCompletedTradingSession("2026-11-27T17:00:00.000Z", [regular, holiday, earlyClose])?.sessionDate === "2026-11-25");
});
test("completed session requires its full closure buffer", () => {
  assert(!validateMarketCalendarEvidence([earlyClose], "2026-11-27T18:00:29.000Z").valid);
  assert(validateMarketCalendarEvidence([earlyClose], "2026-11-27T18:00:30.000Z").valid);
});
test("scheduled evidence cannot remain scheduled after closure", () => {
  const scheduled = session("2026-11-27", "14:30", "18:00", MarketCalendarSessionStatus.Scheduled);
  assert(validateMarketCalendarEvidence([scheduled], "2026-11-27T18:00:29.000Z").valid);
  assert(!validateMarketCalendarEvidence([scheduled], asOf).valid);
});
test("spring and autumn daylight-saving session offsets remain explicit", () => {
  for (const evidence of [session("2026-03-06"), session("2026-03-09", "13:30", "20:00"), session("2026-10-30", "13:30", "20:00"), session("2026-11-02")]) {
    assert(validateMarketCalendarEvidence([evidence], "2026-12-01T00:00:00.000Z").valid);
  }
});
test("exchange-local dates honor timezone and reject invalid clocks", () => {
  assert(exchangeLocalDate("2026-03-09T01:00:00.000Z", "America/New_York") === "2026-03-08");
  assert(exchangeLocalDate(asOf, "not-a-timezone") === "");
  assert(exchangeLocalDate("invalid", "America/New_York") === "");
});
test("altered calendar fingerprints fail", () => {
  assert(!validateMarketCalendarEvidence([{...regular, closureBufferSeconds: 31}], asOf).valid);
});
test("duplicate calendar dates fail even with identical valid fingerprints", () => {
  assert(!validateMarketCalendarEvidence([regular, regular], asOf).valid);
});
test("weekend cannot be a completed trading session", () => {
  assert(!validateMarketCalendarEvidence([session("2026-11-28")], "2026-11-29T00:00:00.000Z").valid);
});
test("unknown fields cannot add calendar authority", () => {
  assert(!validateMarketCalendarEvidence([{...regular, trusted: true}], asOf).valid);
});
test("malformed entries, empty calendars and noncanonical timestamps fail", () => {
  for (const input of [null, [], [null], [{}]]) assert(!validateMarketCalendarEvidence(input, asOf).valid);
  assert(!validateMarketCalendarEvidence([regular], "2026-11-27T18:02:00Z").valid);
  assert(latestCompletedTradingSession("invalid", [regular]) === undefined);
});
test("self-consistent but mismatched session identities fail", () => {
  assert(!validateMarketCalendarEvidence([rehash({...regular, sessionId: "session:wrong:regular"})], asOf).valid);
});
test("self-consistent reversed hours and invalid origin fail", () => {
  assert(!validateMarketCalendarEvidence([rehash({...regular, marketClose: regular.marketOpen})], asOf).valid);
  assert(!validateMarketCalendarEvidence([rehash({...regular, dataOrigin: "UNKNOWN" as MarketDataOrigin})], asOf).valid);
});
test("validation results and diagnostic issues are immutable", () => {
  const result = validateMarketCalendarEvidence([], asOf);
  assert(Object.isFrozen(result) && Object.isFrozen(result.issues) && Object.isFrozen(result.issues[0]));
});
console.log(`Market Calendar validation: ${passed}/${passed} passed.`);
