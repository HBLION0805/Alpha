import { loadSources } from "../sources.ts";
import { Store } from "../store.ts";
import { fetchFeed, type FetchResult } from "../ingest/rss.ts";
import { readXFile } from "../ingest/xTrump.ts";
import { fetchTruthApi } from "../ingest/truthApi.ts";
import { readTruthFile } from "../ingest/truthTrump.ts";
import { alpacaEnabled, backfillAlpacaNews } from "../ingest/alpacaNewsWs.ts";

const dbPath = process.env.ALPHA_DB ?? "data/alpha-news.sqlite";
const store = new Store(dbPath);
const sources = loadSources().filter((s) => s.enabled || process.argv.includes("--all"));
const t0 = Date.now();
const results = await Promise.all(
  sources.map(async (s) => {
    let r: FetchResult;
    if (s.kind === "alpaca") {
      if (!alpacaEnabled()) return { id: s.id, status: "skipped", items: 0, inserted: 0, ms: 0, error: "ALPACA_KEY/SECRET not set" };
      try {
        const b = await backfillAlpacaNews(new Date(Date.now() - 24 * 3600_000).toISOString());
        r = { sourceId: s.id, status: b.status, notModified: false, items: b.items, ms: b.ms };
        if (b.status !== 200) r.error = `HTTP ${b.status}`;
      } catch (e) {
        r = { sourceId: s.id, status: "error", notModified: false, items: [], ms: 0, error: (e as Error).message };
      }
    } else if (s.kind === "xfile") {
      const t = Date.now(), x = readXFile(s.url, s.id);
      r = { sourceId: s.id, status: x.error ? "error" : 200, notModified: false, items: x.items, ms: Date.now() - t };
      if (x.error) r.error = x.error; else if ((x.ageMin ?? 0) > 90) r.error = `stale: file is ${x.ageMin} min old`;
    } else if (s.kind === "truthfile") { // data/in/truth-trump.json, written by src/cli/trump.ts (official API → mirror)
      const t = Date.now(), x = readTruthFile(s.url, s.id);
      r = { sourceId: s.id, status: x.error ? "error" : 200, notModified: false, items: x.items, ms: Date.now() - t };
      if (x.error) r.error = x.error; else if ((x.ageMin ?? 0) > 90) r.error = `stale: file is ${x.ageMin} min old`;
    } else if (s.kind === "truthapi") { r = await fetchTruthApi(s.id, s.url);
    } else r = await fetchFeed(s, store.feedState(s.id));
    const inserted = r.items.length ? store.insert(r.items, s) : 0;
    const st: Parameters<Store["saveFeedState"]>[1] = { etag: r.etag ?? null, lastModified: r.lastModified ?? null, status: r.notModified ? "304" : String(r.status), count: r.items.length, ms: r.ms };
    if (r.error) st.error = r.error;
    store.saveFeedState(s.id, st);
    return { id: s.id, status: r.notModified ? "304" : r.status, items: r.items.length, inserted, ms: r.ms, error: r.error ?? "" };
  }),
);
console.table(results);
const ok = results.filter((r) => r.items > 0 || r.status === "304").length;
console.log(`polled ${sources.length} feeds in ${Date.now() - t0}ms: ${ok} ok, ${sources.length - ok} failed; inserted ${results.reduce((n, r) => n + r.inserted, 0)} new items → ${dbPath}`);
store.close();
