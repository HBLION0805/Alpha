import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseFeed, fetchFeed } from "../src/ingest/rss.ts";
import { parseFomcCalendar, upcoming } from "../src/ingest/officialCalendar.ts";
import { parseAlpacaRest, parseAlpacaStream, alpacaEnabled } from "../src/ingest/alpacaNewsWs.ts";
import { loadSources } from "../src/sources.ts";
import type { Source } from "../src/types.ts";

const fx = (f: string) => readFileSync(new URL(`./fixtures/${f}`, import.meta.url), "utf8");

test("RSS 2.0: CDATA, entities, 2-digit year, skips empty title", async () => {
  const items = await parseFeed(fx("rss2.xml"), "s");
  assert.equal(items.length, 2);
  assert.equal(items[0]!.title, "Fed holds rates steady, Powell signals patience");
  assert.equal(items[0]!.summary, "The Federal Reserve held & signaled.");
  assert.equal(items[0]!.publishedAt, "2026-10-14T18:00:00.000Z");
  assert.equal(items[1]!.title, "Gold hits record as dollar slides – analysts");
  assert.equal(items[1]!.publishedAt, "2026-10-14T17:00:00.000Z");
});

test("Atom: link href and updated", async () => {
  const [a] = await parseFeed(fx("atom.xml"), "sec");
  assert.equal(a!.url, "https://sec.gov/news/1");
  assert.equal(a!.publishedAt, "2026-10-14T15:30:00.000Z");
  assert.equal(a!.guid, "urn:1");
});

test("fetchFeed sends conditional headers and handles 304 / timeout", async () => {
  const src: Source = { id: "x", name: "x", stance: "center", tier: 2, url: "https://x.test/rss", enabled: true };
  let seen: Headers | undefined;
  const f304 = (async (_u: unknown, init?: RequestInit) => {
    seen = new Headers(init?.headers);
    return new Response(null, { status: 304 });
  }) as typeof fetch;
  const r = await fetchFeed(src, { etag: '"abc"', lastModified: "Wed, 14 Oct 2026 00:00:00 GMT" }, 1000, f304);
  assert.equal(seen?.get("if-none-match"), '"abc"');
  assert.equal(seen?.get("if-modified-since"), "Wed, 14 Oct 2026 00:00:00 GMT");
  assert.equal(r.notModified, true);
  const hang = ((_u: unknown, init?: RequestInit) => new Promise((_, rej) => init?.signal?.addEventListener("abort", () => rej(init.signal!.reason)))) as typeof fetch;
  const t = await fetchFeed(src, {}, 50, hang);
  assert.equal(t.status, "timeout");
});

test("FOMC calendar parse incl. month-spanning meeting", () => {
  const ev = parseFomcCalendar(fx("fomc.html"));
  assert.deepEqual(ev.map((e) => e.date), ["2026-11-01", "2026-12-09", "2027-01-27"]);
  assert.equal(ev[0]!.sep, true);
  assert.equal(upcoming(ev, new Date("2026-10-14T00:00:00Z"), 60).length, 2);
});

test("Alpaca REST + stream parsing; disabled without env", () => {
  const r = parseAlpacaRest(JSON.parse(fx("alpaca_rest.json")));
  assert.equal(r.length, 1);
  assert.equal(r[0]!.summary, "BTC up · Symbols: BTCUSD, IBIT");
  assert.equal(parseAlpacaStream([{ T: "success", msg: "authenticated" }, { T: "n", id: 9, headline: "H", url: "https://u", created_at: "2026-10-14T20:00:00Z" }]).length, 1);
  assert.equal(alpacaEnabled({}), false);
});

test("sources.yaml loads; every stance group present", () => {
  const s = loadSources();
  for (const st of ["left", "center", "right", "cn_official", "us_official"]) assert.ok(s.some((x) => x.stance === st && x.enabled), st);
});
