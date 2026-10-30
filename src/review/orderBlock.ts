/** Plan card → ready-to-submit Alpaca PAPER order block + same-day risk reservation (item 5: on 10/29 the MRVL open was
 *  late because the order had to be written by hand and the budget wasn't held). Pure; nothing here sends an order. */
import type { CardLeg } from "./card.ts";
import type { JournalEntry } from "../options/journal.ts";

const r2 = (x: number) => Math.round(x * 100) / 100;
const etDay = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "America/New_York" });

/** OCC option symbol: ROOT + YYMMDD + C/P + strike×1000 (8 digits), e.g. MRVL261120C00247500 (Alpaca format, no padding). */
export function occSymbol(root: string, exp: string, type: "call" | "put", strike: number): string {
  return `${root.toUpperCase()}${exp.slice(2, 4)}${exp.slice(5, 7)}${exp.slice(8, 10)}${type === "call" ? "C" : "P"}${String(Math.round(strike * 1000)).padStart(8, "0")}`;
}

export interface OrderBlock { endpoint: string; body: Record<string, unknown>; note: string }
/** Opening order for a card's priced legs: 1 leg → simple limit; 2+ legs → Alpaca multi-leg (`order_class: mleg`) at the net mid.
 *  null (with reason) when legs/quotes/contracts are missing. client_order_id = card id → a resubmit is rejected as a duplicate. */
export function cardOrderBlock(c: { id: string; sym: string; trade: { legs: CardLeg[]; contracts: number } }): OrderBlock | { reason: string } {
  const { legs, contracts } = c.trade;
  if (!legs.length) return { reason: "无期权腿（股票卡请用括号单：止损 = 失效位）" };
  if (contracts < 1) return { reason: "合约数 0（预算不足）" };
  if (legs.some((l) => l.mid == null)) return { reason: "有腿缺报价 → 无限价" };
  const net = r2(legs.reduce((s, l) => s + l.qty * l.mid!, 0)); // >0 debit, <0 credit
  const base = { qty: String(contracts), type: "limit", time_in_force: "day", limit_price: Math.abs(net).toFixed(2), client_order_id: `card-${c.id}` };
  const leg = (l: CardLeg) => ({ symbol: occSymbol(c.sym, l.expiration, l.type, l.strike), side: l.qty > 0 ? "buy" : "sell", position_intent: l.qty > 0 ? "buy_to_open" : "sell_to_open", ratio_qty: String(Math.abs(l.qty)) });
  const body = legs.length === 1 ? { ...base, symbol: leg(legs[0]!).symbol, side: leg(legs[0]!).side, position_intent: leg(legs[0]!).position_intent }
    : { ...base, order_class: "mleg", legs: legs.map(leg) };
  return { endpoint: "POST https://paper-api.alpaca.markets/v2/orders", body, note: `${net >= 0 ? "净付" : "净收"} $${Math.abs(net)} × ${contracts} 张（中间价；成交差可小幅调价，不超过卡上最大亏损）` };
}

export function renderOrderBlock(b: OrderBlock | { reason: string }): string[] {
  if ("reason" in b) return ["## 下单块（Alpaca 模拟盘）", `- 无法生成：${b.reason}`, ""];
  return ["## 下单块（Alpaca 模拟盘，复制即可提交；本工具不会自动下单）", `- ${b.endpoint} · ${b.note}`, "```json", JSON.stringify(b.body, null, 2), "```", ""];
}

/** Saved-but-unopened cards from today hold their max loss against the daily new-risk cap until opened (journal entry with cardId) or the day ends. */
export interface PendingCard { id: string; createdAt: string; verdict?: string; trade?: { maxLoss?: number | null } | null }
export function reservedRiskUsd(cards: PendingCard[], journal: Pick<JournalEntry, "cardId">[], now: Date, excludeId?: string): { usd: number; ids: string[] } {
  const today = etDay(now), opened = new Set(journal.map((e) => e.cardId).filter(Boolean));
  const held = cards.filter((c) => c.id !== excludeId && c.verdict !== "no" && !opened.has(c.id) && etDay(new Date(c.createdAt)) === today && (c.trade?.maxLoss ?? 0) > 0);
  return { usd: r2(held.reduce((s, c) => s + c.trade!.maxLoss!, 0)), ids: held.map((c) => c.id) };
}
