/**
 * npm run levels -- bars.json [--symbol SPY] [--json]        (file mode: scored S/R zones)
 * npm run levels -- --tickers SPY,QQQ,IWM [--in data/in] [--out data/out/levels-latest.md]
 *   (reference mode: data/in/<T>-bars.json from Robinhood get_equity_historicals, Yahoo fallback → prior day, weekly, SMA, pivots, Fib)
 */
import { readFileSync, writeFileSync, renameSync, mkdirSync } from "node:fs";
import { basename, dirname } from "node:path";
import { parseArgs } from "node:util";
import { DEFAULT_LEVELS, computeLevels, parseBars, renderLevels, referenceLevels, renderReferenceLevels } from "../levels.ts";
import { loadDailyBars } from "../adapters/bars.ts";

const { values, positionals } = parseArgs({ allowPositionals: true, options: { symbol: { type: "string" }, json: { type: "boolean" }, k: { type: "string" }, tol: { type: "string" }, tickers: { type: "string" }, in: { type: "string", default: "data/in" }, out: { type: "string" } } });
if (values.tickers) {
  const parts: string[] = [`# 参考价位 Levels — ${new Date().toLocaleString("en-CA", { timeZone: "America/New_York", hour12: false })} ET`, ""];
  for (const t of values.tickers.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)) {
    try {
      const r = await loadDailyBars(t, values.in);
      parts.push(renderReferenceLevels(t, referenceLevels(r.bars, Number(values.k ?? 3)), r.source === "robinhood" ? "Robinhood" : `Yahoo（${r.note}）`));
    } catch (e) { parts.push(`## ${t}\n- ❌ ${(e as Error).message}\n`); }
  }
  const md = parts.join("\n");
  if (values.out) { mkdirSync(dirname(values.out), { recursive: true }); writeFileSync(values.out + ".tmp", md); renameSync(values.out + ".tmp", values.out); }
  process.stdout.write(md);
} else {
  const file = positionals[0];
  if (!file) { console.error("usage: npm run levels -- bars.json [--symbol SPY] | --tickers SPY,QQQ [--out file]"); process.exit(2); }
  const raw = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
  const bars = parseBars(raw);
  const r = computeLevels(bars, { ...DEFAULT_LEVELS, swingK: Number(values.k ?? 3), tolerancePct: Number(values.tol ?? 0.6) });
  const found = JSON.stringify(raw).match(/"symbol":"([A-Z.\-]+)"/);
  const symbol = values.symbol ?? found?.[1] ?? basename(file, ".json");
  process.stdout.write(values.json ? JSON.stringify({ symbol, bars: bars.length, ...r }, null, 2) + "\n" : renderLevels(symbol, r));
}
