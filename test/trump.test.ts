import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseFeed } from "../src/ingest/rss.ts";
import { parseXPosts } from "../src/ingest/xTrump.ts";
import { scoreTrumpPost, trumpAlerts, fullText, TRUMP_NOTE } from "../src/trump.ts";
import { renderAlertsMarkdown } from "../src/alerts.ts";
import { loadSources } from "../src/sources.ts";

const sc = (t: string) => scoreTrumpPost(t)?.score ?? null;

test("trump scoring: ≥85 for tariff/Fed/war actions, ≥70 direct market topics, null for non-market", () => {
  assert.ok(sc("Starting November 1st, China will be charged a 100% Tariff on all goods.")! >= 85);
  assert.ok(sc("Jerome 'Too Late' Powell should be fired immediately. We need a new Fed Chairman!")! >= 85);
  assert.ok(sc("I have ordered strikes on military targets in Venezuela tonight.")! >= 85);
  assert.ok(sc("We will begin a naval blockade of Iran's oil ports.")! >= 85);
  for (const t of ["Bitcoin is doing great, America will be the crypto capital!", "Intel is a great company, the U.S. now owns 10%!", "The Houthis, backed by Iran, are hitting Saudi Arabia to drive up Oil prices", "Sanctions on Russian oil companies take effect today"])
    { const s = sc(t); assert.ok(s != null && s >= 70 && s < 95, `${t} → ${s}`); }
  for (const t of ["Jon Husted has my Complete and Total Endorsement! GET OUT AND VOTE", "The Failing New York Times and Fake News CNN are at it again", "Heading to Montana for a PACKED HOUSE rally", "The Ballroom and Military Complex is on time and on budget", "Image post from October 15, 2026", "https://t.co/74FFzwQqx6"])
    assert.equal(sc(t), null, t);
});

test("trumpstruth.org fixture: media/endorsement posts ignored; market posts scored from the full body (title is truncated)", async () => {
  const items = await parseFeed(readFileSync("test/fixtures/trumpstruth-2026-10-15.xml", "utf8"), "trump_truth", "2026-10-15T12:05:00Z");
  assert.equal(items.length, 100);
  const scored = items.map((i) => ({ t: fullText(i), s: scoreTrumpPost(fullText(i)) })).filter((x) => x.s);
  assert.ok(scored.length >= 4 && scored.length <= 30, `${scored.length}`);
  assert.ok(scored.some((x) => /Houthis/.test(x.t) && x.s!.topics.some((t) => t.id === "energy")));
  assert.ok(!scored.some((x) => /Husted|facade/.test(x.t)));
  const gf = items.find((i) => /GlobalFoundries/.test(fullText(i)))!;
  assert.ok(fullText(gf).length > gf.title.length, "full body, not the truncated title");
});

test("X file: zod schema, link-only posts ignored, malformed file → 'provide' error", () => {
  const items = parseXPosts(JSON.parse(readFileSync("test/fixtures/x-trump-2026-10-15.json", "utf8")));
  assert.equal(items.length, 10);
  assert.ok(items.every((i) => i.url.startsWith("https://x.com/realDonaldTrump/status/")));
  assert.ok(items.every((i) => scoreTrumpPost(i.title) === null), "t.co-only posts carry no text");
  assert.throws(() => parseXPosts({ data: [{ text: "x" }] }), /x-trump\.json/);
  assert.ok(loadSources().some((s) => s.id === "trump_x" && s.kind === "xfile"));
});

test("alerts: one alert per post across Truth + X, verbatim quote, links, assets, 宣布≠执行 note; store-deduped", () => {
  const text = "Effective immediately, a 50% Tariff will be charged on all Chinese steel. Thank you!";
  const now = Date.parse("2026-10-15T12:00:00Z");
  const items = [
    { id: 1, sourceId: "trump_truth", title: text, summary: text, url: "https://www.trumpstruth.org/statuses/1", publishedAt: "2026-10-15T11:50:00Z" },
    { id: 2, sourceId: "trump_x", title: text + " https://t.co/abc", summary: text, url: "https://x.com/realDonaldTrump/status/2", publishedAt: "2026-10-15T11:52:00Z" },
    { id: 3, sourceId: "trump_truth", title: "Vote for Jon!", summary: "Vote for Jon!", url: "u", publishedAt: "2026-10-15T11:55:00Z" },
  ];
  const none = { priorAlertScore: () => null };
  const a = trumpAlerts(items, none, 60, now - 12 * 3600_000);
  assert.equal(a.length, 1);
  assert.deepEqual(a[0]!.itemIds, [1, 2]);
  assert.ok(a[0]!.alert.score >= 85);
  assert.equal(a[0]!.alert.quote, text);
  assert.match(a[0]!.alert.headline, /Truth Social \+ X/);
  const md = renderAlertsMarkdown([a[0]!.alert], new Date(now));
  assert.ok(md.includes(`“${text}”`) && md.includes(TRUMP_NOTE) && md.includes("https://x.com/realDonaldTrump/status/2") && /FXI/.test(md));
  assert.equal(trumpAlerts(items, { priorAlertScore: (ids: number[]) => (ids.includes(1) ? 88 : null) }, 60, now - 12 * 3600_000).length, 0, "already alerted (via Truth) → X copy is not re-sent");
});

test("official Truth Social API parses; same post via mirror dedupes to one alert group", async () => {
  const { parseTruthStatuses } = await import("../src/ingest/truthApi.ts");
  const items = parseTruthStatuses(JSON.parse(readFileSync("test/fixtures/truthsocial-api-2026-10-15.json", "utf8")));
  assert.equal(items.length, 20);
  assert.ok(items.every((i) => i.sourceId === "trump_truth_official" && i.url.startsWith("https://truthsocial.com/") && i.guid?.startsWith("truth:")));
  assert.ok(items.some((i) => /GlobalFoundries/.test(i.title)));
  const text = "Starting November 1st, China will be charged a 100% Tariff on all goods.";
  const store = { priorAlertScore: () => null };
  const out = trumpAlerts([
    { id: 1, sourceId: "trump_truth_official", title: text, summary: text, url: "https://truthsocial.com/@realDonaldTrump/1", publishedAt: "2026-10-15T11:50:00Z" },
    { id: 2, sourceId: "trump_truth", title: text, summary: text, url: "https://www.trumpstruth.org/statuses/1", publishedAt: "2026-10-15T11:50:30Z" },
  ] as never, store as never, 70, Date.parse("2026-10-15T11:00:00Z"));
  assert.equal(out.length, 1); assert.deepEqual(out[0]!.itemIds, [1, 2]);
});
