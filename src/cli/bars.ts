/**
 * npm run bars -- --need --through YYYY-MM-DD [--in data/in]
 *   Comma list of symbols that still need a completed daily bar: file missing, last bar before that session,
 *   or the last bar is a not-yet-closed placeholder / has no volume (do not skip those).
 * npm run bars -- --write SYM [--in data/in]
 *   Read one get_equity_historicals JSON document from stdin and write data/in/<SYM>-bars.json
 *   with interpolated bars and flat zero-volume bars removed. Read-only toward Robinhood; writes a local file only.
 */
import { parseArgs } from "node:util";
import { symbolsNeedingBarsRefresh, writeBarsFile } from "../adapters/bars.ts";
import { chainRefreshSymbols } from "../options/freshness.ts";
import { loadUniverse } from "../macro/universe.ts";

const { values } = parseArgs({ options: {
  need: { type: "boolean" },
  write: { type: "string" },
  through: { type: "string" },
  in: { type: "string", default: "data/in" },
} });

if (values.write) {
  const chunks: Buffer[] = [];
  for await (const c of process.stdin) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
  let json: unknown;
  try { json = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch (e) { console.error(`[bars] --write ${values.write}: ${(e as Error).message}`); process.exit(1); }
  try { console.error(`[bars] wrote ${writeBarsFile(values.write, json, values.in)}`); }
  catch (e) { console.error(`[bars] --write ${values.write}: ${(e as Error).message}`); process.exit(1); }
} else if (values.need) {
  if (!values.through || !/^\d{4}-\d{2}-\d{2}$/.test(values.through)) {
    console.error("usage: npm run bars -- --need --through YYYY-MM-DD [--in data/in]");
    process.exit(2);
  }
  console.log(symbolsNeedingBarsRefresh(chainRefreshSymbols(loadUniverse(values.in)), values.through, values.in).join(","));
} else {
  console.error("usage: npm run bars -- --need --through YYYY-MM-DD | --write SYM");
  process.exit(2);
}
