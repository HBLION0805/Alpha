/** Same-contract oil changes (src/macro/oilContract.ts) — Brent/WTI roll false alarms. Recorded data, no network. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseContract, sameContractChange, sameContractNote, type FrontState } from "../src/macro/oilContract.ts";
import { buildOil } from "../src/macro/oil.ts";
import { buildPremarket } from "../src/macro/premarket.ts";
import { frontContinuous } from "../src/macro/wtiFront.ts";
import { briefArchivePath, briefSession } from "../src/macro/briefArchive.ts";
import type { Obs } from "../src/macro/fetch.ts";

const fx = JSON.parse(readFileSync(new URL("./fixtures/oil-roll-2026-10-29.json", import.meta.url), "utf8"));
type Q = { underlyingSymbol?: string; price: number; prevClose: number };
const Qs = fx.quotes as Record<string, Q>;
const kq = (s: string) => ({ symbol: s, price: Qs[s]!.price, prevClose: Qs[s]!.prevClose, at: "2026-10-29T14:43:00Z" });
const cq = (s: string) => ({ underlyingSymbol: Qs[s]!.underlyingSymbol ?? null });
// 40 flat older bars so 5d / SMA have history, then the recorded tail
const older = (v: number): Obs[] => Array.from({ length: 40 }, (_, i) => ({ t: new Date(Date.UTC(2026, 7, 1 + i)).toISOString().slice(0, 10), v }));
const series = (s: string, base: number): Obs[] => [...older(base), ...(fx.daily[s] as [string, number][]).map(([t, v]) => ({ t, v }))];
const BZ = series("BZ=F", 116), BZF = series("BZF27.NYM", 113), CL = series("CL=F", 104);
const today = "2026-10-29", STATE: FrontState = { BRENT: { contract: "BZZ26", since: "2026-09-30", from: "BZX26" }, WTI: { contract: "CLZ26", since: "2026-10-21", from: "CLX26" } };
const prevBar = (o: Obs[]) => o.filter((x) => x.t < today).at(-1)!.v;
const now = new Date("2026-10-29T14:45:00Z");

test("parseContract: Yahoo futures symbols", () => {
  assert.deepEqual(parseContract("BZF27.NYM"), { code: "BZF27", root: "BZ", month: "Jan 27" });
  assert.equal(parseContract("CLZ26.NYM")!.month, "Dec 26");
  assert.equal(parseContract("BZ=F"), null); assert.equal(parseContract(null), null);
});

test("roll day 2026-10-29 BEFORE: continuous BZ=F daily bars give a fake −4.67% → false OIL_CRASH", () => {
  const raw = (BZ.at(-1)!.v / BZ.at(-2)!.v - 1) * 100; assert.ok(raw < -4.6 && raw > -4.7, `${raw}`);
  // a −5% day on the same splice (the 10-26 / 10-29 alerts.jsonl −5.23% / −5.32%) → OIL_CRASH from the legacy path
  const worse = [...BZ.slice(0, -1), { t: today, v: 109.4 }];
  const legacy = buildOil({ WTI: CL, BRENT: worse }, { now });
  assert.ok(legacy.alarms.some((a) => a.kind === "OIL_CRASH" && /Brent/.test(a.title)), "legacy path raised the false alarm");
  // the new method on the same data: Jan vs Jan = 109.40 / 111.64 − 1 = −2.0% → no alarm
  const r = sameContractChange("BRENT", cq("BZ=F"), { ...kq("BZF27.NYM"), price: 109.4 }, { today, state: STATE, contPrevBar: prevBar(worse) });
  const fixed = buildOil({ WTI: CL, BRENT: frontContinuous(worse, BZF, "BZF27").series }, { now, same: { BRENT: r.sc, WTI: null } });
  assert.equal(fixed.alarms.filter((a) => a.kind === "OIL_CRASH").length, 0);
});

test("roll day 2026-10-29 AFTER: Brent 1d = BZF27 vs BZF27 prev close (−1.56%), labelled 已换月至 BZF27", () => {
  const r = sameContractChange("BRENT", cq("BZ=F"), kq("BZF27.NYM"), { today, state: STATE, contPrevBar: prevBar(BZ) });
  const sc = r.sc!;
  assert.equal(sc.code, "BZF27"); assert.ok(Math.abs(sc.pct1 - (109.9 / 111.64 - 1) * 100) < 1e-9); assert.ok(Math.abs(sc.pct1 + 1.56) < 0.01);
  assert.equal(sc.rolled, true); assert.equal(sc.rolledFrom, "BZZ26"); assert.equal(sc.label, "已换月至 BZF27（Jan 27）");
  assert.deepEqual(r.state.BRENT, { contract: "BZF27", since: today, from: "BZZ26" });
  assert.match(sameContractNote(sc, prevBar(BZ)), /已换月至 BZF27.*109\.90 ÷ 同合约昨收 111\.64 − 1 = −?-1\.56%.*BZ=F 日线拼接会显示 -4\.70%，为换月假变动，不用/);
  // WTI has not rolled: same contract CL=F == CLZ26
  const w = sameContractChange("WTI", cq("CL=F"), kq("CLZ26.NYM"), { today, state: STATE, contPrevBar: prevBar(CL) }).sc!;
  assert.equal(w.rolled, false); assert.equal(w.label, "CLZ26"); assert.ok(Math.abs(w.pct1 + 2.39) < 0.01);
  const o = buildOil({ WTI: CL, BRENT: frontContinuous(BZ, BZF, "BZF27").series }, { now, same: { BRENT: sc, WTI: w }, brentLabel: `Brent（${sc.label}）` });
  const brentRow = o.lines.find((l) => l.startsWith("| Brent"))!;
  assert.match(brentRow, /已换月至 BZF27/); assert.match(brentRow, /\| -1\.56% \|/); assert.doesNotMatch(brentRow, /-4\.\d+%/);
  assert.equal(o.alarms.length, 0);
});

test("roll detected from the splice alone (no state file), and from state alone (no splice)", () => {
  const a = sameContractChange("BRENT", cq("BZ=F"), kq("BZF27.NYM"), { today, contPrevBar: prevBar(BZ) }).sc!;
  assert.equal(a.rolled, true, "BZ=F prev bar 115.32 ≠ BZF27 prev close 111.64");
  const b = sameContractChange("BRENT", cq("BZ=F"), kq("BZF27.NYM"), { today, state: STATE, contPrevBar: 111.64 }).sc!;
  assert.equal(b.rolled, true);
  // the next day: same contract, state since yesterday, no splice → not rolled
  const st = sameContractChange("BRENT", cq("BZ=F"), kq("BZF27.NYM"), { today, state: STATE }).state;
  const c = sameContractChange("BRENT", cq("BZ=F"), { ...kq("BZF27.NYM"), price: 110, prevClose: 109.9 }, { today: "2026-10-30", state: st, contPrevBar: 109.9 }).sc!;
  assert.equal(c.rolled, false); assert.equal(c.label, "BZF27");
  // later runs on the roll day keep the label
  assert.equal(sameContractChange("BRENT", cq("BZ=F"), kq("BZF27.NYM"), { today, state: st, contPrevBar: 111.64 }).sc!.rolled, true);
});

test("a real same-contract crash still raises OIL_CRASH", () => {
  const sc = sameContractChange("BRENT", cq("BZ=F"), { ...kq("BZF27.NYM"), price: 105 }, { today, state: STATE, contPrevBar: prevBar(BZ) }).sc!;
  const o = buildOil({ WTI: CL, BRENT: BZF }, { now, same: { BRENT: sc, WTI: null } });
  assert.ok(o.alarms.some((a) => a.kind === "OIL_CRASH" && /Brent 暴跌 1日 -5\.95%/.test(a.title)), JSON.stringify(o.alarms));
});

test("no underlyingSymbol / no same-contract prev close → 1d n/a and no 1d alarm (never the continuous bars)", () => {
  const r = sameContractChange("BRENT", { underlyingSymbol: null }, null, { today });
  assert.equal(r.sc, null); assert.match(r.note, /无法确认限月/);
  const r2 = sameContractChange("BRENT", cq("BZ=F"), { ...kq("BZF27.NYM"), prevClose: null as unknown as number }, { today });
  assert.equal(r2.sc, null); assert.match(r2.note, /BZF27 无同合约昨收/);
  const crash = [...BZ.slice(0, -1), { t: today, v: 100 }];
  const o = buildOil({ WTI: CL, BRENT: crash }, { now, same: { BRENT: null, WTI: null } });
  assert.equal(o.alarms.filter((a) => a.kind === "OIL_CRASH").length, 0);
  assert.match(o.lines.find((l) => l.startsWith("| Brent"))!, /\| n\/a \|/);
});

test("premarket (brief + event alerts): roll day → no OIL_CRASH alarm, 快速变动 and oil block use the same contract, label shown", () => {
  const sc = { BRENT: sameContractChange("BRENT", cq("BZ=F"), { ...kq("BZF27.NYM"), price: 109.4 }, { today, state: STATE, contPrevBar: 115.32 }).sc,
    WTI: sameContractChange("WTI", cq("CL=F"), kq("CLZ26.NYM"), { today, state: STATE, contPrevBar: 102.78 }).sc };
  const BZw = [...BZ.slice(0, -1), { t: today, v: 109.4 }];
  const legacy = buildPremarket({ now, data: { WTI: CL, BRENT: BZw }, calendar: [], earnings: null, headlines: [] });
  assert.ok(legacy.alarms.some((a) => a.kind === "OIL_CRASH"), "before: false alarm");
  const pm = buildPremarket({ now, data: { WTI: CL, BRENT: BZw }, calendar: [], earnings: null, headlines: [], oilSame: sc,
    brentFront: frontContinuous(BZw, BZF, "BZF27"), oilNotes: [sameContractNote(sc.BRENT!, 115.32)] });
  assert.equal(pm.alarms.filter((a) => a.kind === "OIL_CRASH").length, 0, "after: no false alarm (event alerts come from pm.alarms)");
  assert.match(pm.md, /已换月至 BZF27/);
  assert.ok(Math.abs(pm.oilVix.speed.find((s) => s.id === "BRENT")!.d1! - (109.4 / 111.64 - 1) * 100) < 1e-9);
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
  assert.match(src, /yahooFutQuote\(OIL_CONT\[id\]\)/); assert.match(src, /oilSame: values\.offline \? undefined : oilSame/);
  assert.match(src, /briefArchivePath\(now, dirname\(values\.out\)\)/);
});
