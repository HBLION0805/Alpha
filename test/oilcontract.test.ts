/** Same-contract oil changes (src/macro/oilContract.ts) — Brent/WTI roll false alarms. Recorded Yahoo data (fixture), no network. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseContract, sameContractChange, sameContractNote, OFFLINE_OIL_NOTE, type FrontState, type SameContract } from "../src/macro/oilContract.ts";
import { buildOil } from "../src/macro/oil.ts";
import { buildPremarket } from "../src/macro/premarket.ts";
import { frontContinuous } from "../src/macro/wtiFront.ts";
import { briefArchivePath, briefSession } from "../src/macro/briefArchive.ts";
import type { Obs } from "../src/macro/fetch.ts";

// recorded 2026-10-29 ~11:26 ET from Yahoo (quote + 75-day daily chart); see _source in the file
const fx = JSON.parse(readFileSync(new URL("./fixtures/oil-roll-2026-10-29.json", import.meta.url), "utf8"));
type Q = { symbol: string; underlyingSymbol: string | null; price: number; prevClose: number; at: string };
const Qs = fx.quotes as Record<string, Q>;
const kq = (s: string, o: Partial<Q & { returnedSymbol: string | null }> = {}) => ({ symbol: s, returnedSymbol: Qs[s]!.symbol, price: Qs[s]!.price, prevClose: Qs[s]!.prevClose, at: Qs[s]!.at, ...o });
const cq = (s: string) => ({ underlyingSymbol: Qs[s]!.underlyingSymbol });
const ser = (s: string): Obs[] => (fx.daily[s] as [string, number][]).map(([t, v]) => ({ t, v }));
const BZ = ser("BZ=F"), BZF = ser("BZF27.NYM"), CL = ser("CL=F"), CLZ = ser("CLZ26.NYM");
const today = "2026-10-29", STATE: FrontState = { BRENT: { contract: "BZZ26", since: "2026-09-30", from: "BZX26" }, WTI: { contract: "CLZ26", since: "2026-10-21", from: "CLX26" } };
const prevBar = (o: Obs[]) => o.filter((x) => x.t < today).at(-1)!.v;
const now = new Date("2026-10-29T15:30:00Z");
const brent = (o: Partial<Q & { returnedSymbol: string | null }> = {}, state: FrontState | undefined = STATE) => sameContractChange("BRENT", cq("BZ=F"), kq("BZF27.NYM", o), { today, state, contPrevBar: prevBar(BZ) });
const wti = (o: Partial<Q> = {}) => sameContractChange("WTI", cq("CL=F"), kq("CLZ26.NYM", o), { today, state: STATE, contPrevBar: prevBar(CL) });
/** a continuous series whose last 5 days rose +12% (a splice-like jump) — legacy path would fire a 5d OIL_SPIKE / ⚡ */
const jump5 = (o: Obs[]) => o.map((x, i) => (i >= o.length - 5 ? { ...x, v: x.v * 1.12 } : x));
const pm = (data: Record<string, Obs[]>, extra: Partial<Parameters<typeof buildPremarket>[0]> = {}) => buildPremarket({ now, data, calendar: [], earnings: null, headlines: [], ...extra });
const row = (lines: string[], p: string) => lines.find((l) => l.startsWith(`| ${p}`))!;

test("fixture is the live recording (BZF27 10-23 = 111.70; BZ=F → BZF27, CL=F → CLZ26)", () => {
  assert.match(fx._source, /recorded 2026-10-29T15:\d\d/);
  assert.deepEqual(fx.daily["BZF27.NYM"].find((r: [string, number]) => r[0] === "2026-10-23"), ["2026-10-23", 111.7]);
  assert.equal(Qs["BZ=F"]!.underlyingSymbol, "BZF27.NYM"); assert.equal(Qs["CL=F"]!.underlyingSymbol, "CLZ26.NYM");
});

test("parseContract: Yahoo futures symbols", () => {
  assert.deepEqual(parseContract("BZF27.NYM"), { code: "BZF27", root: "BZ", month: "Jan 27" });
  assert.equal(parseContract("CLZ26.NYM")!.month, "Dec 26");
  assert.equal(parseContract("BZ=F"), null); assert.equal(parseContract(null), null);
});

test("roll day BEFORE: continuous BZ=F daily bars (Dec 115.32 → Jan 109.51) = fake −5.04% → false OIL_CRASH", () => {
  const raw = (BZ.at(-1)!.v / BZ.at(-2)!.v - 1) * 100; assert.ok(raw < -5 && raw > -5.1, `${raw}`);
  const legacy = buildOil({ WTI: CL, BRENT: BZ }, { now });
  assert.ok(legacy.alarms.some((a) => a.kind === "OIL_CRASH" && /Brent 暴跌 1日 -5\.04%/.test(a.title)), JSON.stringify(legacy.alarms));
});

test("roll day AFTER: Brent 1d = BZF27 vs BZF27 prev close (−1.91%), 已换月至 BZF27, no alarm", () => {
  const r = brent(), sc = r.sc!;
  assert.equal(sc.code, "BZF27"); assert.ok(Math.abs(sc.pct1 - (109.51 / 111.64 - 1) * 100) < 1e-9);
  assert.equal(sc.rolled, true); assert.equal(sc.rolledFrom, "BZZ26"); assert.equal(sc.label, "已换月至 BZF27（Jan 27）");
  assert.deepEqual(r.state.BRENT, { contract: "BZF27", since: today, from: "BZZ26" });
  assert.match(sameContractNote(sc, prevBar(BZ)), /已换月至 BZF27.*109\.51 ÷ 同合约昨收 111\.64 − 1 = -1\.91%.*BZ=F 日线拼接会显示 -5\.04%，为换月假变动，不用/);
  const w = wti().sc!; assert.equal(w.rolled, false); assert.equal(w.label, "CLZ26");
  const o = buildOil({ WTI: frontContinuous(CL, CLZ, "CLZ26").series, BRENT: frontContinuous(BZ, BZF, "BZF27").series }, { now, same: { BRENT: sc, WTI: w }, brentLabel: `Brent（${sc.label}）` });
  assert.match(row(o.lines, "Brent"), /已换月至 BZF27.*\| -1\.91% \|/); assert.doesNotMatch(row(o.lines, "Brent"), /-5\.0\d%/);
  assert.equal(o.alarms.length, 0);
});

test("roll label comes only from the saved contract-change state, never from a price gap", () => {
  // splice / gap but no state change → no label (first run without a state file records the contract, no from)
  const a = brent({}, {}); assert.equal(a.sc!.rolled, false); assert.equal(a.sc!.label, "BZF27"); assert.deepEqual(a.state.BRENT, { contract: "BZF27", since: today, from: null });
  // WTI: continuous prev bar 2% away from the contract's prev close, same contract → still not rolled
  assert.equal(sameContractChange("WTI", cq("CL=F"), kq("CLZ26.NYM"), { today, state: STATE, contPrevBar: 104.9 }).sc!.rolled, false);
  // state says the contract changed today → rolled on every run of that day, even with no gap
  const st = brent().state;
  assert.equal(sameContractChange("BRENT", cq("BZ=F"), kq("BZF27.NYM"), { today, state: st, contPrevBar: 111.64 }).sc!.rolled, true);
  // next day → not rolled
  assert.equal(sameContractChange("BRENT", cq("BZ=F"), kq("BZF27.NYM", { prevClose: 109.51 }), { today: "2026-10-30", state: st, contPrevBar: 109.51 }).sc!.label, "BZF27");
});

test("guard uses the symbol Yahoo returned: a mismatched / missing answer → no 1d change", () => {
  assert.equal(brent({ returnedSymbol: "BZ=F" }).sc, null); assert.match(brent({ returnedSymbol: "BZ=F" }).note, /返回的合约为 BZ=F，与 BZF27 不符/);
  assert.equal(brent({ returnedSymbol: null }).sc, null);
  assert.equal(brent({ returnedSymbol: "BZZ26.NYM" }).sc, null);
});

test("must-fix 1: WTI own contract bars missing → 5d / 均线 / 52周 n/a and no 5d alarm (no calendar-front / CL=F fallback)", () => {
  const CLj = jump5(CL), w = wti().sc!;
  assert.ok(pm({ WTI: CLj, BRENT: BZF }).alarms.some((a) => a.kind === "OIL_SPIKE"), "legacy continuous path fires 5d OIL_SPIKE");
  const r = pm({ WTI: CLj, BRENT: BZF }, { oilSame: { WTI: w, BRENT: brent().sc }, oilFront: null, brentFront: frontContinuous(BZ, BZF, "BZF27") });
  assert.equal(r.alarms.filter((a) => a.kind.startsWith("OIL_") || a.kind === "BRENT_WTI_WIDEN").length, 0, JSON.stringify(r.alarms));
  assert.match(row(r.oilLines, "WTI"), /\| 100\.24 \| -2\.47% \| n\/a \| n\/a \| n\/a \|/);
  assert.equal(r.oilVix.speed.find((s) => s.id === "WTI")!.d5, null); assert.equal(r.oilVix.fast, false);
  // brief.ts: the calendar front is only reused when it IS the underlyingSymbol contract
  const src = readFileSync(new URL("../src/cli/brief.ts", import.meta.url), "utf8");
  assert.match(src, /alt && alt\.code === sc\.code \? alt\.bars : undefined/); assert.match(src, /fs\?\.junction != null \? fs : null/);
});

test("must-fix 2: Brent bars missing or oilSame.BRENT null → 5d / 均线 / 52周 n/a, no 5d OIL_SPIKE, no ⚡", () => {
  const BZj = jump5(BZ), w = wti().sc!, wf = frontContinuous(CL, CLZ, "CLZ26");
  assert.ok(pm({ WTI: CL, BRENT: BZj }).oilVix.fast, "legacy: spliced BZ=F gives ⚡");
  for (const [sc, fs] of [[null, null], [brent().sc, null], [brent().sc, frontContinuous(BZj, BZF.slice(-3), "BZF27")]] as const) {
    const r = pm({ WTI: CL, BRENT: BZj }, { oilSame: { WTI: w, BRENT: sc as SameContract | null }, oilFront: wf, brentFront: fs });
    assert.equal(r.alarms.filter((a) => a.kind.startsWith("OIL_") || a.kind === "BRENT_WTI_WIDEN").length, 0, JSON.stringify(r.alarms));
    assert.match(row(r.oilLines, "Brent"), sc ? /\| 109\.51 \| -1\.91% \| n\/a \| n\/a \| n\/a \|/ : /\| n\/a \| n\/a \| n\/a \| n\/a \| n\/a \|/);
    assert.equal(r.oilVix.speed.find((s) => s.id === "BRENT")!.d5, null); assert.equal(r.oilVix.fast, false);
    assert.match(r.oilLines.join("\n"), /Brent–WTI 价差\*\* \$n\/a|5日 n\/a/);
  }
});

test("a real same-contract crash still raises OIL_CRASH", () => {
  const o = buildOil({ WTI: CL, BRENT: BZF }, { now, same: { BRENT: brent({ price: 105 }).sc, WTI: null } });
  assert.ok(o.alarms.some((a) => a.kind === "OIL_CRASH" && /Brent 暴跌 1日 -5\.95%/.test(a.title)), JSON.stringify(o.alarms));
});

test("no underlyingSymbol / no same-contract prev close → 1d n/a and no 1d alarm", () => {
  const r = sameContractChange("BRENT", { underlyingSymbol: null }, null, { today });
  assert.equal(r.sc, null); assert.match(r.note, /无法确认限月/);
  assert.match(brent({ prevClose: null as unknown as number }).note, /BZF27 无同合约昨收/);
  const o = buildOil({ WTI: CL, BRENT: BZ }, { now, same: { BRENT: null, WTI: null } });
  assert.equal(o.alarms.length, 0); assert.match(row(o.lines, "Brent"), /\| n\/a \|/);
});

test("premarket roll day (recorded data): no OIL_CRASH, label shown, Brent has its own note (not a rewritten WTI note)", () => {
  assert.ok(pm({ WTI: CL, BRENT: BZ }).alarms.some((a) => a.kind === "OIL_CRASH"), "before: false alarm");
  const sc = { BRENT: brent().sc, WTI: wti().sc };
  const r = pm({ WTI: CL, BRENT: BZ }, { oilSame: sc, oilFront: frontContinuous(CL, CLZ, "CLZ26"), brentFront: frontContinuous(BZ, BZF, "BZF27"), oilNotes: [sameContractNote(sc.BRENT!, prevBar(BZ))] });
  assert.equal(r.alarms.filter((a) => a.kind === "OIL_CRASH").length, 0);
  assert.match(r.md, /已换月至 BZF27/);
  const note = r.oilLines.find((l) => l.startsWith("_Brent = "))!;
  assert.match(note, /^_Brent = 合约 BZF27（BZ=F 的 underlyingSymbol）；近期 1日\/5日用同一合约计算.*BZ=F 日线 109\.51 与该合约不同|^_Brent = 合约 BZF27（BZ=F 的 underlyingSymbol）/);
  assert.doesNotMatch(note, /CNBC|CL=F|WTI/);
  assert.ok(Math.abs(r.oilVix.speed.find((s) => s.id === "BRENT")!.d1! - sc.BRENT!.pct1) < 1e-9);
});

test("--offline says it uses the old continuous method", () => {
  assert.match(OFFLINE_OIL_NOTE, /离线.*旧的连续合约方法.*假变动/);
  const src = readFileSync(new URL("../src/cli/brief.ts", import.meta.url), "utf8");
  assert.match(src, /if \(values\.offline\) oilNotes\.push\(OFFLINE_OIL_NOTE\)/);
  assert.match(pm({ WTI: CL, BRENT: BZ }, { oilNotes: [OFFLINE_OIL_NOTE] }).md, /旧的连续合约方法/);
});

test("brief archive: dated, timestamped copy for premarket / close only (ET)", () => {
  assert.equal(briefArchivePath(new Date("2026-10-29T20:30:00Z"), "data/out"), "data/out/briefs/2026-10-29_1630_close.md");
  assert.equal(briefArchivePath(new Date("2026-10-29T11:35:00Z"), "data/out"), "data/out/briefs/2026-10-29_0735_premarket.md");
  assert.equal(briefArchivePath(new Date("2026-10-29T16:00:00Z"), "data/out"), null);
  assert.equal(briefSession(new Date("2026-10-29T13:29:00Z")), "premarket"); assert.equal(briefSession(new Date("2026-10-29T13:30:00Z")), null);
  assert.equal(briefSession(new Date("2026-10-29T22:59:00Z")), "close"); assert.equal(briefSession(new Date("2026-10-29T23:00:00Z")), null);
});

test("brief CLI wires the same-contract path and the archive (static)", () => {
  const src = readFileSync(new URL("../src/cli/brief.ts", import.meta.url), "utf8");
  assert.match(src, /futSameChange\(f\.id, f\.cont, cq\[f\.cont\]/); assert.match(src, /oilSame: values\.offline \? undefined : oilSame/);
  assert.match(src, /briefArchivePath\(now, dirname\(values\.out\)\)/);
});

test("50-day / 52-week columns are labelled 回溯调整连续合约 and feed no alarm", () => {
  const sc = { BRENT: brent().sc, WTI: wti().sc };
  const run = (cl: Obs[], bz: Obs[]) => pm({ WTI: cl, BRENT: bz }, { oilSame: sc, oilFront: frontContinuous(cl, CLZ, "CLZ26"), brentFront: frontContinuous(bz, BZF, "BZF27") });
  const r = run(CL, BZ);
  assert.match(r.oilLines.join("\n"), /\| 距 50 日均线（回溯调整连续合约） \| 距 52 周高点（回溯调整连续合约） \|/);
  // halve every bar older than the same-contract window: 50-day / 52-week figures change, alarms / ⚡ / NO_TRADE do not
  const cut = CLZ.at(-11)!.t, half = (o: Obs[]) => o.map((x) => (x.t < cut ? { ...x, v: x.v / 2 } : x));
  const h = run(half(CL), half(BZ));
  assert.notEqual(row(h.oilLines, "WTI"), row(r.oilLines, "WTI"), "history change is visible in the columns");
  assert.deepEqual(h.alarms, r.alarms); assert.equal(h.oilVix.fast, r.oilVix.fast); assert.deepEqual(h.noTrade, r.noTrade);
  // legacy / offline (no contract series): no label
  assert.doesNotMatch(pm({ WTI: CL, BRENT: BZ }).oilLines.join("\n"), /回溯调整/);
});
