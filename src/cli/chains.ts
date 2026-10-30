/**
 * npm run chains [-- --need | --build] [--in data/in]: daily option-chain refresh (Robinhood, READ-ONLY; see docs/ROUTINE_CHAINS.md).
 * Symbols = SPY/QQQ/IWM + every optionable symbol in data/in/watchlist.json (no hardcoded list).
 *   --need   comma list for the routine to fetch
 *   --build  data/in/rh-chain/<SYM>.json (raw MCP pages) → data/in/<sym>-chain.json, one symbol at a time (a failure skips only that symbol)
 *   (always) status: asOf per symbol, 过时 when >1 trading day old, 缺失 when no chain
 */
import { existsSync, readFileSync, writeFileSync, renameSync, mkdirSync } from "node:fs";
import { parseArgs } from "node:util";
import { parseInput, WatchlistSchema } from "../adapters/schemas.ts";
import { parseChain } from "../options/chain.ts";
import { chainFromRobinhood, unwrapJson } from "../options/robinhood.ts";
import { chainRefreshSymbols, chainFile, chainFreshness, staleLabel } from "../options/freshness.ts";
import { etDate } from "../macro/nyse.ts";

const { values } = parseArgs({ options: { need: { type: "boolean" }, build: { type: "boolean" }, in: { type: "string", default: "data/in" } } });
const dir = values.in!, wlPath = `${dir}/watchlist.json`;
const syms = chainRefreshSymbols(existsSync(wlPath) ? parseInput(WatchlistSchema, JSON.parse(readFileSync(wlPath, "utf8")), "watchlist.json") : []);
if (values.need) { console.log(syms.join(",")); process.exit(0); }

const failed: Record<string, string> = {};
if (values.build) {
  mkdirSync(dir, { recursive: true });
  for (const s of syms) {
    const raw = `${dir}/rh-chain/${s}.json`;
    if (!existsSync(raw)) { failed[s] = `no ${raw} (routine did not fetch it)`; continue; }
    try {
      const r = unwrapJson(readFileSync(raw, "utf8")) as { spot?: number; fetchedAt?: string; instruments?: unknown[]; quotes?: unknown[] };
      if (!(Number(r.spot) > 0)) throw new Error("spot missing");
      const ch = chainFromRobinhood(r.instruments ?? [], r.quotes ?? [], s, Number(r.spot), r.fetchedAt);
      if (!ch.contracts.length) throw new Error("no contracts joined (instruments × quotes)");
      const out = chainFile(s, dir);
      writeFileSync(out + ".tmp", JSON.stringify(ch, null, 1)); renameSync(out + ".tmp", out);
    } catch (e) { failed[s] = (e as Error).message; }
  }
}

const today = etDate(new Date());
console.log(`# 期权链刷新状态（${syms.length} 个标的，今天 ${today} ET）`);
for (const s of syms) {
  const f = chainFile(s, dir);
  if (!existsSync(f)) { console.log(`- ${s}: ❔ 缺失 ${f}`); continue; }
  try {
    const ch = parseChain(unwrapJson(readFileSync(f, "utf8"))), fr = chainFreshness(ch.asOf, today);
    console.log(`- ${s}: ${fr.stale ? `⚠️ ${staleLabel({ ...fr, droppedExpired: 0 })}` : `✅ asOf ${fr.asOfDate}`} · ${ch.contracts.length} 合约`);
  } catch (e) { console.log(`- ${s}: ❌ ${f} 无法解析: ${(e as Error).message}`); }
}
for (const [s, e] of Object.entries(failed)) console.error(`[chains] ${s} build failed: ${e}`);
