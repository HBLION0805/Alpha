import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FIXED_UNIVERSE, UNIVERSE_STOCKS, loadUniverse, readUniverse } from "../src/macro/universe.ts";
import { DEFAULT_WATCHLIST } from "../src/macro/volume.ts";
import { symbolsNeedingEarnings } from "../src/options/earningsStore.ts";
import { chainRefreshSymbols } from "../src/options/freshness.ts";
import { buildTradePlan, PLAN_UNIVERSE_NOTE } from "../src/macro/tradeplan.ts";
import { parseInput, WatchlistSchema } from "../src/adapters/schemas.ts";

const NAMES = "SPY QQQ IWM DIA RSP TLT IEF SHY UUP HYG LQD USO UCO GLD GLDM CPER SMH XLK XLE XLF XLI XLB XLY XLP XLV XLU XLRE XLC IYT JETS EWY FXI KWEB LEN KRE".split(" ");
const MEGA = ["AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "META", "AVGO", "TSLA"];

test("universe: FIXED_UNIVERSE is exactly the 35 macro names, in order, LEN the only stock", () => {
  assert.equal(FIXED_UNIVERSE.length, 35);
  assert.deepEqual([...FIXED_UNIVERSE], NAMES);
  assert.deepEqual([...UNIVERSE_STOCKS], ["LEN"]);
});

test("universe: matches local data/in/watchlist.json when present (data/ is gitignored)", (t) => {
  if (!existsSync("data/in/watchlist.json")) return t.skip("no local data/in/watchlist.json");
  assert.deepEqual(parseInput(WatchlistSchema, JSON.parse(readFileSync("data/in/watchlist.json", "utf8")), "watchlist.json"), NAMES);
});

test("universe: knowledge file lists the same 35 names", () => {
  const md = readFileSync("knowledge/macro/fixed-watchlist-and-flows.md", "utf8");
  for (const s of NAMES) assert.match(md, new RegExp(`\\b${s}\\b`), s);
});

test("universe: missing dir → FIXED_UNIVERSE copy; {symbols} form uppercased", () => {
  const u = loadUniverse("test/fixtures/__no_such_dir__");
  assert.deepEqual(u, NAMES);
  u.push("X"); assert.equal(FIXED_UNIVERSE.length, 35, "returns a copy");
});

test("universe: no default mega-caps in DEFAULT_WATCHLIST / loadUniverse fallback", () => {
  for (const s of MEGA) { assert.ok(!DEFAULT_WATCHLIST.includes(s), s); assert.ok(!loadUniverse("test/fixtures/__no_such_dir__").includes(s), s); }
});

test("universe: earnings --need over the fixed universe is only LEN; journal/pending names still added", () => {
  assert.deepEqual(symbolsNeedingEarnings([...FIXED_UNIVERSE]), ["LEN"]);
  assert.deepEqual(symbolsNeedingEarnings([...FIXED_UNIVERSE, "msgs", "NVDA"]), ["LEN", "MSGS", "NVDA"]);
  assert.deepEqual(symbolsNeedingEarnings(["spy", "NVDA", "nvda", "QQQ", "MSGS"]), ["MSGS", "NVDA"]);
});

test("universe: chains --need over the fixed universe = 34 names (GLDM dropped), no mega-caps", () => {
  const n = chainRefreshSymbols([...FIXED_UNIVERSE]);
  assert.equal(n.length, 34); assert.ok(!n.includes("GLDM"));
  assert.deepEqual(n.slice(0, 3), ["SPY", "QQQ", "IWM"]);
  for (const s of MEGA) assert.ok(!n.includes(s), s);
});

test("universe: trade plan stays ETF-default and states the policy line", () => {
  const ser = (a: number, b: number) => Array.from({ length: 10 }, (_, i) => ({ t: `2026-10-0${i}`, v: a + ((b - a) * i) / 9 }));
  const p = buildTradePlan({ leader: "hawkish", verdict: "RESEARCH_OK", noTrade: [], levels: {}, data: { UST10Y: ser(4.3, 4.5), DXY: ser(98, 100), WTI: ser(85, 94) }, bars5d: {} });
  assert.ok(p.candidates.length > 0);
  for (const c of p.candidates) assert.ok(["SPY", "QQQ", "IWM", "TLT"].includes(c.ticker), c.ticker);
  assert.ok(p.lines.includes(PLAN_UNIVERSE_NOTE));
  assert.match(PLAN_UNIVERSE_NOTE, /个股只在导师\/事件跟踪\/明确论点时单独开卡/);
  const none = buildTradePlan({ leader: null, verdict: "NO_TRADE", noTrade: ["x"], levels: {}, data: {}, bars5d: {} });
  assert.ok(none.lines.includes(PLAN_UNIVERSE_NOTE));
});

test("universe: a drifted watchlist.json does not override the fixed 35", () => {
  const dir = join(tmpdir(), `alpha-univ-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  try {
    writeFileSync(join(dir, "watchlist.json"), JSON.stringify(["NVDA", "AAPL", "SPY"]));
    const report = readUniverse(dir);
    assert.equal(report.file, "drift");
    assert.match(report.warning ?? "", /不覆盖/);
    assert.deepEqual(report.symbols, NAMES);
    const errs: string[] = [];
    const orig = console.error;
    console.error = (...a: unknown[]) => { errs.push(a.map(String).join(" ")); };
    try { assert.deepEqual(loadUniverse(dir), NAMES); }
    finally { console.error = orig; }
    assert.match(errs.join("\n"), /NVDA/);
    assert.ok(!NAMES.includes("NVDA"));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("universe: src never writes watchlist.json; routine docs forbid RH override", () => {
  const walk = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(`${d}/${e.name}`) : e.name.endsWith(".ts") ? [`${d}/${e.name}`] : []));
  for (const f of walk("src")) assert.doesNotMatch(readFileSync(f, "utf8"), /writeFileSync\([^)]*watchlist/, f);
  assert.match(readFileSync("docs/ROUTINE_CHAINS.md", "utf8"), /do NOT overwrite `data\/in\/watchlist\.json`/i);
});
