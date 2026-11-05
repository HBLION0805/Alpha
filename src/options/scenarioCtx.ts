/**
 * Inputs for the scenario engine from data Alpha already has: ATR(14) and key levels (prior day / week, MA50/200, swing
 * pivots, Fib) from daily bars, the 大佬 levels.json levels for the same symbol, and leg IVs from Robinhood quotes.
 */
import { referenceLevels, type Bar } from "../levels.ts";
import type { LevelEntry } from "../macro/mentorLevels.ts";
import type { ELeg, EngineInput, Levels } from "./scenarioEngine.ts";
import type { JournalEntry } from "./journal.ts";

export function atr14(bars: Array<{ h: number; l: number; c: number }>): number | null {
  if (bars.length < 15) return null;
  const tr = bars.slice(-15).map((b, k, a) => (k === 0 ? null : Math.max(b.h - b.l, Math.abs(b.h - a[k - 1]!.c), Math.abs(b.l - a[k - 1]!.c)))).filter((x): x is number => x != null);
  return tr.reduce((s, x) => s + x, 0) / tr.length;
}
export function keyLevels(sym: string, spot: number, bars: Bar[], mentor: LevelEntry[] = []): Levels {
  const xs: number[] = [], src: string[] = [];
  if (bars.length > 30) { const L = referenceLevels(bars);
    xs.push(...[L.priorDay?.l, L.priorDay?.h, L.week?.l, L.week?.h, L.priorWeek?.l, L.priorWeek?.h, L.sma.ma50, L.sma.ma200].filter((x): x is number => x != null), ...L.pivots.map((p) => p.price), ...(L.fib?.levels.map((f) => f.price) ?? []));
    src.push("前日/周高低、均线、摆动点、Fib"); }
  const m = mentor.flatMap((e) => e.levels).filter((l) => l.series.replace(/^\^/, "").toUpperCase() === sym.toUpperCase()).map((l) => l.level);
  if (m.length) { xs.push(...m); src.push("大佬 levels.json"); }
  const r = (x: number) => Math.round(x * 100) / 100;
  return { supports: xs.filter((x) => x < spot).map(r), resistances: xs.filter((x) => x > spot).map(r), source: src.join(" + ") || undefined };
}
type RhQuote = { underlying: string; type: string; strike: number; expiration: string; iv?: number | null };
/** an open journal entry → engine input (premium = entry fill, IV per leg from Robinhood when present) */
export function entryInput(e: JournalEntry, o: { spot: number; asOf: string; bars?: Bar[]; quotes?: RhQuote[]; mentor?: LevelEntry[]; capUsd: number }): EngineInput | null {
  const legs = (e.legs ?? []).filter((l) => l.type === "stock" || l.expiration) as ELeg[];
  if (!legs.length) return null;
  const withIv = legs.map((l) => { const q = o.quotes?.find((x) => x.underlying === (l as { underlying?: string }).underlying?.toUpperCase?.() || x.underlying === e.symbol)
    && o.quotes?.find((x) => x.underlying === e.symbol && x.type === l.type && x.strike === l.strike && x.expiration === l.expiration); return { ...l, iv: l.iv ?? q?.iv ?? undefined }; });
  const ivs = withIv.map((l) => l.iv).filter((x): x is number => x != null && x > 0);
  return { legs: withIv, spot: o.spot, asOf: o.asOf, iv: ivs.length ? ivs.reduce((a, b) => a + b, 0) / ivs.length : null, atr: o.bars ? atr14(o.bars) : null,
    levels: o.bars ? keyLevels(e.symbol, o.spot, o.bars, o.mentor) : null, capUsd: o.capUsd, label: `${e.id} ${e.symbol} ${e.strategy}` };
}
