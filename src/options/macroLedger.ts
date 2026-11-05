/**
 * 宏观单 (user 2026-10-22): mentor trades the user forwards. Separate ledger category: source=mentor_shadow, kind=practice,
 * category=macro → excluded from the formal 30-trade readiness count; still counts toward the daily loss cap like other simulated trades.
 * CLI: npm run paper -- macro-open --symbol GDX --strategy call_debit_spread --dir bullish --max-loss 100 --thesis "…" [--stop "…"] [--legs '[…]'] [--note "…"]
 */
import type { JournalEntry } from "./journal.ts";

export const isMacro = (e: Pick<JournalEntry, "source" | "category">) => e.category === "macro" || e.source === "mentor_shadow";
export interface MacroArgs { symbol?: string; strategy?: string; dir?: string; maxLoss?: number; thesis?: string; stop?: string; legs?: string; note?: string; now: Date }

export function macroEntry(a: MacroArgs, existing: JournalEntry[]): { entry?: JournalEntry; refused: string[] } {
  const refused: string[] = [];
  if (!a.symbol) refused.push("缺少 --symbol");
  if (!a.strategy) refused.push("缺少 --strategy");
  if (!a.dir) refused.push("缺少 --dir（bullish|bearish|…）");
  if (!(a.maxLoss! > 0)) refused.push("缺少 --max-loss（定义风险，正数）");
  if (!a.thesis?.trim()) refused.push("缺少 --thesis（大佬的论点，照录）");
  let legs: unknown[] = [];
  if (a.legs) { try { legs = JSON.parse(a.legs); if (!Array.isArray(legs)) throw 0; } catch { refused.push("--legs 必须是 JSON 数组"); } }
  // normalize to the journal leg shape used by paper mark / legs: expiry → expiration; side "short" → negative qty
  legs = legs.map((l) => { const x = { ...(l as Record<string, unknown>) }; if (x.expiry && !x.expiration) { x.expiration = x.expiry; delete x.expiry; }
    if (x.side === "short" && Number(x.qty) > 0) x.qty = -Number(x.qty); return x; });
  if (refused.length) return { refused };
  const day = a.now.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  let id = `macro-${a.symbol!.toLowerCase()}-${a.strategy!.replace(/_/g, "-")}-${day}`;
  for (let n = 2; existing.some((e) => e.id === id); n++) id = `macro-${a.symbol!.toLowerCase()}-${a.strategy!.replace(/_/g, "-")}-${day}-${n}`;
  const entry = { id, openedAt: a.now.toISOString(), symbol: a.symbol!.toUpperCase(), strategy: a.strategy!, kind: "practice", source: "mentor_shadow", category: "macro", mode: "paper",
    dir: a.dir, view: { direction: a.dir!, volatility: "n/a" }, ivRank: null, greeks: { delta: 0, gamma: 0, theta: 0, vega: 0 }, expectedMove: null,
    structureRationale: `宏观单（用户转发的大佬交易）${a.note ? `：${a.note}` : ""}`, maxLoss: a.maxLoss!, thesis: a.thesis!, stop: a.stop ?? "not recorded at entry",
    invalidation: a.stop ?? "not recorded at entry", exitRules: a.stop ? [`stop: ${a.stop}`] : [], legs } as unknown as JournalEntry;
  return { entry, refused: [] };
}

/** One-time migration: existing mentor_shadow entries get category=macro (idempotent). Returns ids changed. */
export function migrateMacro(entries: JournalEntry[]): string[] {
  const out: string[] = []; for (const e of entries) if (e.source === "mentor_shadow" && e.category !== "macro") { e.category = "macro"; out.push(e.id); } return out;
}
