import { test } from "node:test";
import assert from "node:assert/strict";
import { buildFixedWatchlist, relVolume, FW_EXTRA_SERIES, DEADCAT_IDS, WATCH_GROUPS, WATCH_HEAD, FLOW_HEAD, type VolBar } from "../src/macro/fixedWatchlist.ts";
import { PM_SERIES } from "../src/macro/premarket.ts";
import { DEADCAT_SERIES } from "../src/macro/deadcat.ts";
import type { Obs } from "../src/macro/fetch.ts";

// two daily closes: 100 → 100 × (1 + pct/100)
const s = (pct: number): Obs[] => [{ t: "2026-11-04", v: 100 }, { t: "2026-11-05", v: 100 * (1 + pct / 100) }];
const D = (m: Record<string, number>) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, s(v)]));
const md = (r: ReturnType<typeof buildFixedWatchlist>) => [...r.watchLines, ...r.flowLines].join("\n");

test("fixed watchlist: empty bars → both headings still render with 数据不足, no conclusion invented", () => {
  const r = buildFixedWatchlist({});
  const m = md(r);
  assert.equal(r.watchLines[0], WATCH_HEAD); assert.equal(r.flowLines[0], FLOW_HEAD);
  assert.match(m, /数据不足/); assert.match(m, /成交量确认：数据不足/);
  assert.equal(r.label, "数据不足");
  for (const sym of WATCH_GROUPS.flatMap((g) => g.syms)) assert.match(m, new RegExp(`${sym} 数据不足`));
});

test("fixed watchlist: SMH/XLY lead, RSP/IWM ≥ SPY, HYG beats TLT/GLD → 偏进攻", () => {
  const r = buildFixedWatchlist(D({ SPY: 1, RSP: 1.6, IWM: 2, SMH: 3, XLE: 0.5, XLF: 1.2, XLU: -0.5, XLY: 1.5, XLP: -0.3, HYG: 0.4, TLT: -0.8, GLD: -0.5 }));
  assert.equal(r.label, "偏进攻");
  assert.match(md(r), /资金流：偏进攻\*\* — 依据/);
  assert.match(md(r), /SMH \+3\.00% > XLF/);
});

test("fixed watchlist: XLU/XLP/TLT/GLD lead, IWM/RSP lag, HYG lags → 偏防守", () => {
  const r = buildFixedWatchlist(D({ SPY: -0.5, RSP: -1, IWM: -1.8, SMH: -2.5, XLE: -0.2, XLF: -1, XLU: 1, XLY: -1.2, XLP: 0.6, HYG: -0.4, TLT: 0.9, GLD: 1.1 }));
  assert.equal(r.label, "偏防守");
  assert.match(md(r), /资金流：偏防守/);
});

test("fixed watchlist: conflicting votes → 混乱并列", () => {
  // growth leads but breadth narrows and havens win
  const r = buildFixedWatchlist(D({ SPY: 1, RSP: 0, IWM: -0.5, SMH: 2, XLE: 0, XLF: 0.3, XLU: -0.5, XLY: 1, XLP: 0, HYG: 0, TLT: 1, GLD: 1.5 }));
  assert.equal(r.label, "混乱并列");
  assert.match(md(r), /资金流：混乱并列/);
});

test("fixed watchlist: no invented flow dollar figures", () => {
  for (const d of [{}, D({ SPY: 1, RSP: 1.6, IWM: 2, SMH: 3, XLU: -0.5, XLY: 1.5, XLP: -0.3, HYG: 0.4, TLT: -0.8, GLD: -0.5 })]) {
    const m = md(buildFixedWatchlist(d));
    for (const bad of [/\$\s?\d/, /\$bn/i, /\d+\s?(bn|billion)/i, /亿美元/, /净流入/, /净流出/]) assert.doesNotMatch(m, bad);
  }
});

test("fixed watchlist: aliases map to brief series (VIX/DXY/WTI/BRENT); extra series skip PM/dead-cat ids", () => {
  const r = buildFixedWatchlist({ VIX: s(5), DXY: s(-0.2), WTI: s(2), BRENT: s(1.5) });
  assert.equal(r.chg.VIX!.toFixed(2), "5.00"); assert.equal(r.chg.CL!.toFixed(2), "2.00"); assert.equal(r.chg.BZ!.toFixed(2), "1.50");
  assert.deepEqual([...DEADCAT_IDS].sort(), DEADCAT_SERIES.map((x) => x.id).sort(), "DEADCAT_IDS in sync with DEADCAT_SERIES");
  const ids = new Set([...PM_SERIES, ...DEADCAT_SERIES].map((x) => x.id)), extra = FW_EXTRA_SERIES.map((x) => x.id);
  for (const id of extra) assert.ok(!ids.has(id), id);
  for (const id of ["VIX", "DXY", "CL", "BZ", "SPY", "SMH", "HYG", "EWY"]) assert.ok(!extra.includes(id), id);
  for (const id of ["IWM", "TLT", "GLD", "XLF", "XLY", "KRE"]) assert.ok(extra.includes(id), id);
  assert.ok(FW_EXTRA_SERIES.every((x) => x.provider === "yahoo"));
});

test("fixed watchlist: volume confirmation from OHLCV only (放量涨 / 缩量反弹), short history → 数据不足", () => {
  const bars = (lastV: number, up: boolean): VolBar[] => [...Array.from({ length: 22 }, (_, i) => ({ t: `2026-10-${String(i + 1).padStart(2, "0")}`, c: 100, v: 1e6 })), { t: "2026-11-05", c: up ? 101 : 99, v: lastV }];
  assert.equal(relVolume(bars(1e6, true)!.slice(0, 5)), null);
  assert.match(buildFixedWatchlist({}, { volume: { SPY: bars(1.5e6, true) } }).flowLines.join("\n"), /放量涨，更像真流入/);
  assert.match(buildFixedWatchlist({}, { volume: { SPY: bars(0.5e6, true) } }).flowLines.join("\n"), /缩量反弹，偏空头回补/);
  assert.match(buildFixedWatchlist({}, { aux: "SPY dealer GEX 为正" }).flowLines.join("\n"), /- 辅助：SPY dealer GEX 为正/);
});
