import { test } from "node:test";
import assert from "node:assert/strict";
import { BANKS, datesIn, scanOfficial, parseSecondaryWeek, secondaryTopic, hasDates } from "../src/ingest/fedRegional.ts";
import { mergeSpeeches, blackout, renderFedSpeakers, type FedSpeech } from "../src/ingest/fedSpeakers.ts";

test("12 banks; 2026 voters = NY, Cleveland, Philadelphia, Dallas, Minneapolis", () => {
  assert.equal(BANKS.length, 12);
  assert.deepEqual(BANKS.filter((b) => b.voter2026).map((b) => b.bank).sort(), ["Cleveland", "Dallas", "Minneapolis", "New York", "Philadelphia"]);
});
test("datesIn handles common formats", () => {
  assert.deepEqual(datesIn("Oct. 16, 2026 and October 30, 2026; 11/2/2026; 2026-11-05"), ["2026-10-16", "2026-10-30", "2026-11-02", "2026-11-05"]);
});
test("official scan: needs window date + president name nearby; explicit ET time only", () => {
  const b = BANKS.find((x) => x.bank === "Dallas")!;
  const html = "<div><h3>Economic Outlook and Monetary Policy</h3><p>President Lorie K. Logan</p><p>Oct. 16, 2026 · 9:00 a.m. ET</p></div><div><p>Annual Report</p><p>Oct. 20, 2026</p></div>";
  const s = scanOfficial(html, b, "2026-10-15", "2026-10-29", "u");
  assert.equal(s.length, 1); assert.equal(s[0]!.date, "2026-10-16"); assert.equal(s[0]!.timeEt, "09:00"); assert.equal(s[0]!.voter, true); assert.equal(s[0]!.sourceKind, "official");
  assert.equal(scanOfficial(html, b, "2026-10-17", "2026-10-29", "u").length, 0);
  assert.equal(hasDates("<div>loading…</div>"), false);
});
test("secondary: UTC dateline → ET; Tentative rows skipped; topic from history row", () => {
  const w = `{"id":1,"ebaseId":913,"name":"US FOMC Member Hammack Speaks","x":0,"dateline":1792096200,"country":"US","currency":"USD","timeLabel":"3:30pm","y":1,"soloUrl":"\\/calendar\\/913-us-fomc-member-hammack-speaks"},{"id":2,"ebaseId":640,"name":"US Fed Monetary Policy Report","dateline":1792936800,"country":"US","timeLabel":"Tentative","soloUrl":"\\/calendar\\/640"}`;
  const r = parseSecondaryWeek(w);
  assert.equal(r.length, 1); assert.deepEqual([r[0]!.last, r[0]!.dateEt, r[0]!.timeEt], ["Hammack", "2026-10-15", "16:30"]);
  assert.match(secondaryTopic("<td>Oct 15, 2026</td><td>Due to speak at the Women's Trading Network</td>", "2026-10-15"), /^Due to speak/);
});
test("merge: board+secondary dedupe; blackout listing flagged suspicious", () => {
  const bo = [blackout("2026-10-27", "2026-10-28")];
  const sp: FedSpeech[] = [
    { date: "2026-10-15", timeEt: "23:30", kind: "discussion", speaker: "Kevin Warsh", role: "Chairman", voter: true, topic: "IMF", location: "", source: "board", sourceKind: "board" },
    { date: "2026-10-15", timeEt: "23:30", kind: "speech", speaker: "Warsh", role: "Board", voter: true, topic: "", location: "", source: "sec", sourceKind: "secondary" },
    { date: "2026-10-21", timeEt: null, kind: "speech", speaker: "Lorie K. Logan", role: "Dallas Fed President", voter: true, topic: "", location: "", source: "off", sourceKind: "official" }];
  const m = mergeSpeeches(sp, bo);
  assert.equal(m.length, 2); assert.equal(m[0]!.sources!.length, 2); assert.equal(m[0]!.sourceKind, "board");
  assert.match(m[1]!.suspicious ?? "", /静默期/);
  const L = renderFedSpeakers(m, bo, "2026-10-15", 14, "t", [{ bank: "Atlanta", president: "x", voter2026: false, official: "unavailable（JS）", secondary: "unavailable（403）" }]).join("\n");
  assert.match(L, /可疑/); assert.match(L, /完全不可用：Atlanta/);
});
