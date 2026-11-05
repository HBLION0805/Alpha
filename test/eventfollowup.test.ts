import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { loadFollowups, followupLines, phaseOf, verdictOf, etToMs, type FollowupInputs } from "../src/macro/eventFollowup.ts";
import { buildMacroReport } from "../src/macro/build.ts";
import { buildPremarket } from "../src/macro/premarket.ts";
import { buildScenarios } from "../src/macro/scenarios.ts";
import { buildBrief } from "../src/macro/brief.ts";

const root = new URL("../", import.meta.url), rd = (p: string) => readFileSync(new URL(p, root), "utf8");
const { followups, error } = loadFollowups(), F = followups.find((f) => f.id === "meta-earnings-2026-10-21")!;
const HANDLE_SHA = "288f26ff083ffd9c57dd08a1d7828ea87d89ecf47c39bcaa8ba733b6b4ea7a8a";
const q = (asOf: string, m: Record<string, [number, number]>) => ({ asOf, quotes: Object.fromEntries(Object.entries(m).map(([s, [last, ext]]) => [s, { last, lastExt: ext }])) });
const at = (iso: string) => new Date(iso);
const results = { fetchedAt: "2026-10-21T20:30:00Z", bySymbol: { META: [{ year: 2026, quarter: 3, eps: { estimate: "5.890000", actual: "6.120000" }, report: { date: "2026-10-21", timing: "pm", verified: true } }] } };

test("archive: note byte-for-byte (= mentor-inbox), quotes verbatim, no author handle; follow-up data matches the task", () => {
  const D = "knowledge/mentor/market-calls/note-2026-10-19-meta-cashflow/", m = JSON.parse(rd(D + "manifest.json")), b = readFileSync(new URL(D + "article.md", root));
  assert.equal(b.length, 101); assert.equal(createHash("sha256").update(b).digest("hex"), m.files[0].sha256);
  for (const x of F.quotes) assert.ok(b.toString().includes(x), x);
  for (const p of [D + "article.md", D + "README.md", D + "manifest.json", "knowledge/events/event-followups.json", "src/macro/eventFollowup.ts"]) { const c = [...rd(p)];
    for (let k = 0; k + 1 < c.length; k++) if (/\p{Script=Han}/u.test(c[k]!) && /\p{Script=Han}/u.test(c[k + 1]!)) assert.notEqual(createHash("sha256").update(c[k]! + c[k + 1]!).digest("hex"), HANDLE_SHA, p); }
  assert.equal(error, undefined); assert.equal(F.symbol, "META"); assert.equal(F.epsEstimate, 5.89); assert.equal(F.date, "2026-10-21"); assert.equal(F.timing, "pm");
  assert.deepEqual(F.baskets.down.symbols, ["CRWV", "NBIS", "ORCL"]); assert.deepEqual(F.baskets.up.symbols, ["NVDA", "AVGO"]); assert.equal(F.expires, "2026-10-22");
});

test("phases (ET): 10/21 brief = pre; 10/21 18/20/22 runs = after; 10/22 7:30 = verdict; gone from 10/23", () => {
  assert.equal(phaseOf(F, at("2026-10-20T23:00:00Z")), null);
  assert.equal(phaseOf(F, at("2026-10-21T11:30:00Z")), "pre");
  for (const h of ["22", "00", "02"]) assert.equal(phaseOf(F, at(`2026-10-${h === "22" ? "21" : "22"}T${h}:00:00Z`)), "after", h); // 18:00, 20:00, 22:00 ET
  assert.equal(phaseOf(F, at("2026-10-22T11:30:00Z")), "verdict");
  assert.equal(phaseOf(F, at("2026-10-23T04:30:00Z")), null);
  assert.equal(etToMs("2026-10-21", "16:00"), Date.parse("2026-10-21T20:00:00Z")); assert.equal(etToMs("2026-12-01", "04:00"), Date.parse("2026-12-01T09:00:00Z"));
  assert.equal(verdictOf(-2, 1), "应验"); assert.equal(verdictOf(2, -1), "未应验"); assert.equal(verdictOf(-2, -1), "混合"); assert.equal(verdictOf(null, 1), "无法判断");
});

test("pre: thesis + EPS estimate; after: actual EPS, extra results, after-hours moves; stale quotes are never used", () => {
  const pre = followupLines(followups, {}, at("2026-10-21T11:30:00Z")).join("\n");
  assert.match(pre, /事件跟进：META 财报/); assert.match(pre, /EPS 5\.89/); assert.match(pre, /云 \/ AI 基建（CRWV、NBIS、ORCL）大概率跌，芯片（NVDA、AVGO）涨；不要大赌/); assert.match(pre, /原文：「有点心理准备不要大赌。」/);
  const now = at("2026-10-22T00:00:00Z"); // 20:00 ET
  const inp: FollowupInputs = { earnings: results, quotes: q("2026-10-21T23:50:00Z", { META: [700, 665], CRWV: [80, 74], NBIS: [100, 95], ORCL: [200, 196], NVDA: [180, 183.6], AVGO: [340, 343.4] }),
    extra: { "meta-earnings-2026-10-21": { revenue: 51.2e9, revenueEstimate: 50.4e9, capex: 22.1e9, capexGuide: "2027 显著上调", fcf: 6.3e9, fcfPrior: 10.1e9, source: "公司新闻稿" } } };
  const after = followupLines(followups, inp, now).join("\n");
  assert.match(after, /实际 EPS\*\*：6\.12 vs 预估 5\.89（超预期 \+3\.90%）/);
  assert.match(after, /营收 \$51\.20B（预估 \$50\.40B） · capex \$22\.10B · capex 指引 2027 显著上调 · 自由现金流 \$6\.30B（上一期 \$10\.10B）（公司新闻稿）/);
  assert.match(after, /盘后涨跌\*\*（Robinhood 报价，10 分钟前）：META -5\.00%/); assert.match(after, /CRWV -7\.50%，NBIS -5\.00%，ORCL -2\.00% → 平均 -4\.83%/);
  assert.match(after, /NVDA \+2\.00%，AVGO \+1\.00% → 平均 \+1\.50%/); assert.match(after, /当前方向（仅参考.*）：应验/);
  const noRes = followupLines(followups, { quotes: q("2026-10-21T19:00:00Z", { META: [700, 701] }) }, now).join("\n");
  assert.match(noRes, /实际 EPS\*\*：还没有/); assert.match(noRes, /未提供（Robinhood 只给 EPS/); assert.match(noRes, /报价时间 .* 早于财报公布，不能用/); assert.doesNotMatch(noRes, /META \+/);
  assert.match(followupLines(followups, { quotes: q("2026-10-21T21:00:00Z", { META: [700, 701] }) }, now).join("\n"), /报价已 180 分钟未更新/);
});

test("verdict 10/22 premarket: 应验 / 未应验 / 混合 from basket averages; quotes from last night don't count", () => {
  const now = at("2026-10-22T11:30:00Z"), V = (m: Record<string, [number, number]>, asOf = "2026-10-22T11:20:00Z") => followupLines(followups, { earnings: results, quotes: q(asOf, m) }, now).join("\n");
  assert.match(V({ META: [700, 670], CRWV: [80, 76], NBIS: [100, 97], ORCL: [200, 198], NVDA: [180, 182], AVGO: [340, 341] }), /是否应验（2026-10-22 盘前）\*\*：\*\*应验\*\*/);
  assert.match(V({ META: [700, 730], CRWV: [80, 84], NBIS: [100, 103], ORCL: [200, 201], NVDA: [180, 178], AVGO: [340, 338] }), /\*\*未应验\*\*/);
  assert.match(V({ META: [700, 690], CRWV: [80, 78], NBIS: [100, 99], ORCL: [200, 199], NVDA: [180, 179], AVGO: [340, 339] }), /\*\*混合\*\*/);
  assert.match(V({ META: [700, 670], CRWV: [80, 76] }, "2026-10-22T02:00:00Z"), /早于今天盘前，不能用.*\n[\s\S]*\*\*无法判断\*\*/);
});

test("display only: brief verdict unchanged; alerts CLI only appends markdown (not json, not recorded); nothing else uses it", () => {
  const now = at("2026-10-22T11:30:00Z"), macro = buildMacroReport(new DatabaseSync(":memory:"), [], [], now);
  const parts = { macro, pm: buildPremarket({ now, data: {}, calendar: [], earnings: null, headlines: [], regimeLabel: macro.regime.label }), sc: buildScenarios({ now, data: {}, calendar: [] }) };
  const a = buildBrief({ now, ...parts, calendar: [], followupLines: followupLines(followups, {}, now) }), b = buildBrief({ now, ...parts, calendar: [] });
  assert.equal(a.verdict, b.verdict); assert.deepEqual(a.reasons, b.reasons); assert.match(a.md, /事件跟进：META 财报/); assert.doesNotMatch(b.md, /事件跟进/);
  const al = rd("src/cli/alerts.ts"); assert.match(al, /const fuLines = values\.format === "json" \? \[\] : followupLines/);
  assert.equal(al.split("\n").filter((l) => /fuLines/.test(l)).length, 2, "built once, appended to the markdown body only");
  for (const f of ["src/alerts.ts", "src/macro/risk.ts", "src/macro/scenarios.ts", "src/macro/sleepday.ts", "src/macro/premarket.ts", "src/options/psych.ts"]) assert.doesNotMatch(rd(f), /eventFollowup|followupLines/, f);
});
