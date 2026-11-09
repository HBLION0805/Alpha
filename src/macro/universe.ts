/**
 * Daily operational universe (宏观钉死 2026-11-06): the fixed 35-name macro list from knowledge/macro/fixed-watchlist-and-flows.md.
 * FIXED_UNIVERSE is the only source. data/in/watchlist.json (gitignored) is checked, never trusted: a missing file falls back,
 * an exact match is accepted, a drifted file (including a Robinhood 自选 overwrite) warns and does not override.
 * Individual stocks enter only via mentor / event-followup / explicit thesis (journal, pending cards). LEN is the one stock here.
 */
import { existsSync, readFileSync } from "node:fs";
import { parseInput, WatchlistSchema } from "../adapters/schemas.ts";

export const FIXED_UNIVERSE: readonly string[] = [
  "SPY", "QQQ", "IWM", "DIA", "RSP",
  "TLT", "IEF", "SHY", "UUP", "HYG", "LQD",
  "USO", "UCO", "GLD", "GLDM", "CPER",
  "SMH", "XLK", "XLE", "XLF", "XLI", "XLB", "XLY", "XLP", "XLV", "XLU", "XLRE", "XLC", "IYT", "JETS",
  "EWY", "FXI", "KWEB", "LEN", "KRE",
];
/** Single stocks inside FIXED_UNIVERSE (everything else is an ETF). */
export const UNIVERSE_STOCKS: readonly string[] = ["LEN"];

export interface UniverseLoad {
  symbols: string[];
  /** missing = no file; match = exact FIXED_UNIVERSE; drift = file ignored */
  file: "missing" | "match" | "drift";
  warning: string | null;
}

/** Read-only. Never writes watchlist.json. A drifted file does not replace FIXED_UNIVERSE. */
export function readUniverse(dir = "data/in"): UniverseLoad {
  const p = `${dir}/watchlist.json`;
  if (!existsSync(p)) return { symbols: [...FIXED_UNIVERSE], file: "missing", warning: null };
  let symbols: string[];
  try {
    symbols = [...new Set(parseInput(WatchlistSchema, JSON.parse(readFileSync(p, "utf8")), "watchlist.json"))];
  } catch (e) {
    return { symbols: [...FIXED_UNIVERSE], file: "drift", warning: `[universe] ${p} 无法解析（${(e as Error).message}）→ 不覆盖，仍用固定 35 名单` };
  }
  const same = symbols.length === FIXED_UNIVERSE.length && symbols.every((s, i) => s === FIXED_UNIVERSE[i]);
  if (same) return { symbols: [...symbols], file: "match", warning: null };
  return { symbols: [...FIXED_UNIVERSE], file: "drift", warning: `[universe] ${p} 与固定 35 名单不一致 → 不覆盖，仍用固定名单。Robinhood 自选不得写入该文件。文件为：${symbols.join(" ")}` };
}

/** `dir/watchlist.json` if it exactly matches the fixed 35, else FIXED_UNIVERSE. Warns on drift. Read-only. */
export function loadUniverse(dir = "data/in"): string[] {
  const r = readUniverse(dir);
  if (r.warning) console.error(r.warning);
  return r.symbols;
}
