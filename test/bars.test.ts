import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { barsNeedRefresh, loadDailyBars, parseBars, symbolsNeedingBarsRefresh, writeBarsFile } from "../src/adapters/bars.ts";

const real = (date: string, close: number, volume = 80_000_000) => ({
  begins_at: `${date}T00:00:00Z`, open_price: (close - 1).toFixed(2), high_price: (close + 1).toFixed(2), low_price: (close - 2).toFixed(2), close_price: close.toFixed(2), volume, session: "reg",
});
/** The 2026-11-06 13:35 ET print: session not closed, open=high=low=close, volume 0. */
const unfinished = (date: string, px: number, extra: Record<string, unknown> = {}) => ({
  begins_at: `${date}T00:00:00Z`, open_price: px.toFixed(2), high_price: px.toFixed(2), low_price: px.toFixed(2), close_price: px.toFixed(2), volume: 0, session: "reg", ...extra,
});

test("loadDailyBars: stale bars → Yahoo fallback warns on stderr", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "bars-"));
  writeFileSync(join(dir, "NVDA-bars.json"), JSON.stringify([{ begins_at: "2026-11-02T00:00:00Z", open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 }]));
  const errs: string[] = [];
  t.mock.method(console, "error", (...a: unknown[]) => { errs.push(a.join(" ")); });
  t.mock.method(globalThis, "fetch", async () => { throw new Error("offline"); });
  await loadDailyBars("NVDA", dir, 30, new Date("2026-11-10T12:00:00Z")).catch(() => undefined);
  assert.ok(errs.some((e) => /\[bars\] WARN NVDA: .*stale \(last bar 2026-11-02\).*Yahoo fallback/.test(e)), errs.join("\n"));
});

test("loadDailyBars: fresh bars → no warning", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "bars-"));
  writeFileSync(join(dir, "NVDA-bars.json"), JSON.stringify([{ begins_at: "2026-11-03T00:00:00Z", open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 }]));
  const errs: string[] = [];
  t.mock.method(console, "error", (...a: unknown[]) => { errs.push(a.join(" ")); });
  const r = await loadDailyBars("NVDA", dir, 30, new Date("2026-11-04T12:00:00Z"));
  assert.equal(r.source, "robinhood");
  assert.equal(errs.length, 0);
});

test("write and read drop interpolated bars and flat zero-volume bars", () => {
  const dir = mkdtempSync(join(tmpdir(), "bars-"));
  const spy = {
    data: { results: [{ symbol: "SPY", interval: "day", bars: [
      real("2026-11-05", 730.1),
      unfinished("2026-11-06", 733, { interpolated: true }),
      { begins_at: "2026-11-04T00:00:00Z", open: 10, high: 11, low: 9, close: 10.5, volume: 0 },
      { begins_at: "2026-11-03T00:00:00Z", open: 10, high: 10, low: 10, close: 10, volume: 50 },
    ] }] },
    guide: "keep me",
  };
  const qqq = { bars: [real("2026-11-05", 650), unfinished("2026-11-06", 647.05)] };
  const written = writeBarsFile("SPY", spy, dir);
  const saved = JSON.parse(readFileSync(written, "utf8")) as { guide: string; data: { results: Array<{ bars: Array<Record<string, unknown>> }> } };
  assert.equal(saved.guide, "keep me");
  assert.deepEqual(saved.data.results[0]!.bars.map((b) => b.begins_at), ["2026-11-05T00:00:00Z", "2026-11-04T00:00:00Z", "2026-11-03T00:00:00Z"]);
  assert.equal(JSON.stringify(saved).includes("interpolated"), false);
  assert.equal(spy.data.results[0]!.bars.length, 4, "write does not mutate the raw response");
  const parsed = parseBars(spy);
  assert.deepEqual(parsed.map((b) => b.t), ["2026-11-03T00:00:00Z", "2026-11-04T00:00:00Z", "2026-11-05T00:00:00Z"]);
  assert.equal(parsed.at(-1)!.c, 730.1);
  assert.equal(parsed.find((b) => b.t.startsWith("2026-11-04"))!.v, 0, "a ranged bar with volume 0 is kept");
  assert.equal(parsed.find((b) => b.t.startsWith("2026-11-03"))!.c, 10, "a flat bar with volume is kept");
  assert.equal(parseBars(qqq).at(-1)!.c, 650);
  assert.equal(parseBars({ bars: [real("2026-11-05", 730.1), { ...real("2026-11-06", 735.29), interpolated: true }] }).at(-1)!.c, 730.1);
  assert.throws(() => parseBars({ bars: [unfinished("2026-11-06", 733, { interpolated: true })] }), /no valid OHLC/);
  writeBarsFile("QQQ", qqq, dir);
  const q = parseBars(JSON.parse(readFileSync(join(dir, "QQQ-bars.json"), "utf8")));
  assert.equal(q.length, 1); assert.equal(q[0]!.c, 650);
});

test("loadDailyBars ignores an unfinished bar instead of treating it as the close", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "bars-"));
  const raw = { bars: [real("2026-11-05", 730.1), unfinished("2026-11-06", 733, { interpolated: true })] };
  writeFileSync(join(dir, "SPY-bars.json"), JSON.stringify(raw));
  const fresh = await loadDailyBars("SPY", dir, 30, new Date("2026-11-06T18:35:00Z"));
  assert.equal(fresh.source, "robinhood");
  assert.equal(fresh.bars.at(-1)!.c, 730.1);
  assert.equal(fresh.bars.at(-1)!.t.slice(0, 10), "2026-11-05");
  const errs: string[] = [];
  t.mock.method(console, "error", (...a: unknown[]) => { errs.push(a.join(" ")); });
  t.mock.method(globalThis, "fetch", async () => { throw new Error("offline"); });
  await assert.rejects(() => loadDailyBars("SPY", dir, 30, new Date("2026-11-09T14:00:00Z")));
  assert.ok(errs.some((e) => /stale \(last bar 2026-11-05\)/.test(e)), errs.join("\n"));
  assert.equal(errs.some((e) => /733/.test(e)), false);
});

test("refresh re-fetches a placeholder or zero-volume last bar and skips a completed one", () => {
  const dir = mkdtempSync(join(tmpdir(), "bars-"));
  const through = "2026-11-06";
  assert.equal(barsNeedRefresh("SPY", through, dir), true, "missing file");
  writeFileSync(join(dir, "SPY-bars.json"), JSON.stringify({ bars: [real("2026-11-05", 730.1), unfinished("2026-11-06", 733, { interpolated: true })] }));
  writeFileSync(join(dir, "QQQ-bars.json"), JSON.stringify({ bars: [real("2026-11-05", 650), unfinished("2026-11-06", 647.05)] }));
  writeFileSync(join(dir, "IWM-bars.json"), JSON.stringify({ bars: [real("2026-11-05", 240), { begins_at: "2026-11-06T00:00:00Z", open: 241, high: 242, low: 239, close: 241.5, volume: 0 }] }));
  writeFileSync(join(dir, "DIA-bars.json"), JSON.stringify({ bars: [real("2026-11-05", 470), real("2026-11-06", 735.29)] }));
  assert.equal(barsNeedRefresh("SPY", through, dir), true, "interpolated last bar dated the session is not done");
  assert.equal(barsNeedRefresh("QQQ", through, dir), true, "flat volume-0 last bar dated the session is not done");
  assert.equal(barsNeedRefresh("IWM", through, dir), true, "last bar lacks volume");
  assert.equal(barsNeedRefresh("DIA", through, dir), false, "completed bar with volume can be skipped");
  assert.equal(barsNeedRefresh("DIA", "2026-11-09", dir), true, "completed bar before the session still needs a fetch");
  assert.deepEqual(symbolsNeedingBarsRefresh(["DIA", "SPY", "QQQ", "IWM"], through, dir), ["SPY", "QQQ", "IWM"]);
  writeBarsFile("SPY", { bars: [real("2026-11-05", 730.1), unfinished("2026-11-06", 733, { interpolated: true })] }, dir);
  assert.equal(barsNeedRefresh("SPY", through, dir), true, "after the placeholder is stripped, Friday is still missing");
  writeBarsFile("SPY", { bars: [real("2026-11-06", 735.29)] }, dir);
  assert.equal(barsNeedRefresh("SPY", through, dir), false);
  assert.equal(parseBars(JSON.parse(readFileSync(join(dir, "SPY-bars.json"), "utf8"))).at(-1)!.c, 735.29);
});

test("bars --need lists a placeholder symbol and skips a completed one", () => {
  const dir = mkdtempSync(join(tmpdir(), "bars-"));
  writeFileSync(join(dir, "SPY-bars.json"), JSON.stringify({ bars: [real("2026-11-06", 735.29)] }));
  writeFileSync(join(dir, "QQQ-bars.json"), JSON.stringify({ bars: [real("2026-11-05", 650), unfinished("2026-11-06", 647.05, { interpolated: true })] }));
  const r = spawnSync(process.execPath, ["src/cli/bars.ts", "--need", "--through", "2026-11-06", "--in", dir], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  const syms = r.stdout.trim().split(",").filter(Boolean);
  assert.equal(syms.includes("QQQ"), true);
  assert.equal(syms.includes("SPY"), false);
  assert.equal(syms.includes("IWM"), true, "missing file is still fetched");
});
