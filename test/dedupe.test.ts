import { test } from "node:test";
import assert from "node:assert/strict";
import { Store } from "../src/store.ts";
import { normalizeTitle, normalizeUrl } from "../src/normalize.ts";

test("normalizeUrl strips tracking, www, hash, trailing slash", () => {
  assert.equal(normalizeUrl("http://WWW.Example.com/a/?utm_source=x&b=2&a=1#top"), "https://example.com/a?a=1&b=2");
});

test("normalizeTitle strips outlet suffix and punctuation", () => {
  assert.equal(normalizeTitle("Fed Holds Rates — Reuters"), "fed holds rates");
  assert.equal(normalizeTitle("Fed holds rates!"), "fed holds rates");
});

test("store dedupes by URL and by normalized title within window", () => {
  const s = new Store(":memory:");
  const src = { stance: "center" as const, tier: 2 as const };
  const base = { sourceId: "a", summary: "", publishedAt: "2026-10-14T12:00:00Z" };
  assert.equal(s.insert([{ ...base, title: "Fed holds rates", url: "https://ex.com/1?utm_source=a" }], src), 1);
  assert.equal(s.insert([{ ...base, title: "Different", url: "https://www.ex.com/1" }], src), 0, "same URL");
  assert.equal(s.insert([{ ...base, sourceId: "b", title: "Fed Holds Rates - CNBC", url: "https://cnbc.com/2" }], src), 0, "same title");
  assert.equal(s.insert([{ ...base, title: "Fed holds rates", url: "https://ex.com/3", publishedAt: "2026-10-20T12:00:00Z" }], src), 1, "outside window");
  assert.equal(s.since("2026-01-01").length, 2);
  s.close();
});
