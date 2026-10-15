/** npm run volume [-- --out data/out/volume-latest.md] [--no-alarms]. Watchlist: defaults + data/in/watchlist.json (array or {symbols}). Chains: data/in/*-chain.json. */
import { writeFileSync, renameSync, mkdirSync, readFileSync, existsSync, readdirSync } from "node:fs";
import { dirname } from "node:path";
import { parseArgs } from "node:util";
import { Store } from "../store.ts";
import { parseChain, type Chain } from "../options/chain.ts";
import { DEFAULT_WATCHLIST, parseYahooOhlcv, buildVolumeReport, volumeAlarmItems, type Bar } from "../macro/volume.ts";

const { values } = parseArgs({ options: { out: { type: "string", default: "data/out/volume-latest.md" }, "no-alarms": { type: "boolean" }, in: { type: "string", default: "data/in" } } });
const now = new Date();
const extra: string[] = existsSync(`${values.in}/watchlist.json`) ? (() => { const j = JSON.parse(readFileSync(`${values.in}/watchlist.json`, "utf8")); return (Array.isArray(j) ? j : j.symbols ?? []).map(String); })() : [];
const symbols = [...new Set([...DEFAULT_WATCHLIST, ...extra.map((s) => s.toUpperCase())])];
const bars: Record<string, Bar[]> = {}; const failed: Record<string, string> = {};
await Promise.all(symbols.map(async (s) => {
  try {
    const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(s)}?range=3mo&interval=1d`, { headers: { "user-agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(12_000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    let b = parseYahooOhlcv(await r.json());
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
writeFileSync(values.out + ".tmp", res.md); renameSync(values.out + ".tmp", values.out);
process.stdout.write(res.md + "\n");
console.error(`[volume] ${symbols.length} symbols, ${chains.length} chains, ${res.strong.length} strong anomalies, ${Object.keys(failed).length} failed → ${values.out}`);
