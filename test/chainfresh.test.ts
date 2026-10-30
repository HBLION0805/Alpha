import { test } from "node:test";
import assert from "node:assert/strict";
import { chainRefreshSymbols, chainFile, asOfEtDate, tradingDaysSince, chainFreshness, dropExpired, prepareChain, staleLabel } from "../src/options/freshness.ts";
import { buildVolumeReport } from "../src/macro/volume.ts";
import type { Chain, Contract } from "../src/options/chain.ts";

const K = (expiration: string, strike: number, type: "call" | "put", volume = 0, openInterest = 0): Contract =>
  ({ expiration, strike, type, bid: 1, ask: 1.1, mark: 1.05, iv: 0.3, delta: type === "call" ? 0.5 : -0.5, gamma: 0, theta: 0, vega: 0, volume, openInterest });
// QA C7: AVGO chain saved 10-22, still read on Fri 10-30; the 10-23 contracts had expired
const avgo: Chain = { symbol: "AVGO", underlyingPrice: 350, asOf: "2026-10-22T19:55:00Z", contracts: [
  K("2026-10-23", 350, "call", 9000, 100), K("2026-10-23", 340, "put", 800, 900), K("2026-10-30", 360, "call", 50, 10), K("2026-11-20", 400, "call", 6000, 1000)] };
const NOW = new Date("2026-10-30T13:00:00Z"); // 09:00 ET

test("refresh list: SPY/QQQ/IWM + optionable watchlist symbols, deduped, no hardcoded names", () => {
  assert.deepEqual(chainRefreshSymbols(["nvda", "AVGO", "^VIX", "BTC-USD", "CL=F", "SPY", " jpm ", "BRK.B"]), ["SPY", "QQQ", "IWM", "NVDA", "AVGO", "JPM", "BRK.B"]);
  assert.deepEqual(chainRefreshSymbols([]), ["SPY", "QQQ", "IWM"]);
  assert.equal(chainFile("AVGO"), "data/in/avgo-chain.json");
});

test("asOf → ET date; trading days skip weekends and NYSE holidays", () => {
  assert.equal(asOfEtDate("2026-10-22"), "2026-10-22");
  assert.equal(asOfEtDate("2026-10-23T02:00:00Z"), "2026-10-22", "22:00 ET is still the 22nd");
  assert.equal(tradingDaysSince("2026-10-22", "2026-10-30"), 6);
  assert.equal(tradingDaysSince("2026-10-30", "2026-11-02"), 1, "Fri → Mon");
  assert.equal(tradingDaysSince("2026-11-25", "2026-11-27"), 1, "Thanksgiving 11-26 is closed");
  assert.equal(tradingDaysSince("2026-10-30", "2026-10-30"), 0);
});

test("stale = more than 1 trading day old", () => {
  assert.deepEqual(chainFreshness(avgo.asOf, "2026-10-30"), { asOfDate: "2026-10-22", today: "2026-10-30", tradingDaysOld: 6, stale: true });
  assert.equal(chainFreshness("2026-10-29T20:00:00Z", "2026-10-30").stale, false, "prior session is fine premarket");
  assert.equal(chainFreshness("2026-10-28T20:00:00Z", "2026-10-30").stale, true);
  assert.equal(chainFreshness("2026-10-30T20:00:00Z", "2026-11-01").stale, false, "Friday chain on Sunday");
  assert.equal(staleLabel({ ...chainFreshness(avgo.asOf, "2026-10-30"), droppedExpired: 0 }), "过时（asOf 2026-10-22，6 个交易日前）");
  assert.equal(staleLabel({ ...chainFreshness("2026-10-29", "2026-10-30"), droppedExpired: 0 }), "");
  assert.equal(staleLabel(undefined), "");
});

test("expired contracts dropped (before today ET); today's expiry kept; prepareChain is idempotent", () => {
  assert.deepEqual(dropExpired(avgo, "2026-10-30").contracts.map((c) => c.expiration), ["2026-10-30", "2026-11-20"]);
  const p = prepareChain(avgo, NOW);
  assert.equal(p.contracts.length, 2); assert.equal(p.freshness.droppedExpired, 2); assert.ok(p.freshness.stale);
  const again = prepareChain(p, NOW);
  assert.equal(again.contracts.length, 2); assert.equal(again.freshness.droppedExpired, 2);
  assert.equal(avgo.contracts.length, 4, "input not mutated");
  assert.equal(JSON.parse(JSON.stringify(p)).freshness.stale, true, "freshness survives into JSON");
});

test("volume report: no expired contracts, 过时 + asOf on every chain line, stale chain raises no alarm", () => {
  const r = buildVolumeReport({ now: NOW, bars: {}, chains: [avgo] });
  assert.doesNotMatch(r.md, /2026-10-23/);
  assert.match(r.md, /### AVGO（链时间 2026-10-22T19:55:00Z · 过时（asOf 2026-10-22，6 个交易日前））/);
  assert.match(r.md, /- AVGO 认购量 .*Put\/Call.*过时（asOf 2026-10-22/);
  assert.match(r.md, /已剔除 2 个已到期（早于 2026-10-30）的合约/);
  const anomaly = r.md.split("\n").find((l) => /AVGO 2026-11-20/.test(l))!;
  assert.match(anomaly, /^- 🚨 AVGO 2026-11-20.*过时/, "brief copies '- 🚨' lines, so the label travels with it");
  assert.equal(r.strong.length, 0);
  assert.deepEqual(r.chains, [{ symbol: "AVGO", asOf: avgo.asOf, asOfDate: "2026-10-22", today: "2026-10-30", tradingDaysOld: 6, stale: true, droppedExpired: 2 }]);
  const fresh = buildVolumeReport({ now: NOW, bars: {}, chains: [{ ...avgo, asOf: "2026-10-29T20:00:00Z" }] });
  assert.doesNotMatch(fresh.md, /过时|2026-10-23/);
  assert.deepEqual(fresh.strong.map((s) => s.title), ["AVGO 2026-11-20 400C 量/OI 6x"]);
});
