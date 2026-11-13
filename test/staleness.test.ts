import { test } from "node:test";
import assert from "node:assert/strict";
import { paperMark, stockSpot, chainFresh, markStaleLine, openPaper, type PriceSource } from "../src/options/paper.ts";
import { normalizedLegs, normalizeJournalLegs, type JournalEntry } from "../src/options/journal.ts";
import { buildPremarket, vixTerm, ztHint } from "../src/macro/premarket.ts";
import { buildFixedWatchlist } from "../src/macro/fixedWatchlist.ts";
import { expectedRateObs, isBondHoliday, quoteStamp } from "../src/macro/quoteMeta.ts";
import { ratesLines, DEFAULT_MANUAL } from "../src/macro/ratesRegime.ts";
import type { Chain } from "../src/options/chain.ts";
import type { Obs } from "../src/macro/fetch.ts";

const NOW = new Date("2026-11-13T12:30:00Z"); // Fri 07:30 ET premarket; last cash session 11-12
const E = (o: Partial<JournalEntry>): JournalEntry => ({ id: "J", symbol: "JETS", strategy: "stock_long", mode: "paper", kind: "practice", source: "mentor_shadow", openedAt: "2026-11-09T15:44:18Z", maxLoss: 49.28, underlyingAtEntry: 30.04,
  legs: [{ underlying: "JETS", type: "stock", strike: 30.04, qty: 32, premium: 30.04 }], ...o } as JournalEntry);
const staleChain = (contracts: Chain["contracts"] = []): Chain => ({ symbol: "JETS", underlyingPrice: 30.22, asOf: "2026-11-10T15:28:23Z", contracts });
const live = (price: number, at = "2026-11-12T21:00:00Z") => async () => ({ price, at });
const bars = (...xs: Array<[string, number]>) => async () => xs.map(([t, c]) => ({ t, c }));
const src = (q: Parameters<typeof stockSpot>[1], chains: Chain[] = []): PriceSource => ({ spot: (s) => stockSpot(s, q), chains });
const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 0.011, `${a} ≠ ${b}`);

// ── 1 paper mark ──
test("stockSpot: live quote vs latest daily bar, newer ET date wins; stale vs last US cash session", async () => {
  assert.deepEqual(await stockSpot("JETS", { live: live(29.04), daily: bars(["2026-11-12", 29.1]), now: NOW }), { price: 29.04, source: "yahoo-live", asOf: "2026-11-12T21:00:00Z", stale: false });
  assert.deepEqual(await stockSpot("JETS", { live: async () => { throw new Error("x"); }, daily: bars(["2026-11-11", 29.5], ["2026-11-12", 29.1]), now: NOW }), { price: 29.1, source: "yahoo-daily", asOf: "2026-11-12", stale: false });
  assert.equal((await stockSpot("JETS", { live: live(30, "2026-11-10T21:00:00Z"), daily: bars(["2026-11-12", 29.1]), now: NOW }))!.source, "yahoo-daily", "older live loses to a newer daily bar");
  assert.equal(await stockSpot("JETS", { now: NOW }), null);
});

test("BUG JETS 11/13: stock leg ignored the stale chain underlyingPrice 30.22 (11/10) — now uses the injected fresh price with provenance", async () => {
  const m = await paperMark(E({}), src({ live: live(29.04), daily: bars(["2026-11-12", 29.1]), now: NOW }, [staleChain()]), NOW);
  close(m.value, 32 * 29.04); close(m.pnl, -32); assert.equal(m.spot, 29.04);
  assert.match(m.sources[0]!, /^JETS stock yahoo-live 29\.04 @2026-11-12T21:00:00Z$/);
  assert.doesNotMatch(m.sources.join(), /30\.22/);
  assert.equal(m.spotSource, "yahoo-live"); assert.equal(m.spotAsOf, "2026-11-12T21:00:00Z"); assert.equal(m.stale, false);
  assert.equal(markStaleLine(E({}), m, NOW), null);
});

test("stale price (latest daily 11/10 on 11/13) → stale=true, ⚠️stale source and CLI warning line", async () => {
  const m = await paperMark(E({}), src({ daily: bars(["2026-11-09", 30.2], ["2026-11-10", 30.22]), now: NOW }), NOW);
  assert.equal(m.stale, true); assert.equal(m.spotSource, "yahoo-daily"); assert.equal(m.spotAsOf, "2026-11-10");
  assert.match(m.sources[0]!, /JETS stock yahoo-daily 30\.22 @2026-11-10 ⚠️stale/);
  assert.match(markStaleLine(E({}), m, NOW)!, /^⚠️ J JETS: 价格过期.*2026-11-12.*yahoo-daily asOf=2026-11-10/);
});

test("option leg Black-Scholes spot: stale chain underlyingPrice ignored; a fresh chain may supply it", async () => {
  const put = E({ strategy: "long_put", legs: [{ underlying: "JETS", type: "put", strike: 29, qty: 1, premium: 0.8, expiration: "2026-12-18", iv: 0.4 }] });
  const q = { live: live(29.04), now: NOW };
  const a = await paperMark(put, src(q, [staleChain()]), NOW);
  assert.match(a.sources[0]!, /BS估算\(yahoo-live 29\.04/); assert.doesNotMatch(a.sources[0]!, /30\.22/); assert.equal(a.spot, 29.04);
  assert.equal(chainFresh(staleChain(), NOW), false);
  const fresh = { ...staleChain(), underlyingPrice: 29.2, asOf: "2026-11-12T20:30:00Z", source: "robinhood" };
  assert.equal(chainFresh(fresh, NOW), true);
  const b = await paperMark(put, src(q, [fresh]), NOW);
  assert.match(b.sources[0]!, /BS估算\(chain\(robinhood\) 29\.2/); assert.equal(b.spotSource, "chain(robinhood)");
  // a contract mark from a stale chain is still used but flagged stale
  const c = await paperMark(put, src(q, [staleChain([{ expiration: "2026-12-18", strike: 29, type: "put", bid: null, ask: null, mark: 0.9, iv: null, delta: null, gamma: null, theta: null, vega: null } as never])]), NOW);
  assert.match(c.sources[0]!, /robinhood 0\.9 @2026-11-10T15:28:23Z ⚠️stale/); assert.equal(c.stale, true);
});

test("BUG WEAT: leg-less equity (legs null, qty 50, entry 22.17) marked value 0 / sources [] — now one stock leg, qty × price", async () => {
  const weat = E({ id: "macro-weat-stock-long-2026-11-11", symbol: "WEAT", legs: null as never, qty: 50, entry: 22.17, maxLoss: null as never });
  assert.deepEqual(normalizedLegs(weat), [{ underlying: "WEAT", type: "stock", strike: 22.17, qty: 50, premium: 22.17 }]);
  const m = await paperMark(weat, src({ live: live(22.5), now: NOW }), NOW);
  close(m.value, 1125); close(m.pnl, 16.5); assert.match(m.sources[0]!, /^WEAT stock yahoo-live 22\.5/);
  const short = await paperMark({ ...weat, strategy: "stock_short", legs: [] }, src({ live: live(22.5), now: NOW }), NOW);
  close(short.value, -1125); close(short.pnl, -16.5);
  // the journal is not migrated: legs stay null / [] on load
  const j = [weat, { ...weat, id: "w2", legs: [] }];
  assert.deepEqual(normalizeJournalLegs(j), []); assert.equal(j[0]!.legs, null); assert.deepEqual(j[1]!.legs, []);
});

test("closed legs:[] entries (qty/entry null) stay leg-less, are not open, and are never marked as $0", async () => {
  const old = E({ id: "jets-stock-long-2026-11-02-paper", legs: [], qty: null, entry: null, closedAt: "2026-11-09T15:43:55Z", pnl: 29.85 });
  assert.deepEqual(normalizedLegs(old), []);
  assert.deepEqual(openPaper({ capital: 5000, entries: [old] }), []);
  await assert.rejects(paperMark({ ...old, closedAt: undefined }, src({ live: live(29), now: NOW }), NOW), /no legs/);
  assert.deepEqual(normalizeJournalLegs([old]), []); assert.deepEqual(old.legs, []);
});

// ── 2 FRED 2Y lag ──
const ser = (xs: Array<[string, number]>): Obs[] => xs.map(([t, v]) => ({ t, v }));
const DGS2 = ser([["2026-11-04", 4.52], ["2026-11-05", 4.54], ["2026-11-06", 4.55], ["2026-11-09", 4.56], ["2026-11-10", 4.73]]);
const line2 = (md: string) => md.split("\n").find((l) => l.startsWith("- 2Y:"))!;

test("expected FRED daily-rate obs: T-1 bond session, Veterans/Columbus Day skipped; weekly FRED ids keep the loose rule", () => {
  assert.equal(expectedRateObs(NOW), "2026-11-12");
  assert.equal(expectedRateObs(new Date("2026-11-12T12:30:00Z")), "2026-11-10", "11-11 Veterans Day: no bond obs");
  assert.equal(expectedRateObs(new Date("2026-10-13T12:30:00Z")), "2026-10-09", "10-12 Columbus Day");
  assert.ok(isBondHoliday("2026-11-11") && isBondHoliday("2026-10-12") && !isBondHoliday("2026-11-10"));
  assert.equal(quoteStamp("UST2Y", DGS2, NOW).stale, true);
  assert.equal(quoteStamp("UST2Y", DGS2, new Date("2026-11-12T12:30:00Z")).stale, false);
  assert.equal(quoteStamp("HYOAS", ser([["2026-11-10", 2.9]]), NOW).stale, false, "HYOAS keeps lastUsCashSession − 5d");
});

test("BUG 2Y 11/13: DGS2 last obs 11/10 printed its 11/09→11/10 change as 1日 — now asOf/stale and 变动(滞后)", () => {
  const data: Record<string, Obs[]> = { UST2Y: DGS2, DXY: ser([["2026-11-11", 99], ["2026-11-12", 99.5]]), GOLD: ser([["2026-11-11", 100], ["2026-11-12", 99]]) };
  const r = buildPremarket({ now: NOW, data });
  const l = line2(r.md);
  assert.match(l, /4\.730% · 变动\(11\/09→11\/10\) \+17\.0bp（滞后，非最新一日） · 5日\(截至11\/10\)/);
  assert.match(l, /source=fred asOf=2026-11-10 session=FRED发布 stale=true；应有 2026-11-12 收盘/);
  assert.doesNotMatch(l, /1日/);
  // DXY cross-asset confirmation must not count a stale 2Y move as today's
  const dxy = r.md.split("\n").find((x) => x.startsWith("- DXY"))!;
  assert.doesNotMatch(dxy, /✅|、2Y|仅 2Y/); assert.match(dxy, /2Y asOf 2026-11-10 滞后，不计入确认/);
  assert.match(r.md, /2Y 4\.73%（asOf 2026-11-10，滞后） − EFFR/);
});

test("fresh 2Y (obs 11/12 on 11/13) still prints 1日 and counts for DXY confirmation", () => {
  const y2 = [...DGS2, { t: "2026-11-12", v: 4.86 }];
  const r = buildPremarket({ now: NOW, data: { UST2Y: y2, DXY: ser([["2026-11-11", 99], ["2026-11-12", 99.5]]), GOLD: ser([["2026-11-11", 100], ["2026-11-12", 99]]) } });
  assert.match(line2(r.md), /4\.860% · 1日 \+13\.0bp · 5日 .*asOf=2026-11-12 .*stale=false/);
  assert.match(r.md, /跨资产确认: ✅ 黄金、2Y/);
});

test("ZT=F hint under 2Y: present when injected (direction only, never a yield number), absent when missing", () => {
  const zt = { price: 104.2, prevClose: 104.1, at: "2026-11-13T12:25:00Z" };
  assert.match(ztHint(zt, NOW)!, /ZT=F 实时 104\.2000 \(\+0\.096% vs prev close, 2026-11-13 07:25 ET\) → 隐含 2Y 收益率方向 下（仅提示，官方口径仍为 FRED 收盘）/);
  assert.match(ztHint({ ...zt, price: 104.0 }, NOW)!, /方向 上/);
  assert.match(ztHint({ ...zt, at: "2026-11-12T21:00:00Z" }, NOW)!, /ZT=F 最后报价/);
  assert.equal(ztHint(null, NOW), null); assert.equal(ztHint({ ...zt, prevClose: null }, NOW), null);
  const md = (z: typeof zt | null) => buildPremarket({ now: NOW, data: { UST2Y: DGS2 }, zt: z }).md.split("\n");
  const a = md(zt); assert.match(a[a.findIndex((x) => x.startsWith("- 2Y:")) + 1]!, /^  - ZT=F 实时/);
  assert.ok(!md(null).some((x) => /ZT=F/.test(x)));
});

test("2Y vs 30Y linkage stamps both asOfs and says 日期错位 when they differ", () => {
  const y30 = ser([["2026-11-09", 4.9], ["2026-11-10", 4.95], ["2026-11-11", 4.95], ["2026-11-12", 5.0]]);
  const out = ratesLines({ y2: DGS2, y30, oilCode: "CLZ26", manual: DEFAULT_MANUAL }).join("\n");
  assert.match(out, /2Y vs 30Y 联动（2026-11-10）：2Y \+17\.0bp · 30Y \+5\.0bp .*2Y asOf 2026-11-10 · 30Y asOf 2026-11-12，日期错位：按共同日期 2026-11-10 计算/);
  const same = ratesLines({ y2: [...DGS2, { t: "2026-11-12", v: 4.86 }], y30, oilCode: "CLZ26", manual: DEFAULT_MANUAL }).join("\n");
  assert.match(same, /2Y asOf 2026-11-12 · 30Y asOf 2026-11-12）/); assert.doesNotMatch(same, /错位/);
});

// ── 3 VIX / VIX3M ──
const pt = (pct: number): Obs[] => [{ t: "2026-11-11", v: 100 }, { t: "2026-11-12", v: 100 * (1 + pct / 100) }];
const OFF = Object.fromEntries(Object.entries({ SPY: 1, RSP: 1.6, IWM: 2, SMH: 3, XLE: 0.5, XLF: 1.2, XLU: -0.5, XLY: 1.5, XLP: -0.3, HYG: 0.4, TLT: -0.8, GLD: -0.5 }).map(([k, v]) => [k, pt(v)]));
const flows = (d: Record<string, Obs[]>) => buildFixedWatchlist({ ...OFF, ...d }, { now: NOW });

test("premarket VIX live-dated 11/13 + VIX3M prior close 11/12 → common-close ratio, live VIX shown separately, no false 数据不足", () => {
  const vix = ser([["2026-11-11", 18], ["2026-11-12", 20], ["2026-11-13", 22]]), v3 = ser([["2026-11-11", 19], ["2026-11-12", 19.5]]);
  const t = vixTerm(vix, v3, NOW);
  assert.deepEqual([t.date, t.common, t.usable, Number(t.ratio!.toFixed(3))], ["2026-11-12", true, true, 1.026]);
  const f = flows({ VIX: vix, VIX3M: v3 }), text = f.flowLines.join("\n");
  assert.equal(f.label, "混乱并列");
  assert.match(text, /VIX 倒挂 最近共同收盘 2026-11-12 VIX\/VIX3M 比值 1\.026（另列 实时 VIX 22\.00 \(asOf 2026-11-13\)/);
  assert.match(text, /偏进攻降为混乱并列（VIX）/);
  assert.doesNotMatch(text, /VIX\/VIX3M[^；]*数据不足/);
  const pm = buildPremarket({ now: NOW, data: { VIX: vix, VIX3M: v3 } });
  const al = pm.alarms.find((a) => a.kind === "VIX_BACKWARDATION")!;
  assert.match(al.title, /最近共同收盘 2026-11-12 VIX\/VIX3M 1\.026/); assert.equal(al.observedOn, "2026-11-12");
  assert.match(pm.md, /最近共同收盘 2026-11-12 VIX\/VIX3M 比值 1\.026/);
  // common close not inverted → 未倒挂, evidence still says 最近共同收盘
  const calm = flows({ VIX: vix, VIX3M: ser([["2026-11-11", 19], ["2026-11-12", 22]]) }).flowLines.join("\n");
  assert.match(calm, /VIX 未倒挂 最近共同收盘 2026-11-12 VIX\/VIX3M 比值 0\.909.*不触发降级/);
});

test("VIX/VIX3M both stale (common close older than the last cash session) → still 数据不足, no alarm, no downgrade", () => {
  const vix = ser([["2026-11-09", 25], ["2026-11-10", 26]]), v3 = ser([["2026-11-06", 20], ["2026-11-09", 21]]);
  assert.equal(vixTerm(vix, v3, NOW).usable, false);
  const f = flows({ VIX: vix, VIX3M: v3 });
  assert.equal(f.label, "偏进攻");
  assert.match(f.flowLines.join("\n"), /VIX\/VIX3M 日期错位（stale：最近共同收盘 2026-11-09 早于上一美股收盘 2026-11-12.*数据不足，不触发降级/);
  assert.ok(!buildPremarket({ now: NOW, data: { VIX: vix, VIX3M: v3 } }).alarms.some((a) => a.kind === "VIX_BACKWARDATION"));
  // no common date at all
  assert.equal(vixTerm(ser([["2026-11-12", 25]]), ser([["2026-11-11", 20]]), NOW).ratio, null);
});
