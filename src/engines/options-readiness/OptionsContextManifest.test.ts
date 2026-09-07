import { readFileSync } from "node:fs";
import { buildOptionsContextManifest as build } from "./OptionsContextManifest";
import { reconstructOptionsContextV2, type ContextCutoffHistoriesV2 } from "./OptionsContextCutoffV2";
import { type ContextHistory } from "./OptionsContextCutoff";
import { readinessFingerprint } from "./OptionsReadinessEngine";
import { createDriverObservation } from "../options-drivers/OptionsDriverMonitorEngine";
import { treasuryUrl, type TreasuryInput } from "../options-treasury/TreasuryRealYieldEngine";
import { BTC_CONTEXT_URL, type BtcContextInput } from "../options-btc-context/BtcSpotContextEngine";
import { RELEASE_CALENDAR_URL, type ReleaseCalendarInput } from "../options-release-calendar/BlsReleaseCalendarEngine";
import { FOMC_CALENDAR_URL, type FomcCalendarInput } from "../options-fomc-calendar/FomcCalendarEngine";

const early = "2026-09-07T04:00:01.000Z", cutoff = "2026-09-07T04:30:00.000Z", later = "2026-09-07T05:00:00.000Z", checked = "2026-09-07T06:00:00.000Z";
const available = <T>(payload: T): ContextHistory<T> => ({ state: "AVAILABLE", checkedAt: checked, payload, errorCode: null });
const observation = (observedAt = early) => createDriverObservation({ sourceId: "fed", itemId: "manifest-1", headline: "Federal Reserve monetary policy rates decision", link: "https://www.federalreserve.gov/", publishedAt: "2026-09-06T12:00:00.000Z", observedAt, origin: "PUBLIC_FEED" });
const health = (observedAt = early) => ({ sourceId: "fed", status: "OK" as const, observedAt, itemsReceived: 1, truncated: false, diagnostic: null });
const treasury = (receivedAt = early): TreasuryInput => ({ requestedAt: receivedAt, receivedAt, url: treasuryUrl(receivedAt), sourceText: readFileSync("fixtures/options-treasury/real-yields.synthetic.xml", "utf8"), errorCode: null });
const btc = (receivedAt = early): BtcContextInput => ({ requestedAt: receivedAt, receivedAt, url: BTC_CONTEXT_URL, sourceText: readFileSync("fixtures/options-btc-context/book.synthetic.json", "utf8"), errorCode: null });
const bls = (receivedAt = early): ReleaseCalendarInput => ({ requestedAt: receivedAt, receivedAt, url: RELEASE_CALENDAR_URL, sourceText: readFileSync("fixtures/options-release-calendar/calendar.synthetic.ics", "utf8"), errorCode: null });
const fomc = (receivedAt = early): FomcCalendarInput => ({ requestedAt: receivedAt, receivedAt, url: FOMC_CALENDAR_URL, sourceText: readFileSync("fixtures/options-fomc-calendar/calendar.synthetic.html", "utf8"), errorCode: null });
function histories(): ContextCutoffHistoriesV2 { return { headlines: available({ observations: [observation()], health: [health()] }), treasury: available([treasury()]), btc: available([btc()]), blsCalendar: available([bls()]), fomcCalendar: available([fomc()]) }; }
const run = (h = histories(), end = checked) => build(h, cutoff, end);
const eq = (a: unknown, b: unknown) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw Error(`Expected ${JSON.stringify(b)}; received ${JSON.stringify(a)}`); };
const ok = (a: unknown) => { if (!a) throw Error("Expected truthy value"); };
let passed = 0;
function test(name: string, fn: () => void) { fn(); passed++; console.log(`PASS ${name}`); }

test("exact source members preserve original v2 output and hashes", () => {
  const h = histories(), r = run(h);
  eq(r.reconstruction, reconstructOptionsContextV2(h, cutoff, checked));
  eq(r.manifest.contextSha256, r.reconstruction.contextSha256); eq(r.manifest.memberCount, 6);
  eq(r.manifest.components.map(c => c.members.length), [2, 1, 1, 1, 1]);
  for (const c of r.manifest.components) { eq(c.selectedPrefixSha256, r.reconstruction.context.components[c.source].selectedPrefixSha256); eq(c.earliestKnownAt, early); eq(c.latestKnownAt, early); }
  eq(r.manifest.components[1]!.members[0]!.recordSha256, readinessFingerprint(treasury()));
});
test("equal-clock duplicate retrievals remain distinct original indices", () => {
  const h = histories(); h.btc = available([btc(cutoff), btc(cutoff), btc(later)]);
  const c = run(h).manifest.components[2]!;
  eq(c.members.map(m => m.recordIndex), [0, 1]); eq(c.members[0]!.recordSha256, c.members[1]!.recordSha256);
  eq(c.members.map(m => m.clockBasis), ["receivedAt", "receivedAt"]); eq(c.latestKnownAt, cutoff);
});
test("headline categories and original indices survive null health and cutoff exclusion", () => {
  const h = histories(); h.headlines = available({ observations: [observation(cutoff), observation(later)], health: [{ ...health(), observedAt: null, status: "NOT_REFRESHED", itemsReceived: 0 }, health(cutoff), health(later)] });
  const c = run(h).manifest.components[0]!;
  eq(c.state, "AVAILABLE"); eq(c.members.map(m => [m.category, m.recordIndex, m.knownAt, m.clockBasis]), [["observation", 0, cutoff, "observedAt"], ["health", 1, cutoff, "observedAt"]]);
});
test("later discovery is excluded despite older publication and request clocks", () => {
  const h = histories(); h.headlines = available({ observations: [observation(later)], health: [] });
  h.treasury = available([{ ...treasury(later), requestedAt: early }]);
  const c = run(h).manifest.components;
  eq(c[0]!.members, []); eq(c[1]!.members, []); eq(c[1]!.earliestKnownAt, null);
});
test("one millisecond after cutoff is excluded for all retrieval sources", () => {
  const after = "2026-09-07T04:30:00.001Z", h = histories();
  h.treasury = available([treasury(cutoff), treasury(after)]); h.btc = available([btc(cutoff), btc(after)]);
  h.blsCalendar = available([bls(cutoff), bls(after)]); h.fomcCalendar = available([fomc(cutoff), fomc(after)]);
  for (const c of run(h).manifest.components.slice(1)) eq(c.members.map(m => m.knownAt), [cutoff]);
});
test("later valid appends and construction clocks preserve earlier manifest", () => {
  const a = run(), h = histories();
  h.headlines = available({ observations: [observation(), observation(later)], health: [health(), health(later)] });
  h.treasury = available([treasury(), treasury(later)]); h.btc = available([btc(), btc(later)]);
  h.blsCalendar = available([bls(), bls(later)]); h.fomcCalendar = available([fomc(), fomc(later)]);
  const b = run(h, "2026-09-07T07:00:00.000Z"); eq(a.manifestSha256, b.manifestSha256); ok(a.artifactSha256 !== b.artifactSha256);
});
test("corrupt later source history blocks all its members and sanitizes diagnostics", () => {
  const h = histories(); h.fomcCalendar = available([fomc(), { ...fomc(later), url: "PRIVATE_INVALID_SOURCE" }]);
  const r = run(h), c = r.manifest.components[4]!;
  eq(c.state, "BLOCKED"); eq(c.errorCode, "HISTORY_VALIDATION_FAILED"); eq(c.members, []); eq(c.selectedPrefixSha256, null);
  eq(r.manifest.components[1]!.state, "AVAILABLE"); ok(!JSON.stringify(r).includes("PRIVATE_INVALID_SOURCE"));
});
test("missing blocked and available-empty stores retain distinct semantics", () => {
  const h = histories(); h.treasury = { state: "MISSING", checkedAt: checked, payload: null, errorCode: "STORE_MISSING" };
  h.btc = { state: "BLOCKED", checkedAt: checked, payload: null, errorCode: "STORE_BUSY" }; h.blsCalendar = available([]);
  const c = run(h).manifest.components; eq(c.slice(1, 4).map(x => x.state), ["MISSING", "BLOCKED", "AVAILABLE"]);
  for (const x of c.slice(1, 4)) { eq(x.members, []); eq(x.earliestKnownAt, null); eq(x.latestKnownAt, null); }
  eq(c[1]!.selectedPrefixSha256, null); eq(c[3]!.selectedPrefixSha256, readinessFingerprint([]));
});
test("failed retrieval remains a member with its actual receipt", () => {
  const h = histories(); h.btc = available([btc(), { ...btc(cutoff), sourceText: null, errorCode: "NETWORK_FAILED" }]);
  const r = run(h); eq(r.manifest.components[2]!.members.length, 2); eq(r.reconstruction.context.components.btc.report!.latestRetrieval!.status, "FAILED");
});
test("original history limits are retained without truncating oversized sources", () => {
  const h = histories(); h.fomcCalendar = available(Array.from({ length: 367 }, () => fomc()));
  const c = run(h).manifest.components[4]!; eq(c.state, "BLOCKED"); eq(c.members, []);
});
test("invalid outer clocks and shapes cannot acquire a manifest", () => {
  for (const fn of [() => build(histories(), later, early), () => run({ ...histories(), extra: true } as ContextCutoffHistoriesV2)]) {
    let error: unknown; try { fn(); } catch (e) { error = e; } ok(error instanceof Error);
  }
});
test("member content changes alter identity and manifest fingerprint", () => {
  const a = run(), h = histories(); h.btc = available([{ ...btc(), sourceText: null, errorCode: "NETWORK_FAILED" }]);
  const b = run(h); ok(a.manifest.components[2]!.members[0]!.recordSha256 !== b.manifest.components[2]!.members[0]!.recordSha256); ok(a.manifestSha256 !== b.manifestSha256);
});
test("deterministic frozen output does not mutate input or grant capture or trading authority", () => {
  const h = histories(), before = JSON.stringify(h), r = run(h); eq(run(h), r); eq(JSON.stringify(h), before);
  const { artifactSha256, ...body } = r; eq(artifactSha256, readinessFingerprint(body)); eq(r.manifestSha256, readinessFingerprint(r.manifest));
  ok(Object.isFrozen(r.manifest.components[0]!.members[0])); ok(!Object.isFrozen(h));
  eq(r.manifest.prospectiveCaptureReceipt, false); eq(r.manifest.payloadSavedAt, null); eq(r.manifest.historicalDecisionProven, false);
  eq(r.manifest.globalKnowledgeCoverageComplete, false); eq(r.manifest.executionAllowed, false); eq(r.manifest.replayAllowed, false);
});
console.log(`${passed}/${passed} tests passed.`);
