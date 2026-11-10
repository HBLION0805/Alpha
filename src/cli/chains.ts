/**
 * npm run chains [-- --need | --build | --refresh] [--in data/in]: daily option-chain refresh (Robinhood, READ-ONLY; see docs/ROUTINE_CHAINS.md).
 * Symbols = SPY/QQQ/IWM + every optionable name in the fixed 35 (GLDM dropped as NO_OPTIONS) = 34. Never a 6-name subset.
 * data/in/watchlist.json is checked, not trusted: a drifted file (including Robinhood 自选) warns and does not override FIXED_UNIVERSE.
 *   --need     comma list for the routine to fetch (all 34)
 *   --build    data/in/rh-chain/<SYM>.json (raw MCP pages) → data/in/<sym>-chain.json, one symbol at a time (a failure skips only that symbol)
 *   --refresh  fetch every --need symbol through an injected READ-ONLY source (src/options/chainRefresh.ts), then build.
 *              Node cannot call the Robinhood MCP: the source is a module named by --source or ALPHA_CHAIN_SOURCE that exports
 *              `createChainSource(): ChainSource` (e.g. an MCP bridge the operator runs). No source → exit 2 with the policy.
 *              --concurrency (default 1, max 4) · --delay ms between calls (default 200)
 *   (always) status: asOf per symbol, 过时 when >1 trading day old, 缺失 when no chain
 */
import { existsSync, readFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { parseChain } from "../options/chain.ts";
import { unwrapJson } from "../options/robinhood.ts";
import { chainRefreshSymbols, summarizeBuild, chainFile, chainFreshness, staleLabel } from "../options/freshness.ts";
import { buildChainFromRaw, rawExists, rawStale as isRawStale, refreshOptionChains, summarizeRefresh, type ChainSource } from "../options/chainRefresh.ts";
import { WINDOW_POLICY } from "../options/chainWindow.ts";
import { etDate } from "../macro/nyse.ts";
import { loadUniverse } from "../macro/universe.ts";

const { values } = parseArgs({ options: {
  need: { type: "boolean" }, build: { type: "boolean" }, refresh: { type: "boolean" }, in: { type: "string", default: "data/in" },
  source: { type: "string" }, concurrency: { type: "string", default: "1" }, delay: { type: "string", default: "200" },
} });
const dir = values.in!;
const syms = chainRefreshSymbols(loadUniverse(dir));
if (values.need) { console.log(syms.join(",")); process.exit(0); }

const failed: Record<string, string> = {}, missing: string[] = [], rawStale: string[] = [];
let refreshLines: string[] = [];
if (values.refresh) {
  const src = values.source ?? process.env.ALPHA_CHAIN_SOURCE;
  if (!src) {
    console.error(`[chains] --refresh 需要只读 Robinhood 数据源（MCP 或等价）。Node 无法直接调用 MCP：用 --source <module> 或 ALPHA_CHAIN_SOURCE 指定导出 createChainSource() 的模块，或由 routine 按 docs/ROUTINE_CHAINS.md 逐个抓取后 --build。`);
    console.error(`[chains] need (${syms.length}): ${syms.join(",")}`);
    console.error(`[chains] ${WINDOW_POLICY}`);
    process.exit(2);
  }
  const mod = (await import(pathToFileURL(resolve(src)).href)) as { createChainSource?: () => ChainSource | Promise<ChainSource> };
  if (typeof mod.createChainSource !== "function") { console.error(`[chains] ${src} 未导出 createChainSource()`); process.exit(2); }
  const report = await refreshOptionChains({
    client: await mod.createChainSource(), symbols: syms, dir,
    concurrency: Number(values.concurrency), delayMs: Number(values.delay),
  });
  refreshLines = summarizeRefresh(report);
  for (const [s, e] of Object.entries(report.buildFailed)) failed[s] = e;
  if (Object.keys(report.failed).length || report.noSpot.length) process.exitCode = 1;
} else if (values.build) {
  mkdirSync(dir, { recursive: true });
  for (const s of syms) {
    if (!rawExists(dir, s)) { missing.push(s); continue; }
    try {
      try { if (isRawStale(dir, s)) rawStale.push(s); } catch { /* unreadable: reported by the build below */ }
      buildChainFromRaw(dir, s);
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
for (const l of summarizeBuild(syms.length, missing, rawStale, failed)) console.error(l);
for (const l of refreshLines) console.error(l);
