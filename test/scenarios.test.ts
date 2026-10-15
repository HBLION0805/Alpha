import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { buildScenarios, SCENARIOS, scenarioAlarmItems } from "../src/macro/scenarios.ts";
import { knowledgeRef } from "../src/macro/risk.ts";
import { premarketAlarmAlerts } from "../src/alerts.ts";
import { referenceLevels, parseBars } from "../src/levels.ts";
import { loadDailyBars } from "../src/adapters/bars.ts";
import type { Obs } from "../src/macro/fetch.ts";

const ramp = (a: number, b: number, n = 80): Obs[] => Array.from({ length: n }, (_, i) => ({ t: `2026-${String(i).padStart(3, "0")}`, v: a + ((b - a) * i) / (n - 1) }));
const hawk = { UST2Y: ramp(4.4, 4.8), UST10Y: ramp(4.2, 4.5), REAL10Y: ramp(2.4, 2.9), DXY: ramp(98, 103), VIX: ramp(16, 17), VIX3M: ramp(19, 19), HYG: ramp(80, 80), SPX: ramp(7000, 7700), RUT: ramp(2600, 2450), USDJPY: ramp(150, 157), WTI: ramp(90, 92), GOLD: ramp(4200, 4150) };
const now = new Date("2026-10-20T20:30:00Z");

test("scenarios: hawkish leads on rates/USD/CPI-hot signals; weights are words, never percentages", () => {
  const r = buildScenarios({ now, data: hawk, headlines: ["Consumer inflation rose faster than expected in September"], calendar: [] });
  assert.equal(r.leader, "hawkish");
  assert.ok(r.signals.find((s) => s.id === "cpi_hot")!.hit);
  assert.doesNotMatch(r.md.split("## 实时信号")[0]! + r.md.split("## 情景排序")[1]!.split("## 方向预期")[0]!, /\d+\s*%(?!\))/, "no numeric probability in the ranking");
  assert.match(r.md, /不是概率，也不是数据/);
  for (const a of ["SPX", "NDX", "RUT", "TLT", "DXY", "黄金", "BTC"]) assert.ok(r.md.includes(a));
  assert.match(r.md, /单笔 ≤1%，同标的 ≤3%，最多 1 次调整，日亏 2% 停手/);
});

test("scenarios: tie → no leader → NO_TRADE; event window → NO_TRADE; missing data never counted", () => {
  const r = buildScenarios({ now, data: {}, calendar: [{ kind: "FOMC", title: "FOMC", date: "2026-10-21", timeEt: "14:00", source: "x" } as never] });
  assert.equal(r.leader, null);
  assert.ok(r.noTrade.some((n) => /并列/.test(n)) && r.noTrade.some((n) => /FOMC/.test(n)));
  assert.ok(r.signals.every((s) => s.hit === null));
});

test("scenarios: leader change → alarm item at score 70; same leader → none", () => {
  const r = buildScenarios({ now, data: hawk, headlines: [], previousLeader: "base" });
  assert.ok(r.changed);
  const items = scenarioAlarmItems(r, "base", now).map((x, i) => ({ ...x, id: i + 1 }));
  const a = premarketAlarmAlerts(items, { priorAlertScore: () => null }, 60);
  assert.equal(a[0]!.alert.score, 70); assert.deepEqual(a[0]!.alert.topics, ["scenarios"]);
  assert.equal(buildScenarios({ now, data: hawk, headlines: [], previousLeader: "hawkish" }).changed, false);
});

test("scenarios: every catalog id resolves; every world-line watch item is verbatim from the mentor's site", () => {
  const wl = readFileSync(new URL("../knowledge/mentor/world-lines.md", import.meta.url), "utf8");
  for (const s of SCENARIOS) {
    for (const id of s.catalog) assert.ok(knowledgeRef(id), `${s.id}: ${id}`);
    for (const w of s.worldLines) { assert.ok(wl.includes(w.watch), `${s.id}: ${w.watch}`); assert.ok(wl.includes(`**${w.title}**`)); }
  }
});

test("reference levels: prior day, weekly, SMA, pivots, Fib of the latest swing (Robinhood fixture)", async () => {
  const bars = parseBars(JSON.parse(readFileSync(new URL("./fixtures/spy-daily-robinhood.json", import.meta.url), "utf8")));
  const r = referenceLevels(bars);
  assert.equal(r.priorDay!.c, bars.at(-2)!.c);
  assert.ok(r.week!.h >= r.week!.l && r.priorWeek!.h >= r.priorWeek!.l);
  assert.ok(r.sma.ma200 != null && r.pivots.length > 0);
  const f = r.fib!; const hi = Math.max(f.from, f.to), lo = Math.min(f.from, f.to);
  assert.equal(f.levels.find((x) => x.ratio === 0.5)!.price, Number(((hi + lo) / 2).toFixed(2)));
  // Robinhood file path (no network) + zod rejects malformed rows
  const dir = mkdtempSync(`${tmpdir()}/bars-`);
  writeFileSync(`${dir}/SPY-bars.json`, readFileSync(new URL("./fixtures/spy-daily-robinhood.json", import.meta.url)));
  const lb = await loadDailyBars("SPY", dir, 30, new Date(Date.parse(bars.at(-1)!.t) + 3600_000));
  assert.equal(lb.source, "robinhood");
  assert.throws(() => parseBars({ bars: [{ begins_at: "2026-10-14", open_price: "abc", high_price: "1", low_price: "1", close_price: "1" }] }), /bars: provide 0\.open_price/);
});
