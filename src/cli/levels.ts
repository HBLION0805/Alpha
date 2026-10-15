/** npm run levels -- bars.json [--symbol SPY] [--json] */
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { parseArgs } from "node:util";
import { DEFAULT_LEVELS, computeLevels, parseBars, renderLevels } from "../levels.ts";

const { values, positionals } = parseArgs({ allowPositionals: true, options: { symbol: { type: "string" }, json: { type: "boolean" }, k: { type: "string" }, tol: { type: "string" } } });
const file = positionals[0];
if (!file) {
  console.error("usage: npm run levels -- bars.json [--symbol SPY] [--json] [--k 3] [--tol 0.6]");
  process.exit(2);
}
const raw = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
const bars = parseBars(raw);
const r = computeLevels(bars, { ...DEFAULT_LEVELS, swingK: Number(values.k ?? 3), tolerancePct: Number(values.tol ?? 0.6) });
const found = JSON.stringify(raw).match(/"symbol":"([A-Z.\-]+)"/);
const symbol = values.symbol ?? found?.[1] ?? basename(file, ".json");
process.stdout.write(values.json ? JSON.stringify({ symbol, bars: bars.length, ...r }, null, 2) + "\n" : renderLevels(symbol, r));
