/** Long-running low-latency ingest: Alpaca websocket → SQLite. Ctrl-C to stop. `--seconds N` to exit after N s. */
import { parseArgs } from "node:util";
import { loadSources } from "../sources.ts";
import { Store } from "../store.ts";
import { ALPACA_SOURCE_ID, startAlpacaNews } from "../ingest/alpacaNewsWs.ts";

const { values } = parseArgs({ options: { seconds: { type: "string" } } });
const src = loadSources().find((s) => s.id === ALPACA_SOURCE_ID);
if (!src) throw new Error("alpaca_benzinga missing from sources.yaml");
const store = new Store(process.env.ALPHA_DB ?? "data/alpha-news.sqlite");
let total = 0;
const h = startAlpacaNews((items, via) => {
  const n = store.insert(items, src);
  total += n;
  for (const i of items) console.log(`${via} ${i.publishedAt} ${i.title}`);
  if (n) console.error(`[alpaca] +${n} new (${total} total)`);
});
if (!h) {
  console.error("ALPACA_KEY / ALPACA_SECRET not set; nothing to stream");
  process.exit(1);
}
const stop = () => {
  h.close();
  store.close();
  console.error(`[alpaca] stopped; inserted ${total}`);
  process.exit(0);
};
process.on("SIGINT", stop);
if (values.seconds) setTimeout(stop, Number(values.seconds) * 1000);
