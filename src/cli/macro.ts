/** npm run macro [-- --offline] [--quotes robinhood-quotes.json] [--out data/out/macro-latest.md] */
import { writeFileSync, renameSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import { parseArgs } from "node:util";
import { parseInput, CalendarFileSchema } from "../adapters/schemas.ts";
import { Store } from "../store.ts";
import { clusterItems } from "../cluster.ts";
import { rank } from "../score.ts";
import { refreshMacro, buildMacroReport } from "../macro/build.ts";
import { renderMacro } from "../macro/render.ts";
import { parseRobinhoodQuotes } from "../macro/fetch.ts";
import { fetchReleaseCalendar, type CalendarEvent } from "../ingest/officialCalendar.ts";

const { values } = parseArgs({ options: { offline: { type: "boolean" }, quotes: { type: "string" }, out: { type: "string", default: "data/out/macro-latest.md" } } });
const now = new Date();
const store = new Store(process.env.ALPHA_DB ?? "data/alpha-news.sqlite");
await refreshMacro(store.db, { offline: values.offline ?? false, log: (s) => console.error(s) });
const ranked = rank(clusterItems(store.since(new Date(now.getTime() - 24 * 3600_000).toISOString())), now);
const staticPath = new URL(`../../calendar/releases-${now.getFullYear()}.json`, import.meta.url);
const staticEvents: CalendarEvent[] = existsSync(staticPath) ? (parseInput(CalendarFileSchema, JSON.parse(readFileSync(staticPath, "utf8")), "release calendar").events as CalendarEvent[]) : [];
let calendar = staticEvents;
if (!values.offline) {
  try {
    calendar = (await fetchReleaseCalendar(now.getFullYear(), staticEvents)).events;
  } catch {
    /* static fallback */
  }
}
// Robinhood quotes (MCP output saved to file) override the latest SPY/GLD/BTC price
const overrides: Record<string, number> = {};
if (values.quotes) {
  const q = parseRobinhoodQuotes(JSON.parse(readFileSync(values.quotes, "utf8")));
  for (const [sym, id] of [["SPY", "SPY"], ["GLD", "GLD"], ["BTC", "BTC"], ["BTC-USD", "BTC"]] as const) if (q[sym] !== undefined) overrides[id] = q[sym];
}
const report = buildMacroReport(store.db, ranked, calendar, now, overrides);
store.close();
const md = renderMacro(report);
mkdirSync(dirname(values.out), { recursive: true });
const jsonPath = values.out.replace(/\.md$/, "") + ".json";
for (const [p, body] of [[values.out, md], [jsonPath, JSON.stringify(report, null, 2) + "\n"]] as const) {
  writeFileSync(p + ".tmp", body);
  renameSync(p + ".tmp", p);
}
console.error(`[macro] ${report.regime.label} (${report.regime.confidence}) · overall ${report.risk.overall} → ${values.out}, ${jsonPath}`);
