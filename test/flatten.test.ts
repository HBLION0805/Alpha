import { test } from "node:test";
import assert from "node:assert/strict";
import { flatten, flattenWindow, ordersToCancel, hhmm } from "../src/paper/flatten.ts";
import { ALPACA_PAPER_BASE, alpacaPaperHttp, type AlpacaHttp, type AlpacaOrder } from "../src/adapters/alpacaPaper.ts";

/** in-memory paper broker: no network */
function fakeBroker(orders: AlpacaOrder[], positions: Array<{ symbol: string; qty: string }>) {
  const calls: string[] = [];
  const http: AlpacaHttp = async (method, path) => {
    calls.push(`${method} ${path}`);
    if (method === "GET" && path.startsWith("orders")) return { status: 200, body: orders };
    if (method === "GET" && path === "positions") return { status: 200, body: positions };
    if (method === "DELETE" && path.startsWith("orders/")) { const id = path.slice(7); const drop = (l: AlpacaOrder[]): AlpacaOrder[] => l.filter((o) => o.id !== id).map((o) => ({ ...o, legs: o.legs ? drop(o.legs) : o.legs }));
      const before = JSON.stringify(orders); orders = drop(orders); return { status: before === JSON.stringify(orders) ? 404 : 204, body: null }; }
    if (method === "DELETE" && path.startsWith("positions/")) { const s = decodeURIComponent(path.slice(10)), n = positions.length; positions = positions.filter((p) => p.symbol !== s); return { status: n === positions.length ? 404 : 200, body: {} }; }
    return { status: 500, body: null };
  };
  return { http, calls, state: () => ({ orders, positions }) };
}
const bracket = (sym: string, id: string): AlpacaOrder => ({ id, symbol: sym, side: "buy", type: "limit", status: "filled", order_class: "bracket",
  legs: [{ id: id + "-tp", symbol: sym, side: "sell", type: "limit", status: "new" }, { id: id + "-sl", symbol: sym, side: "sell", type: "stop", status: "held" }] });
const at1545 = new Date("2026-10-29T19:45:00Z"), noPause = async () => {};

test("flatten window: HH:MM ET with lead; earlier runs are no-ops; late runs still flatten (10/29 RSP was 7 min late)", () => {
  assert.equal(hhmm("15:45"), 945); assert.throws(() => hhmm("25:00"));
  assert.equal(flattenWindow(new Date("2026-10-29T19:30:00Z"), "15:45"), "too_early");
  assert.equal(flattenWindow(new Date("2026-10-29T19:40:00Z"), "15:45"), "run");
  assert.equal(flattenWindow(new Date("2026-10-29T19:52:00Z"), "15:45"), "run");
});

test("orders to cancel: bracket child legs (held stop / new TP) included; filled parent skipped; symbol filter", () => {
  const ids = ordersToCancel([bracket("RSP", "a"), bracket("META", "b")], new Set(["RSP"])).map((o) => o.id);
  assert.deepEqual(ids, ["a-tp", "a-sl"]);
});

test("flatten (fake paper broker): cancels legs before closing; rerun is a no-op; dry-run sends only GETs", async () => {
  const b = fakeBroker([bracket("RSP", "a"), bracket("META", "b")], [{ symbol: "RSP", qty: "10" }, { symbol: "META", qty: "2" }]);
  const dry = await flatten({ http: b.http, now: at1545, before: "15:45", dryRun: true, pause: noPause });
  assert.ok(b.calls.every((c) => c.startsWith("GET")), "dry-run never sends DELETE"); assert.equal(dry.steps.filter((s) => s.action === "cancel").length, 4);
  assert.deepEqual(dry.remainingPositions, ["RSP", "META"]);
  const r = await flatten({ http: b.http, now: at1545, before: "15:45", dryRun: false, pause: noPause });
  assert.ok(r.ok); assert.deepEqual(b.state().positions, []);
  const del = b.calls.filter((c) => c.startsWith("DELETE"));
  assert.ok(del.findIndex((c) => c.startsWith("DELETE positions")) > del.findLastIndex((c) => c.startsWith("DELETE orders")), "all cancels before any close");
  const n = b.calls.length, again = await flatten({ http: b.http, now: at1545, before: "15:45", dryRun: false, pause: noPause });
  assert.ok(again.ok); assert.ok(b.calls.slice(n).every((c) => c.startsWith("GET")), "rerun when flat: no DELETEs");
  const early = await flatten({ http: b.http, now: new Date("2026-10-29T19:00:00Z"), before: "15:45", dryRun: false, pause: noPause });
  assert.equal(early.window, "too_early");
});

test("flatten: symbol filter leaves other positions; stuck position → ok=false (CLI exit 2)", async () => {
  const b = fakeBroker([], [{ symbol: "RSP", qty: "10" }, { symbol: "SPY", qty: "1" }]);
  const r = await flatten({ http: b.http, now: at1545, before: "15:45", symbols: ["rsp"], dryRun: false, pause: noPause });
  assert.ok(r.ok); assert.deepEqual(b.state().positions.map((p) => p.symbol), ["SPY"]);
  const stuck: AlpacaHttp = async (m, p) => (m === "GET" ? { status: 200, body: p === "positions" ? [{ symbol: "RSP", qty: "1" }] : [] } : { status: 403, body: null });
  const s = await flatten({ http: stuck, now: at1545, before: "15:45", dryRun: false, pause: noPause, maxPolls: 2 });
  assert.equal(s.ok, false); assert.deepEqual(s.remainingPositions, ["RSP 1"]);
});

test("Alpaca adapter is paper-only and needs env keys", () => {
  assert.equal(ALPACA_PAPER_BASE, "https://paper-api.alpaca.markets/v2/");
  assert.throws(() => alpacaPaperHttp({}), /ALPACA_KEY/);
});
