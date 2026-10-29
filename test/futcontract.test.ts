/** Same-contract changes for every =F futures series (src/macro/futContract.ts). Synthetic roll data modelled on ES Dec→Mar; no network. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseContract, isFutures, futSameChange, contractSeries, mergeFrontState, futNote, OFFLINE_FUT_NOTE, type FrontState } from "../src/macro/futContract.ts";
import { buildPremarket, PM_SERIES } from "../src/macro/premarket.ts";
import { DEADCAT_SERIES } from "../src/macro/deadcat.ts";
import type { Obs } from "../src/macro/fetch.ts";

const days = (n: number, end = "2026-12-14") => { const out: string[] = []; let d = new Date(end + "T12:00:00Z");
  while (out.length < n) { if (d.getUTCDay() % 6) out.unshift(d.toISOString().slice(0, 10)); d = new Date(d.getTime() - 864e5); } return out; };
const D = days(30), today = D.at(-1)!;
const flat = (v: number, last?: number): Obs[] => D.map((t, i) => ({ t, v: i === D.length - 1 && last != null ? last : v }));
// SYNTHETIC: ESZ26 closes 7783.25 yesterday; Yahoo ES=F rolls to ESH27 (contango ≈ +1.1%) which itself is −0.06% today
const ESZ = flat(7783.25).slice(0, -1), ESH = flat(7870, 7865);
const ES_CONT = [...ESZ, { t: today, v: 7865 }]; // spliced: Dec closes, then Mar price
const q = (sym: string, price: number, prevClose: number | null, ret: string | null = sym) => ({ symbol: sym, returnedSymbol: ret, price, prevClose, at: `${today}T14:30:00Z` });
const STATE: FrontState = { ES: { contract: "ESZ26", since: "2026-09-12", from: "ESU26" } };
const es = (state: FrontState = STATE, k = q("ESH27.CME", 7865, 7870)) => futSameChange("ES", "ES=F", { underlyingSymbol: "ESH27.CME" }, k, { today, state });
const now = new Date(`${today}T13:00:00Z`);
const pm = (data: Record<string, Obs[]>, futNotes?: string[]) => buildPremarket({ now, data, calendar: [], earnings: null, headlines: [], futNotes });
const small = { NQ: flat(29900, 29930), RTY: flat(2840, 2843) };

test("parseContract: 1–4 letter roots, any exchange suffix", () => {
  for (const [s, code, root] of [["ESH27.CME", "ESH27", "ES"], ["RTYZ26.CME", "RTYZ26", "RTY"], ["EWFZ26.CME", "EWFZ26", "EWF"], ["ZTZ26.CBT", "ZTZ26", "ZT"], ["ZNZ26.CBT", "ZNZ26", "ZN"],
    ["HGZ26.CMX", "HGZ26", "HG"], ["NGZ26.NYM", "NGZ26", "NG"], ["GCZ26.CMX", "GCZ26", "GC"], ["SIZ26.CMX", "SIZ26", "SI"], ["YMZ26.CBT", "YMZ26", "YM"], ["BZF27.NYM", "BZF27", "BZ"]] as const)
    assert.deepEqual([parseContract(s)?.code, parseContract(s)?.root], [code, root], s);
  assert.equal(parseContract("ESH27.CME")!.month, "Mar 27");
  for (const bad of ["VX=F", "BZ.NYM", "ES=F", "SPY", null]) assert.equal(parseContract(bad), null, String(bad));
  assert.ok(isFutures("ES=F") && isFutures("RTY=F") && isFutures("EWF=F") && !isFutures("^VIX") && !isFutures("SPY") && !isFutures("CAD=X"));
});

test("audit: every =F series in PM_SERIES and DEADCAT_SERIES is picked up by the brief loop", () => {
  const ids = [...PM_SERIES, ...DEADCAT_SERIES].filter((d) => isFutures(d.ref)).map((d) => d.ref).sort();
  assert.deepEqual(ids, ["BZ=F", "CL=F", "ES=F", "EWF=F", "GC=F", "HG=F", "NQ=F", "RB=F", "RTY=F"]);
  const src = readFileSync(new URL("../src/cli/brief.ts", import.meta.url), "utf8");
  assert.match(src, /PM_SERIES\.filter\(\(d\) => d\.provider === "yahoo" && isFutures\(d\.ref\)\)/);
  assert.match(src, /DEADCAT_SERIES\.filter\(\(d\) => d\.provider === "yahoo" && isFutures\(d\.ref\)\)/);
  assert.match(src, /levelSeries\(lvActive\.entry\)[^\n]*isFutures\(x\.def\.ref\)/);
  assert.match(src, /for \(const f of futSrcs\) f\.set\(contractSeries\(f\.get\(\), futBars\[f\.id\], futSame\[f\.id\]\)\.series\)/);
  assert.match(src, /qFut\("NQ"\), qFut\("WTI", front\.yahoo\), q\("\^VIX"\), qFut\("GOLD"\)/, "live NQ / GC quotes = the contract itself");
});

test("ES roll day BEFORE: spliced ES=F (ESZ26 close → ESH27 price) = fake +1.05% → false 🔥 大幅高开", () => {
  const raw = (ES_CONT.at(-1)!.v / ES_CONT.at(-2)!.v - 1) * 100; assert.ok(raw > 1 && raw < 1.1, `${raw}`);
  assert.match(pm({ ES: ES_CONT, ...small }).md, /🔥 \*\*大幅高开/);
});

test("ES roll day AFTER: ESH27 vs ESH27 prev close (−0.06%), 已换月至 ESH27 from state, no 🔥", () => {
  const r = es(), sc = r.sc!;
  assert.equal(sc.code, "ESH27"); assert.ok(Math.abs(sc.pct1 - (7865 / 7870 - 1) * 100) < 1e-9);
  assert.equal(sc.label, "已换月至 ESH27（Mar 27）"); assert.deepEqual(r.state.ES, { contract: "ESH27", since: today, from: "ESZ26" });
  const s = contractSeries(ES_CONT, ESH, sc); assert.equal(s.full, true);
  assert.ok(Math.abs((s.series.at(-1)!.v / s.series.at(-2)!.v - 1) * 100 - sc.pct1) < 1e-9, "series 1d = same-contract 1d");
  const note = futNote("ES=F", sc, ESZ.at(-1)!.v); assert.match(note, /\*\*已换月至 ESH27（Mar 27）\*\*.*7865\.00 ÷ 同合约昨收 7870\.00 − 1 = -0\.06%.*ES=F 日线拼接会显示 \+1\.05%，为换月假变动/);
  const out = pm({ ES: s.series, ...small }, [note]);
  assert.doesNotMatch(out.md, /🔥/); assert.match(out.md, /ES -0\.06%/); assert.match(out.md, /已换月至 ESH27/);
});

test("roll label from saved state only; first run (no state) records the contract without a label", () => {
  const a = es({}); assert.equal(a.sc!.rolled, false); assert.deepEqual(a.state.ES, { contract: "ESH27", since: today, from: null });
  assert.equal(es(a.state).sc!.rolled, false, "same contract, no change");
  assert.equal(futSameChange("ES", "ES=F", { underlyingSymbol: "ESH27.CME" }, q("ESH27.CME", 7865, 7870), { today: "2026-12-15", state: es().state }).sc!.rolled, false, "next day");
});

test("contract bars missing / short → price only: 1d from the contract quote, 5d n/a, no 🔥 from the spliced history", () => {
  const sc = es().sc!;
  for (const bars of [undefined, ESH.slice(-3)]) {
    const s = contractSeries(ES_CONT, bars, sc); assert.equal(s.full, false); assert.deepEqual(s.series, [{ t: today, v: 7865 }]);
    const out = pm({ ES: s.series, ...small }); assert.doesNotMatch(out.md, /🔥/); assert.match(out.md, /ES n\/a/);
  }
});

test("VX=F: Yahoo returns no quote → null, n/a, no alarm; no underlyingSymbol → null", () => {
  const v = futSameChange("VX", "VX=F", null, null, { today });
  assert.equal(v.sc, null); assert.match(v.note, /VX=F Yahoo 无报价（无 underlyingSymbol）→ 1日涨跌 n\/a，不触发警报/);
  assert.deepEqual(contractSeries([{ t: today, v: 20 }], undefined, v.sc).series, []);
  assert.match(futSameChange("GOLD", "GC=F", { underlyingSymbol: null }, null, { today }).note, /GC=F 未返回 underlyingSymbol/);
  // a spliced ES with no same-contract quote at all → empty series → n/a, no 🔥
  assert.doesNotMatch(pm({ ES: contractSeries(ES_CONT, ESH, null).series, ...small }).md, /🔥/);
});

test("returnedSymbol guard: Yahoo must answer with the requested contract", () => {
  for (const ret of ["ES=F", null, "ESZ26.CME"]) { const r = es(STATE, q("ESH27.CME", 7865, 7870, ret)); assert.equal(r.sc, null, String(ret)); }
  assert.match(es(STATE, q("ESH27.CME", 7865, 7870, "ES=F")).note, /返回的合约为 ES=F，与 ESH27 不符/);
  assert.match(es(STATE, q("ESH27.CME", 7865, null)).note, /ESH27 无同合约昨收/);
});

test("state: futures-front.json wins, legacy oil-front.json entries carried over; oil roll still labelled", () => {
  const legacy: FrontState = { BRENT: { contract: "BZZ26", since: "2026-09-30", from: "BZX26" }, WTI: { contract: "CLZ26", since: "2026-10-21", from: "CLX26" } };
  const m = mergeFrontState({ ES: STATE.ES!, WTI: { contract: "CLF27", since: "2026-11-18", from: "CLZ26" } }, legacy);
  assert.deepEqual(Object.keys(m).sort(), ["BRENT", "ES", "WTI"]); assert.equal(m.WTI!.contract, "CLF27"); assert.equal(m.BRENT!.contract, "BZZ26");
  assert.deepEqual(mergeFrontState(null, null), {});
  const b = futSameChange("BRENT", "BZ=F", { underlyingSymbol: "BZF27.NYM" }, { symbol: "BZF27.NYM", returnedSymbol: "BZF27.NYM", price: 109.51, prevClose: 111.64, at: "2026-10-29T15:26:05Z" }, { today: "2026-10-29", state: m });
  assert.equal(b.sc!.label, "已换月至 BZF27（Jan 27）");
});

test("--offline keeps the old continuous method and says so", () => {
  assert.match(OFFLINE_FUT_NOTE, /离线.*旧的连续合约方法/);
  const src = readFileSync(new URL("../src/cli/brief.ts", import.meta.url), "utf8");
  assert.match(src, /values\.offline \? \[OFFLINE_FUT_NOTE\]/);
  assert.match(pm({ ES: ES_CONT, ...small }, [OFFLINE_FUT_NOTE]).md, /旧的连续合约方法/);
});
