/** npm run volume [-- --out data/out/volume-latest.md] [--no-alarms]. Watchlist: defaults + data/in/watchlist.json (array or {symbols}). Chains: data/in/*-chain.json
 * (expired contracts dropped; chains >1 trading day old labelled 过时, no alarms). Also writes volume-latest.json with per-chain freshness. */
import { writeFileSync, renameSync, mkdirSync, readFileSync, existsSync, readdirSync } from "node:fs";
import { dirname } from "node:path";
import { parseArgs } from "node:util";
import { yahooDaily } from "../adapters/yahoo.ts";
import { parseInput, WatchlistSchema } from "../adapters/schemas.ts";
import { Store } from "../store.ts";
import { parseChain, type Chain } from "../options/chain.ts";
import { DEFAULT_WATCHLIST, buildVolumeReport, volumeAlarmItems, type Bar } from "../macro/volume.ts";

const { values } = parseArgs({ options: { out: { type: "string", default: "data/out/volume-latest.md" }, "no-alarms": { type: "boolean" }, in: { type: "string", default: "data/in" } } });
const now = new Date();
const extra: string[] = existsSync(`${values.in}/watchlist.json`) ? parseInput(WatchlistSchema, JSON.parse(readFileSync(`${values.in}/watchlist.json`, "utf8")), "watchlist.json") : [];
const symbols = [...new Set([...DEFAULT_WATCHLIST, ...extra.map((s) => s.toUpperCase())])];
const bars: Record<string, Bar[]> = {}; const failed: Record<string, string> = {};
await Promise.all(symbols.map(async (s) => {
  try {
    let b: Bar[] = (await yahooDaily(s, 95)).filter((x) => x.v > 0);
    // only completed sessions: drop today's bar while the US market is open/pre-open
    const today = now.toLocaleDateString("en-CA", { timeZone: "America/New_York" }), hm = Number(now.toLocaleTimeString("en-GB", { timeZone: "America/New_York", hour12: false }).slice(0, 5).replace(":", ""));
    if (b.at(-1)?.t === today && hm < 1615) b = b.slice(0, -1);
    bars[s] = b;
  } catch (e) { failed[`${s} (yahoo)`] = (e as Error).message; }
}));
const chains: Chain[] = [];
if (existsSync(values.in)) for (const f of readdirSync(values.in).filter((x) => x.endsWith("-chain.json")).sort()) {
  try { chains.push(parseChain(JSON.parse(readFileSync(`${values.in}/${f}`, "utf8")))); } catch (e) { failed[`${values.in}/${f}`] = (e as Error).message; }
}
const res = buildVolumeReport({ now, bars, chains, failed });
if (!values["no-alarms"] && res.strong.length) { const st = new Store(process.env.ALPHA_DB ?? "data/alpha-news.sqlite"); st.insert(volumeAlarmItems(res.strong, now), { stance: "center", tier: 2 }, now); st.close(); }
mkdirSync(dirname(values.out), { recursive: true });
const jsonPath = values.out.replace(/\.md$/, "") + ".json"; // chain freshness (stale / asOfDate / droppedExpired) for machines
for (const [p, body] of [[values.out, res.md], [jsonPath, JSON.stringify({ generatedAt: now.toISOString(), chains: res.chains, strong: res.strong, failed: res.failed }, null, 2) + "\n"]] as const) { writeFileSync(p + ".tmp", body); renameSync(p + ".tmp", p); }
process.stdout.write(res.md + "\n");
console.error(`[volume] ${symbols.length} symbols, ${chains.length} chains (${res.chains.filter((c) => c.stale).length} 过时), ${res.strong.length} strong anomalies, ${Object.keys(failed).length} failed → ${values.out}`);
