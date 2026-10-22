import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { liquidityWatch, renderLiquidity, weakeningAt, pointAt, parseCoinbaseCandles, fetchLiquidity, MENTOR_LINE, MENTOR_FILE, LIQ, type LiqData } from "../src/macro/liquidity.ts";
import { liquidityThemeLines, selectReminders, RULES, LIQUIDITY_THEME_RE } from "../src/review/mentor.ts";
import { renderCard, type Card } from "../src/review/card.ts";
import type { Obs } from "../src/macro/fetch.ts";

const root = new URL("../", import.meta.url);
test("archive: byte-for-byte copies (manifest sha256), Howell attribution kept, review anonymous", () => {
  const m = JSON.parse(readFileSync(new URL("knowledge/mentor/macro-liquidity/manifest.json", root), "utf8"));
  assert.equal(m.files.length, 10);
  for (const f of m.files) assert.equal(createHash("sha256").update(readFileSync(new URL(`knowledge/mentor/macro-liquidity/${f.file}`, root))).digest("hex"), f.sha256, f.file);
  const art = readFileSync(new URL("knowledge/mentor/macro-liquidity/howell-2026-10-16-liquidity-cycle.md", root), "utf8");
  assert.match(art, /^# 投资者是否正接近2027年流动性周期的回升阶段？\nMichael Howell｜2026年10月16日/);
  for (let i = 1; i <= 8; i++) assert.ok(art.includes(`(assets/fig${i}.png)`));
  const rev = readFileSync(new URL(MENTOR_FILE, root), "utf8");
  assert.ok(rev.includes(MENTOR_LINE)); assert.match(rev, /作者名已去除/);
  for (const t of ["宏观逻辑不能跳过中间环节，直接变成买单。", "融资条件改善，可以和盈利疲软、衰退风险同时存在。"]) assert.ok(rev.includes(t));
});

// synthetic history: daily 2025-12-01 … 2026-10-16, reserves weekly (Wednesdays)
const days: string[] = []; for (let t = Date.parse("2025-12-01"); t <= Date.parse("2026-10-16"); t += 864e5) days.push(new Date(t).toISOString().slice(0, 10));
const daily = (f: (i: number, d: string) => number): Obs[] => days.map((d, i) => ({ t: d, v: f(i, d) }));
const weds = days.filter((d) => new Date(d).getUTCDay() === 3);
function D(o: { sofrIorb?: (i: number) => number; res?: (k: number) => number; btc?: (i: number) => number; two?: (i: number) => number; move?: (i: number) => number | null } = {}): LiqData {
  const n = days.length;
  return { IORB: daily(() => 3.9), SOFR: daily((i) => 3.9 + (o.sofrIorb?.(i) ?? -0.02)), DGS2: daily((i) => o.two?.(i) ?? 4.8 - 0.002 * (i - n)),
    WRESBAL: weds.map((d, k) => ({ t: d, v: o.res?.(k) ?? 2_900_000 + 5_000 * k })), BTC: daily((i) => o.btc?.(i) ?? 60_000 + 100 * i),
    MOVE: o.move === undefined ? daily((i) => 120 - 0.1 * i) : days.map((d, i) => ({ t: d, v: o.move!(i) })).filter((x): x is Obs => x.v != null) };
}
const today = "2026-10-18";
test("status 顺风确认 only when 逆风减弱 held 4 weekly checkpoints + SOFR−2Y rising + BTC > 200DMA + MOVE not higher", () => {
  const r = liquidityWatch(D(), today);
  assert.equal(r.status, "tailwind", r.why.join("|")); assert.equal(r.label, "顺风确认");
  assert.equal(r.checkpoints.length, 4); assert.ok(r.checkpoints.every((c) => c.ok));
  assert.ok(r.now.btc! > LIQ.btcLine && r.now.btc! > r.now.btcSma! && r.now.res13w! > 0 && r.now.sofrIorb! <= 0);
});
test("逆风减弱（观察）: conditions true now but not sustained / not confirmed; MOVE unavailable can never confirm", () => {
  const n = days.length;
  const recent = liquidityWatch(D({ sofrIorb: (i) => (i > n - 10 ? -0.02 : 0.03) }), today); // SOFR ≤ IORB only for the last ~9 days
  assert.equal(recent.status, "weakening"); assert.match(recent.why.join(), /连续 4 周成立（目前 1\/4）/);
  const noMove = liquidityWatch(D({ move: () => null }), today);
  assert.equal(noMove.status, "weakening"); assert.match(noMove.why.join(), /MOVE 数据（不可用就不能确认）/);
  const flat2y = liquidityWatch(D({ two: () => 4.8 }), today); // SOFR−2Y not rising
  assert.equal(flat2y.status, "weakening"); assert.match(flat2y.why.join(), /SOFR − 2Y 比 4 周前上升/);
});
test("无信号: any core condition false; 数据不足 when a core series is missing; MOVE is not core", () => {
  assert.equal(liquidityWatch(D({ sofrIorb: () => 0.01 }), today).status, "none");
  assert.equal(liquidityWatch(D({ res: (k) => 3_000_000 - 1_000 * k }), today).status, "none");
  const d = D(); delete d.WRESBAL;
  const r = liquidityWatch(d, today); assert.equal(r.status, "insufficient"); assert.equal(r.label, "无信号（数据不足）"); assert.match(r.why[0]!, /WRESBAL/);
  assert.equal(weakeningAt(pointAt({}, today)), null);
});
test("alerts: BTC daily close < $70k (Howell's test) and SOFR−IORB > +0.10pp; an alert blocks 顺风确认", () => {
  const n = days.length;
  const r = liquidityWatch(D({ btc: (i) => (i === n - 1 ? 69_500 : 60_000 + 100 * i) }), today);
  assert.match(r.alerts[0]!, /BTC 日收盘 \$69,500（2026-10-16）跌破 \$70,000/);
  assert.notEqual(r.status, "tailwind");
  const s = liquidityWatch(D({ sofrIorb: (i) => (i === n - 1 ? 0.15 : -0.02) }), today);
  assert.ok(s.alerts.some((x) => /SOFR − IORB = \+0.15pp > \+0.10pp/.test(x))); assert.equal(s.status, "none");
});
test("render: one label, verbatim mentor line, unavailable data marked (never filled)", () => {
  const d = D({ move: () => null }); delete d.MOVE;
  const r = liquidityWatch(d, today), md = renderLiquidity(r, d, { source: {}, errors: { MOVE: "Yahoo ^MOVE: HTTP 404" } }).join("\n");
  assert.match(md, /^## 1\.2 流动性观察/); assert.match(md, /状态：\*\*逆风减弱（观察）\*\*/);
  assert.match(md, /\| MOVE（美债波动率） \| 数据不可用（Yahoo \^MOVE: HTTP 404） \| — \| — \|/);
  assert.ok(md.includes(`「${MENTOR_LINE}」`)); assert.match(md, /不是交易信号/);
});
test("fetch: offline without cache → errors only (no data invented); stale cache used and labelled", async () => {
  const dir = mkdtempSync(join(tmpdir(), "liq-")), cachePath = join(dir, "c.json"), now = new Date("2026-10-18T15:00:00Z");
  const a = await fetchLiquidity({ now, offline: true, cachePath });
  assert.deepEqual(a.data, {}); assert.equal(Object.keys(a.meta.errors).length, 6);
  writeFileSync(cachePath, JSON.stringify({ SOFR: { fetchedAt: "2026-10-17T12:00:00Z", source: "FRED SOFR", obs: [{ t: "2026-10-15", v: 3.89 }] } }));
  const b = await fetchLiquidity({ now, offline: true, cachePath });
  assert.deepEqual(b.data.SOFR, [{ t: "2026-10-15", v: 3.89 }]); assert.match(b.meta.source.SOFR!, /缓存 2026-10-17T12:00Z/);
  assert.deepEqual(parseCoinbaseCandles([[1792281600, 1, 2, 1.5, 81115.14, 9], [1792195200, 1, 2, 1.5, 81378.21, 9]], now), [{ t: "2026-10-17", v: 81378.21 }], "today's (2026-10-18 UTC) forming candle dropped");
  assert.throws(() => parseCoinbaseCandles({ message: "rate" }));
});
test("plan card: liquidity / pivot / rotation thesis → both verbatim mentor lines; other theses → none", () => {
  for (const t of ["流动性拐点，科技股会跑赢", "Fed pivot soon", "降息预期升温", "BTC企稳说明宽松", "sector rotation into small caps"]) assert.ok(LIQUIDITY_THEME_RE.test(t), t);
  assert.deepEqual(liquidityThemeLines("NVDA 财报后放量突破"), []);
  const L = liquidityThemeLines("流动性改善 → 买 QQQ");
  assert.match(L[0]!, /论点提到「流动性」/); assert.ok(L[1]!.includes("「宏观逻辑不能跳过中间环节，直接变成买单。」")); assert.ok(L[2]!.includes("「融资条件改善，可以和盈利疲软、衰退风险同时存在。」"));
  const card = { id: "c1", createdAt: "2026-10-18T15:00:00Z", sym: "QQQ", dir: "bull", verdict: "formal", verdictText: "✅", failing: [], sections: [], macroTheme: L,
    trade: { legs: [], exp: null, contracts: 1, perContractMaxLoss: null, maxLoss: null, planId: null, tpKind: null, invalidationLevel: null, mechanical: null } } as unknown as Card;
  const md = renderCard(card, 500, null); assert.match(md, /导师怎么说（宏观论点 \/ 原油冲击，只提醒）/); assert.ok(md.includes("直接变成买单。」"));
});
test("§1.1 导师提醒: liquidity_chain only when the watch flags something", () => {
  const base = { now: new Date("2026-10-19T11:30:00Z"), verdict: "RESEARCH_OK", leader: "base", previousLeader: "base", regime: "MIXED", previousRegime: "MIXED", events: [], journal: [], capital: 5000 };
  const ids = (liquidity: { status: string; label: string; alerts: string[] } | null) => selectReminders({ ...base, liquidity }).map((r) => r.id);
  assert.ok(ids({ status: "weakening", label: "逆风减弱（观察）", alerts: [] }).includes("liquidity_chain"));
  assert.ok(ids({ status: "none", label: "无信号（中性）", alerts: ["🚨 BTC"] }).includes("liquidity_chain"));
  assert.ok(!ids({ status: "none", label: "无信号（中性）", alerts: [] }).includes("liquidity_chain"));
  assert.ok(!ids(null).includes("liquidity_chain"));
  const line = selectReminders({ ...base, liquidity: { status: "weakening", label: "逆风减弱（观察）", alerts: [] } }).find((r) => r.id === "liquidity_chain")!.line;
  assert.ok(RULES.liquidity_chain!.quotes.some((q) => line.includes(q.text)));
});
