import { test } from "node:test";
import assert from "node:assert/strict";
import { fromBySymbol, mergeEarnings, nextEarnings, fmtEarnings, symbolsNeedingEarnings } from "../src/options/earningsStore.ts";
import { parseFedCalendar, blackout, inBlackout, to24, isVoter, renderFedSpeakers } from "../src/ingest/fedSpeakers.ts";

const BS = { bySymbol: { MSGS: [
  { symbol: "MSGS", eps: { actual: "1.16" }, report: { date: "2026-08-13", timing: "am", verified: true } },
  { symbol: "MSGS", eps: { actual: null }, report: { date: "2026-10-30", timing: "am", verified: false } }], BMNR: [] } };

test("earnings: estimated vs confirmed, next on/after today", () => {
  const rows = mergeEarnings([{ symbol: "NVDA", date: "2026-11-17", timing: "pm", verified: true }], fromBySymbol(BS));
  const book = { rows, fetchedAt: null, covered: new Set(["MSGS", "BMNR", "NVDA"]) };
  const m = nextEarnings(book, "msgs", "2026-10-15")!;
  assert.equal(m.date, "2026-10-30"); assert.equal(m.confirmed, false); assert.match(fmtEarnings(m), /预估（未确认）/); assert.match(fmtEarnings(m), /BMO/);
  assert.equal(nextEarnings(book, "NVDA", "2026-10-15")!.confirmed, true);
  assert.equal(nextEarnings(book, "BMNR", "2026-10-15"), null); // looked up, none
  assert.equal(nextEarnings(book, "XYZ", "2026-10-15"), undefined); // never looked up → missing, not invented
});
test("earnings: per-symbol overrides calendar on same date; ETFs excluded from lookups", () => {
  const rows = mergeEarnings([{ symbol: "MSGS", date: "2026-10-30", timing: null, verified: null }], fromBySymbol(BS));
  assert.equal(rows.filter((r) => r.symbol === "MSGS" && r.date === "2026-10-30")[0]!.timing, "am");
  assert.deepEqual(symbolsNeedingEarnings(["spy", "NVDA", "nvda", "QQQ", "MSGS"]), ["MSGS", "NVDA"]);
});

const FED = { events: [
  { title: "Discussion - Chairman Kevin Warsh", description: "Conversation", location: "Bangkok", time: "11:30 p.m.", month: "2026-10", days: "15", type: "Speeches" },
  { title: "Discussion - Chairman Kevin Warsh", description: "Conversation", location: "Bangkok", time: "11:30 p.m.", month: "2026-10", days: "15", type: "Speeches" },
  { title: "Testimony - Vice Chair for Supervision Michelle W. Bowman", description: "Supervision", time: "10:00 a.m.", month: "2026-11", days: "4", type: "Testimony" },
  { title: "FOMC Meeting", description: "&lt;p&gt;Two-day meeting, October 27 - 28&lt;/p&gt;", time: "2:00 p.m.", month: "2026-10", days: "28", type: "FOMC" },
  { title: "H.15", time: "4:15 p.m.", month: "2026-10", days: "16", type: "Stat" }] };

test("fed: parses speeches/testimony with ET time, role, voter; dedupes", () => {
  const p = parseFedCalendar(FED);
  assert.equal(p.speeches.length, 2);
  assert.deepEqual([p.speeches[0]!.date, p.speeches[0]!.timeEt, p.speeches[0]!.role, p.speeches[0]!.voter, p.speeches[0]!.kind], ["2026-10-15", "23:30", "Chairman", true, "discussion"]);
  assert.equal(p.speeches[1]!.kind, "testimony");
  assert.deepEqual(p.fomcMeetings, [{ start: "2026-10-27", end: "2026-10-28" }]);
  assert.equal(to24("12:00 p.m."), "12:00"); assert.equal(to24("12:15 a.m."), "00:15"); assert.equal(to24("TBD"), null);
  assert.equal(isVoter("President John Doe", 2026), null); // unknown, not guessed
});
test("fed: blackout = second Saturday before → day after meeting", () => {
  const b = blackout("2026-10-27", "2026-10-28");
  assert.deepEqual([b.from, b.to], ["2026-10-17", "2026-10-29"]);
  assert.ok(inBlackout("2026-10-20", [b])); assert.equal(inBlackout("2026-10-29", [b]), null); assert.equal(inBlackout("2026-10-16", [b]), null);
  const L = renderFedSpeakers(parseFedCalendar(FED).speeches, [b], "2026-10-15", 14, "test").join("\n");
  assert.match(L, /静默期 2026-10-17/); assert.match(L, /地区联储主席.*未覆盖/);
});
