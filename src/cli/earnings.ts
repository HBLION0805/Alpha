/**
 * npm run earnings [-- --need]: earnings coverage for watchlist + journal + pending-card symbols.
 * --need prints the comma list the routine must look up with Robinhood get_earnings_results (read-only).
 */
import { existsSync, readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { DEFAULT_WATCHLIST } from "../macro/volume.ts";
import { loadEarningsBook, nextEarnings, fmtEarnings, symbolsNeedingEarnings } from "../options/earningsStore.ts";
const { values } = parseArgs({ options: { need: { type: "boolean" } } });
const rd = (f: string) => (existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : null);
const wl = rd("data/in/watchlist.json"), j = rd("data/journal/paper.json"), pc = rd("data/journal/pending-cards.json");
const syms = symbolsNeedingEarnings([...DEFAULT_WATCHLIST, ...(Array.isArray(wl) ? wl : wl?.symbols ?? []),
  ...((j?.entries ?? []) as Array<{ underlying?: string; symbol?: string }>).map((e) => e.underlying ?? e.symbol ?? ""),
  ...((pc?.cards ?? pc ?? []) as Array<{ sym?: string }>).map((c) => c.sym ?? "")]);
if (values.need) { console.log(syms.join(",")); process.exit(0); }
const book = loadEarningsBook(), today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
console.log(`# 财报覆盖（${syms.length} 个标的；per-symbol 获取于 ${book.fetchedAt ?? "从未"}）`);
const missing: string[] = [];
for (const s of syms) { const n = nextEarnings(book, s, today); if (n === undefined) missing.push(s); else console.log(`- ${s}: ${n ? fmtEarnings(n) : "Robinhood 未返回即将到来的财报"}`); }
if (missing.length) console.log(`\n❔ 未查询（缺失）：${missing.join(", ")} → 运行 routine 刷新`);
