/**
 * Daily operational universe (宏观钉死 2026-11-06): the fixed 35-name macro list from knowledge/macro/fixed-watchlist-and-flows.md.
 * Runtime source of truth = data/in/watchlist.json (local; data/ is gitignored). FIXED_UNIVERSE is the committed copy and the fallback
 * when the file is missing. Robinhood personal watchlists (get_watchlists / 自选) never write or override it. Individual stocks enter only
 * via mentor / event-followup / explicit thesis (journal, pending cards) — never as a default mega-cap scan. LEN is the one stock here.
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

/** `dir/watchlist.json` (array or {symbols}, uppercased, deduped) if present, else the fixed 35. Read-only: never writes the file. */
export function loadUniverse(dir = "data/in"): string[] {
  const p = `${dir}/watchlist.json`;
  if (!existsSync(p)) return [...FIXED_UNIVERSE];
  return [...new Set(parseInput(WatchlistSchema, JSON.parse(readFileSync(p, "utf8")), "watchlist.json"))];
}
