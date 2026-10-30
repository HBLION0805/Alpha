/** Timed flatten for the Alpaca PAPER account (item 1): cancel open orders (bracket parents + child legs) for the target
 *  symbols, then close their positions. Idempotent — nothing open → nothing done; safe to rerun every minute from an
 *  external scheduler (no local timer script). Dry-run lists what would happen and sends only GETs. */
import type { AlpacaHttp, AlpacaOrder, AlpacaPosition } from "../adapters/alpacaPaper.ts";

/** "15:45" → minutes after midnight ET */
export const hhmm = (s: string) => { const m = /^(\d{1,2}):(\d{2})$/.exec(s); if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) throw new Error(`bad HH:MM: ${s}`); return Number(m[1]) * 60 + Number(m[2]); };
export const etMinutes = (now: Date) => { const [h, m] = now.toLocaleTimeString("en-GB", { timeZone: "America/New_York", hour12: false }).split(":").map(Number); return h! * 60 + m!; };

/** Run window: from `before − leadMin` on. Earlier → "too_early" (exit 0, nothing sent). At/after → flatten (late runs still flatten). */
export function flattenWindow(now: Date, before: string, leadMin = 5): "too_early" | "run" {
  return etMinutes(now) < hhmm(before) - leadMin ? "too_early" : "run";
}

/** Open orders flattened to ids incl. nested legs (cancel children explicitly too: a leg can outlive its parent). */
export function ordersToCancel(orders: AlpacaOrder[], symbols: Set<string> | null): AlpacaOrder[] {
  const out = new Map<string, AlpacaOrder>();
  const walk = (o: AlpacaOrder) => { if (symbols && !symbols.has(o.symbol)) return; if (!["filled", "canceled", "expired", "rejected", "replaced"].includes(o.status ?? "new")) out.set(o.id, o); (o.legs ?? []).forEach(walk); };
  orders.forEach(walk);
  return [...out.values()];
}

export interface FlattenStep { at: string; action: "cancel" | "close" | "check" | "skip"; symbol?: string; id?: string; status: number | "dry-run" | "error"; detail?: string }
export interface FlattenResult { mode: "dry-run" | "live-paper"; window: "too_early" | "run"; steps: FlattenStep[]; remainingPositions: string[]; remainingOrders: string[]; ok: boolean }

export async function flatten(o: { http: AlpacaHttp; now: Date; before: string; leadMin?: number; symbols?: string[]; dryRun: boolean; force?: boolean; pause?: (ms: number) => Promise<void>; settleMs?: number; maxPolls?: number }): Promise<FlattenResult> {
  const mode = o.dryRun ? "dry-run" : "live-paper", window = o.force ? "run" : flattenWindow(o.now, o.before, o.leadMin);
  const steps: FlattenStep[] = [], at = () => new Date().toISOString(), pause = o.pause ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  const sym = o.symbols?.length ? new Set(o.symbols.map((s) => s.toUpperCase())) : null;
  const getOrders = async () => { const r = await o.http("GET", "orders?status=open&nested=true&limit=500"); if (r.status !== 200 || !Array.isArray(r.body)) throw new Error(`GET orders HTTP ${r.status}`); return ordersToCancel(r.body as AlpacaOrder[], sym); };
  const getPositions = async () => { const r = await o.http("GET", "positions"); if (r.status !== 200 || !Array.isArray(r.body)) throw new Error(`GET positions HTTP ${r.status}`); return (r.body as AlpacaPosition[]).filter((p) => !sym || sym.has(p.symbol)); };
  if (window === "too_early") { steps.push({ at: at(), action: "skip", status: "dry-run", detail: `before ${o.before} − ${o.leadMin ?? 5}min` }); return { mode, window, steps, remainingPositions: [], remainingOrders: [], ok: true }; }

  // 1) cancel open orders (brackets + legs) so a stop/TP can't fire against the close
  let orders = await getOrders();
  for (const ord of orders) {
    if (o.dryRun) { steps.push({ at: at(), action: "cancel", symbol: ord.symbol, id: ord.id, status: "dry-run", detail: `${ord.order_class ?? "simple"} ${ord.side ?? ""} ${ord.type ?? ""}`.trim() }); continue; }
    const r = await o.http("DELETE", `orders/${ord.id}`); // 204 ok; 404/422 = already gone/not cancelable → fine on rerun
    steps.push({ at: at(), action: "cancel", symbol: ord.symbol, id: ord.id, status: r.status });
  }
  if (!o.dryRun) for (let i = 0; i < (o.maxPolls ?? 5) && (orders = await getOrders()).length; i++) await pause(o.settleMs ?? 1000);
  // 2) close positions (market) — DELETE positions/{sym} is itself idempotent (404 when already flat)
  const positions = await getPositions();
  for (const p of positions) {
    if (o.dryRun) { steps.push({ at: at(), action: "close", symbol: p.symbol, status: "dry-run", detail: `qty ${p.qty}` }); continue; }
    const r = await o.http("DELETE", `positions/${encodeURIComponent(p.symbol)}`);
    steps.push({ at: at(), action: "close", symbol: p.symbol, status: r.status, detail: `qty ${p.qty}` });
  }
  if (o.dryRun) return { mode, window, steps, remainingPositions: positions.map((p) => p.symbol), remainingOrders: orders.map((x) => x.id), ok: true };
  // 3) verify
  let left = await getPositions();
  for (let i = 0; i < (o.maxPolls ?? 5) && left.length; i++) { await pause(o.settleMs ?? 1000); left = await getPositions(); }
  const leftOrders = await getOrders();
  steps.push({ at: at(), action: "check", status: 200, detail: `positions ${left.length}, open orders ${leftOrders.length}` });
  return { mode, window, steps, remainingPositions: left.map((p) => `${p.symbol} ${p.qty}`), remainingOrders: leftOrders.map((x) => `${x.symbol} ${x.id}`), ok: !left.length && !leftOrders.length };
}
