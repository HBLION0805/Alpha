import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parsePlan, executePlan, confirmTrigger, sizePosition, clientOrderId, type IntradayState, type Candidate } from "../src/paper/executor.ts";
import type { AlpacaHttp, AlpacaOrder, Bar5, BarsFetcher } from "../src/adapters/alpacaPaper.ts";
import type { JournalEntry } from "../src/options/journal.ts";

const plan = parsePlan(readFileSync(new URL("./fixtures/plan-premarket-2026-10-30.md", import.meta.url), "utf8"));
const et = (hm: string) => new Date(`2026-10-30T${hm}:00-04:00`); // 10/30 is still EDT
const bar = (hm: string, o: number, h: number, l: number, c: number): Bar5 => ({ t: et(hm).toISOString(), o, h, l, c });
/** QQQ: OR 09:30–09:45 low 695; 09:45 closes 696 (inside); 09:50 closes 694.5 < OR low → short trigger */
const QQQ_BARS = [bar("09:30", 697, 700, 696, 698), bar("09:35", 698, 699, 695, 696), bar("09:40", 696, 698, 695.5, 697), bar("09:45", 697, 698, 695.2, 696), bar("09:50", 696, 696.5, 694, 694.5)];
const fakeBars = (by: Record<string, Bar5[]>): BarsFetcher & { calls: string[] } => { const calls: string[] = []; const f = (async (s: string) => { calls.push(s); return by[s] ?? []; }) as unknown as BarsFetcher & { calls: string[] }; f.calls = calls; return f; };

/** in-memory Alpaca paper broker: no network */
function fakeBroker(positions: Array<{ symbol: string; qty: string }> = []) {
  const calls: string[] = [], posts: any[] = [], orders = new Map<string, AlpacaOrder>();
  const http: AlpacaHttp = async (method, path, body) => {
    calls.push(`${method} ${path}`);
    if (method === "GET" && path.startsWith("orders:by_client_order_id")) { const id = decodeURIComponent(path.split("=")[1]!); const o = orders.get(id); return o ? { status: 200, body: o } : { status: 404, body: { message: "order not found" } }; }
    if (method === "GET" && path.startsWith("orders")) return { status: 200, body: [...orders.values()] }; // ordersToCancel drops filled/canceled itself
    if (method === "GET" && path === "positions") return { status: 200, body: positions };
    if (method === "POST" && path === "orders") { const b = body as any; posts.push(b); if (orders.has(b.client_order_id)) return { status: 422, body: { message: "client_order_id must be unique" } };
      const o: AlpacaOrder = { id: `ord-${orders.size + 1}`, client_order_id: b.client_order_id, symbol: b.symbol, side: b.side, type: b.type, status: "new", order_class: "bracket", filled_qty: "0", filled_avg_price: null,
        legs: [{ id: `ord-${orders.size + 1}-tp`, symbol: b.symbol, status: "held" }, { id: `ord-${orders.size + 1}-sl`, symbol: b.symbol, status: "held" }] };
      orders.set(b.client_order_id, o); return { status: 200, body: o }; }
    if (method === "DELETE" && path.startsWith("orders/")) { const id = path.slice(7); for (const o of orders.values()) for (const x of [o, ...(o.legs ?? [])]) if (x.id === id) x.status = "canceled"; return { status: 204, body: null }; }
    if (method === "DELETE" && path.startsWith("positions/")) { const s = decodeURIComponent(path.slice(10)); positions = positions.filter((p) => p.symbol !== s); return { status: 200, body: {} }; }
    return { status: 500, body: null };
  };
  return { http, calls, posts, orders, fill: (cid: string, px: number) => { const o = orders.get(cid)!; Object.assign(o, { status: "filled", filled_qty: o.legs ? String(posts.find((p) => p.client_order_id === cid).qty) : "0", filled_avg_price: String(px), filled_at: et("09:56").toISOString() }); positions.push({ symbol: o.symbol, qty: "-" + o.filled_qty }); },
    writes: () => calls.filter((c) => !c.startsWith("GET")) };
}
const noPause = async () => {};
const run = (b: ReturnType<typeof fakeBroker>, now: Date, o: { state?: IntradayState | null; ledger?: JournalEntry[]; dryRun?: boolean; bars?: Record<string, Bar5[]> } = {}) =>
  executePlan({ http: b.http, bars: fakeBars(o.bars ?? { QQQ: QQQ_BARS }), now, plan, planPath: "test/fixtures/plan-premarket-2026-10-30.md", state: o.state ?? null, ledger: o.ledger ?? [], equity: 5000, dryRun: !!o.dryRun, pause: noPause });

test("parse 10/30 plan: tradeable rows, triggers, stops, targets; 不建议交易 / 不做空 group / 无数据 skipped", () => {
  assert.equal(plan.date, "2026-10-30");
  const by = Object.fromEntries(plan.candidates.map((c) => [c.symbol, c]));
  assert.deepEqual(plan.candidates.filter((c) => !c.skip).map((c) => c.symbol), ["AMZN", "QQQ", "NVDA", "AVGO", "DELL", "ORCL", "CRWV", "COIN", "IWM"]);
  assert.ok(plan.candidates.every((c) => c.side === "short"));
  assert.deepEqual({ ...by.AMZN, group: "" }, { symbol: "AMZN", side: "short", group: "", rule: by.AMZN!.rule, premarket: 226.25, zone: { low: 232, high: 236 }, breakLevel: null, orBreak: true, stop: 241.24, stopText: by.AMZN!.stopText, target1: 225.55, target2: null });
  assert.deepEqual([by.QQQ!.zone, by.QQQ!.orBreak, by.QQQ!.stop, by.QQQ!.target1, by.QQQ!.target2], [{ low: 701, high: 706 }, true, 706, 685.82, 657.56]);
  assert.deepEqual([by.IWM!.breakLevel, by.IWM!.orBreak, by.IWM!.stop, by.IWM!.target1], [282.15, true, 284.5, 276]);
  assert.deepEqual([by.NVDA!.zone, by.NVDA!.orBreak, by.NVDA!.stop], [{ low: 210.18, high: 210.18 }, false, 212.1]);
  assert.deepEqual([by.ORCL!.target1, by.AVGO!.stop, by.DELL!.stop], [123.75, 339, 440]);
  assert.equal(by.INTC!.skip, "不建议交易");
  assert.match(by.XOM!.skip!, /分组不交易/); assert.match(by.GLD!.skip!, /分组不交易/);
  for (const s of ["VRT", "IBIT", "MSTR"]) assert.equal(by[s]!.skip, "目标1无数据");
});

test("trigger rules on 5m bars: OR break, rally-into-zone failure, stop-first invalidation; incomplete bar ignored", () => {
  const qqq = plan.candidates.find((c) => c.symbol === "QQQ")!;
  assert.equal(confirmTrigger(qqq, QQQ_BARS, et("09:54")).trigger, null, "09:50 bar not complete yet");
  const t = confirmTrigger(qqq, QQQ_BARS, et("10:00"));
  assert.deepEqual([t.or, t.trigger?.price, t.trigger?.at], [{ high: 700, low: 695 }, 694.5, et("09:50").toISOString()]);
  const nvda: Candidate = plan.candidates.find((c) => c.symbol === "NVDA")!;
  const z = [bar("09:30", 208, 209, 207, 208.5), bar("09:45", 208.5, 209.5, 208, 209), bar("09:50", 209, 210.5, 209, 210.4), bar("09:55", 210.4, 210.6, 209.5, 209.8)];
  assert.match(confirmTrigger(nvda, z, et("10:05")).trigger!.how, /反弹至 210.18-210.18 失败/);
  assert.equal(confirmTrigger(nvda, z.slice(0, 2), et("10:05")).trigger, null, "no rally into the zone → no trigger");
  assert.match(confirmTrigger(nvda, [z[0]!, bar("09:45", 209, 213, 209, 212.5), z[3]!], et("10:05")).invalidated!, /越过止损 212.1/);
});

test("sizing: floor(risk/|entry−stop|), risk clamped to $25–$100", () => {
  assert.deepEqual(sizePosition(694.5, 706, 50), { shares: 4, perShare: 11.5, riskUsd: 46, riskPerTrade: 50 });
  assert.equal(sizePosition(694.5, 706, 500).riskPerTrade, 100); assert.equal(sizePosition(100, 101, 5).shares, 25);
  assert.equal(sizePosition(200, 260, 50).shares, 0);
  assert.equal(clientOrderId("2026-10-30", "qqq", "short"), "alpha-20261030-QQQ-short");
});

test("before 09:45 ET: noop, no broker or data calls, nothing persisted", async () => {
  const b = fakeBroker(), r = await run(b, et("09:44"));
  assert.equal(r.phase, "too_early"); assert.deepEqual(b.calls, []); assert.equal(r.persist, false);
});

test("trigger confirmed → one bracket (size, TP/SL, client_order_id); rerun never double-submits; fill → formal ledger entry", async () => {
  const b = fakeBroker(), r = await run(b, et("10:00"));
  assert.equal(r.phase, "entry"); assert.equal(b.posts.length, 1);
  assert.deepEqual(b.posts[0], { symbol: "QQQ", qty: "4", side: "sell", type: "limit", time_in_force: "day", limit_price: "694.50", order_class: "bracket",
    take_profit: { limit_price: "685.82" }, stop_loss: { stop_price: "706.00" }, client_order_id: "alpha-20261030-QQQ-short" });
  assert.equal(r.state.riskUsedUsd, 46); assert.equal(r.state.riskCapUsd, 500); assert.equal(r.state.opened[0]!.status, "submitted"); assert.equal(r.persist, true);
  assert.deepEqual(r.ledgerAdds, [], "not executed yet → nothing in the ledger");
  // rerun with the saved state, and a rerun with the state file lost: both see the existing order, no new POST
  const again = await run(b, et("10:05"), { state: r.state });
  assert.equal(b.posts.length, 1); assert.ok(again.actions.some((a) => a.symbol === "QQQ" && a.action === "skip" && /今日已下单/.test(a.detail)));
  const lost = await run(b, et("10:05"));
  assert.equal(b.posts.length, 1); assert.ok(lost.actions.some((a) => a.symbol === "QQQ" && a.action === "exists"));
  // fill → kind=formal ledger entry with the broker fill
  b.fill("alpha-20261030-QQQ-short", 694.4);
  const f = await run(b, et("10:10"), { state: again.state });
  assert.equal(f.ledgerAdds.length, 1); const e = f.ledgerAdds[0]!;
  assert.deepEqual([e.id, e.kind, e.mode, e.symbol, e.strategy, e.legs, e.maxLoss, e.entryPriceSource], ["qqq-stock-short-2026-10-30-paper", "formal", "paper", "QQQ", "stock_short",
    [{ underlying: "QQQ", type: "stock", strike: 694.4, qty: -4, premium: 694.4 }], 46.4, "broker"]);
  assert.equal(f.state.opened[0]!.ledgerId, e.id); assert.equal(f.state.riskUsedUsd, 46.4); assert.equal(b.posts.length, 1);
  const g = await run(b, et("10:15"), { state: f.state, ledger: [e] });
  assert.deepEqual(g.ledgerAdds, []); assert.equal(g.usedUsd, 46.4, "own ledger entry not double-counted");
});

test("daily cap: state risk or hand-logged ledger risk leaves too little room → skip, no POST", async () => {
  const b = fakeBroker(), st: IntradayState = { date: "2026-10-30", riskCapUsd: 500, riskUsedUsd: 480, opened: [], closed: [], watch: [] };
  const r = await run(b, et("10:00"), { state: st });
  assert.equal(b.posts.length, 0); assert.ok(r.actions.some((a) => a.symbol === "QQQ" && a.action === "skip" && /当日剩余额度 \$20/.test(a.detail)));
  const hand = { id: "iwm-stock-short-2026-10-30-paper", mode: "paper", kind: "formal", openedAt: et("09:50").toISOString(), symbol: "IWM", maxLoss: 470, stop: ">284.5" } as unknown as JournalEntry;
  const r2 = await run(b, et("10:00"), { ledger: [hand] });
  assert.equal(b.posts.length, 0); assert.equal(r2.usedUsd, 470);
});

test("15:20 ET cutoff: triggered setup but no new position", async () => {
  const b = fakeBroker(), r = await run(b, et("15:25"));
  assert.equal(r.phase, "cutoff"); assert.equal(b.posts.length, 0); assert.deepEqual(b.writes(), []);
});

test("15:45 ET: flatten cancels bracket legs and closes plan positions; opened marked flattened", async () => {
  const b = fakeBroker(), r = await run(b, et("10:00")); b.fill("alpha-20261030-QQQ-short", 694.5);
  const f = await run(b, et("15:46"), { state: r.state });
  assert.equal(f.phase, "flatten"); assert.ok(f.flatten?.ok);
  assert.ok(b.calls.includes("DELETE orders/ord-1-tp") && b.calls.includes("DELETE orders/ord-1-sl") && b.calls.includes("DELETE positions/QQQ"));
  assert.equal(f.ledgerAdds.length, 1, "fill synced before the flatten");
  assert.equal(f.state.opened[0]!.status, "flattened"); assert.equal(f.state.closed.length, 1); assert.equal(b.posts.length, 1);
});

test("dry-run: only GETs, nothing persisted, would-submit listed", async () => {
  const b = fakeBroker(), r = await run(b, et("10:00"), { dryRun: true });
  assert.deepEqual(b.writes(), []); assert.equal(r.persist, false); assert.equal(r.mode, "dry-run");
  assert.ok(r.actions.some((a) => a.symbol === "QQQ" && a.action === "submit" && a.status === "dry-run"));
  const b2 = fakeBroker([{ symbol: "QQQ", qty: "-4" }]), fl = await run(b2, et("15:50"), { dryRun: true });
  assert.deepEqual(b2.writes(), []); assert.equal(fl.persist, false);
});

test("execute CLI (review #29): dry-run by default, --confirm to send, --dry-run always wins", async () => {
  const { executeDryRun } = await import("../src/paper/executor.ts");
  assert.equal(executeDryRun({}), true); assert.equal(executeDryRun({ confirm: true }), false);
  assert.equal(executeDryRun({ confirm: true, "dry-run": true }), true); assert.equal(executeDryRun({ "dry-run": true }), true);
});
