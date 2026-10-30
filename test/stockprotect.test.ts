import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { loadPhases, parsePhases, declaredPhase, ndxSideways, marketPhase, SIDEWAYS_DAYS, type PhaseEntry } from "../src/macro/marketPhase.ts";
import { stockProtectionLines } from "../src/review/mentor.ts";
import { buildCard } from "../src/review/card.ts";

const root = new URL("../", import.meta.url), rd = (p: string) => readFileSync(new URL(p, root), "utf8");
const DIR = "knowledge/mentor/market-calls/note-2026-10-19-sideways-options/";
const HANDLE_SHA = "288f26ff083ffd9c57dd08a1d7828ea87d89ecf47c39bcaa8ba733b6b4ea7a8a"; // sha256 only, never the name
const bars = (n: number, from: number, to: number) => Array.from({ length: n }, (_, k) => ({ t: new Date(Date.UTC(2026, 0, 1) + k * 864e5).toISOString().slice(0, 10), c: from + ((to - from) * k) / (n - 1) }));

test("archive: note byte-for-byte (sha256 in manifest, = mentor-inbox source), phases.json quotes are verbatim, no author handle in new text", () => {
  const m = JSON.parse(rd(DIR + "manifest.json")), f = m.files[0], b = readFileSync(new URL(DIR + "article.md", root));
  assert.equal(b.length, f.bytes); assert.equal(f.bytes, 493); assert.equal(createHash("sha256").update(b).digest("hex"), f.sha256);
  const src = "/workspace/mentor-inbox/notes/2026-10-19-1112-nasdaq-sideways-options.md";
  if (existsSync(src)) assert.ok(readFileSync(src).equals(b), "identical to the relayed note");
  const art = b.toString("utf8"), { entries, error } = loadPhases(); assert.equal(error, undefined);
  const e = entries.find((x) => x.date === "2026-10-19")!; assert.equal(e.phase, "junk"); assert.equal(e.source, DIR + "article.md");
  for (const q of e.quotes) assert.ok(art.includes(q), q);
  for (const p of [DIR + "article.md", DIR + "README.md", DIR + "manifest.json", "knowledge/mentor/market-calls/phases.json", "src/macro/marketPhase.ts", "src/review/mentor.ts", "test/stockprotect.test.ts"]) {
    const c = [...rd(p)];
    for (let k = 0; k + 1 < c.length; k++) if (/\p{Script=Han}/u.test(c[k]!) && /\p{Script=Han}/u.test(c[k + 1]!)) assert.notEqual(createHash("sha256").update(c[k]! + c[k + 1]!).digest("hex"), HANDLE_SHA, p);
  }
});

test("phase: NDX ±5% over 105 trading days = 横盘; latest mentor entry dated <= today; a later 'normal' entry turns the declared phase off", () => {
  assert.equal(ndxSideways(bars(SIDEWAYS_DAYS + 1, 100, 103)).sideways, true);
  assert.equal(ndxSideways(bars(150, 100, 112)).sideways, false);
  assert.equal(ndxSideways(bars(150, 100, 95.5)).sideways, true);
  assert.equal(ndxSideways(bars(50, 100, 101)).sideways, null, "too short → unknown, not sideways");
  const E = parsePhases({ entries: [{ date: "2026-10-19", phase: "junk", label: "垃圾时间段", source: "x", quotes: ["q"] }, { date: "2026-11-30", phase: "normal", label: "恢复", source: "y", quotes: [] }] });
  assert.equal(declaredPhase(E, "2026-10-18"), null); assert.equal(declaredPhase(E, "2026-10-19")!.phase, "junk"); assert.equal(declaredPhase(E, "2026-12-01")!.phase, "normal");
  assert.equal(marketPhase("2026-12-01", bars(150, 100, 112), E).active, false);
  assert.equal(marketPhase("2026-12-01", bars(150, 100, 103), E).active, true, "data check alone is enough");
  const p = marketPhase("2026-10-19", [], E); assert.equal(p.active, true); assert.match(p.why[0]!, /大佬 2026-10-19 判断：垃圾时间段/);
  assert.throws(() => parsePhases({ entries: [{ date: "2026-10-19", phase: "bull" }] }));
});

const PH = marketPhase("2026-10-19", bars(120, 100, 103), loadPhases().entries);
test("stock long in a sideways/junk phase → protection or covered-call reminder; covered call only with >= 100 shares; never naked", () => {
  const L = stockProtectionLines("bull", "long_stock", 250, PH), t = L.join("\n");
  assert.match(t, /正股做多 \+ 横盘\/垃圾时间段/); assert.match(t, /保护性 put，或 collar/); assert.match(t, /持有 250 股 → 最多卖 2 张/); assert.match(t, /绝不裸卖期权/);
  assert.match(t, /原文：「这种时间段基本上资产大回调会影响所有的人，所以特别需要学会用期权保护或拉低正股的成本。」/);
  assert.match(stockProtectionLines("bull", "stock", 99, PH).join("\n"), /持有 99 股，不足 100 股 → 不能卖 covered call/);
  assert.match(stockProtectionLines("bull", "正股", null, PH).join("\n"), /没填 --shares（持股数未知） → 不能卖 covered call/);
  assert.doesNotMatch(stockProtectionLines("bull", "long_stock", 99, PH).join("\n"), /最多卖/);
  for (const [d, s] of [["bear", "long_stock"], ["bull", "call_debit"], ["bull", "long_call"], ["bull", undefined]] as const) assert.deepEqual(stockProtectionLines(d, s, 300, PH), [], `${d} ${s}`);
  const off = marketPhase("2026-10-19", bars(150, 100, 112), [{ date: "2026-10-19", phase: "normal", label: "", source: "", quotes: [] } as PhaseEntry]);
  assert.deepEqual(stockProtectionLines("bull", "long_stock", 300, off), [], "no sideways/junk phase → nothing");
});

test("card hook is display-only: verdict, failing, tags, trade and sections identical with and without the phase; NO_TRADE / sizing / 能不能睡 code untouched", () => {
  const NOW = new Date("2026-10-19T15:00:00Z"), mk = (mp: typeof PH | null) => buildCard({ now: NOW, sym: "NVDA", dir: "bull", structure: "long_stock", spot: 217, bars: [], levels: null, quotes: [],
    brief: { generatedAt: NOW.toISOString(), leader: null, verdict: "NO_TRADE", plan: [] }, gex: null, calendar: [], earnings: [], journal: [], capital: 5000, shares: 100, marketPhase: mp });
  const a = mk(PH), b = mk(null);
  assert.ok(a.macroTheme?.some((l) => /最多卖 1 张/.test(l))); assert.ok(!b.macroTheme?.some((l) => /正股做多/.test(l)));
  assert.equal(a.verdict, b.verdict); assert.deepEqual(a.failing, b.failing); assert.deepEqual(a.warnTags, b.warnTags); assert.deepEqual(a.trade, b.trade); assert.deepEqual(a.sections, b.sections);
  for (const f of ["src/cli/brief.ts", "src/macro/premarket.ts", "src/macro/scenarios.ts", "src/macro/sleepday.ts", "src/macro/brief.ts", "src/options/riskplan.ts", "src/macro/oil.ts"])
    assert.doesNotMatch(rd(f), /marketPhase|stockProtection|phases\.json/, f);
});
