import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseMirrorFeed, parseOfficialStatuses, fetchTruth, truthItems, readTruthFile, cleanText, TRUTH_API, TRUTH_MIRROR, type Fetcher } from "../src/ingest/truthTrump.ts";
import { mergeTrumpPosts, samePost } from "../src/trumpPosts.ts";
import { runTrumpFetch } from "../src/cli/trump.ts";
import { trumpAlerts, trumpSignal, fullText } from "../src/trump.ts";
import { sleepDay } from "../src/macro/sleepday.ts";

const FEED = readFileSync("test/fixtures/trumpstruth-feed-2026-10-19.xml", "utf8");
const RUSSIA_ID = "117463828588421761";

test("mirror parser on saved trumpstruth.org feed: text, original URL, UTC time, repost flag", () => {
  const p = parseMirrorFeed(FEED);
  assert.equal(p.length, 17);
  assert.ok(p.every((x, i) => i === 0 || p[i - 1]!.created_at >= x.created_at), "newest first");
  assert.ok(p.every((x) => x.source === "truth" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.000Z$/.test(x.created_at) && !/<[a-z]/i.test(x.text)));
  const r = p.find((x) => x.id === RUSSIA_ID)!;
  assert.equal(r.url, `https://truthsocial.com/@realDonaldTrump/${RUSSIA_ID}`);
  assert.equal(r.created_at, "2026-10-18T20:36:22.000Z"); assert.equal(r.repost, false);
  assert.match(r.text, /^My decision on Russia is a very simple one/);
  assert.match(r.mirrorUrl ?? "", /trumpstruth\.org\/statuses\/42416/);
  const rt = p.filter((x) => x.repost); assert.equal(rt.length, 1); assert.equal(rt[0]!.postType, "repost"); assert.match(rt[0]!.text, /^To the Great People of Israel/);
  assert.ok(p.filter((x) => x.postType === "quote").every((x) => !x.repost), "quote posts are not reposts");
  assert.equal(cleanText("<p>RT: https://truthsocial.com/x/1 Hello <b>world</b> &amp; more</p>"), "Hello world & more");
});

test("official API parser (if it ever passes Cloudflare): reblog → repost, HTML stripped", () => {
  const p = parseOfficialStatuses([{ id: "1", created_at: "2026-10-19T10:00:00.000Z", content: "<p>Tariffs on <b>China</b></p>", url: "https://truthsocial.com/@realDonaldTrump/1", reblog: null },
    { id: "2", created_at: "2026-10-19T09:00:00Z", content: "", url: "https://truthsocial.com/@realDonaldTrump/2", reblog: { content: "<p>Great news</p>" } }]);
  assert.equal(p[0]!.text, "Tariffs on China"); assert.equal(p[0]!.repost, false); assert.equal(p[1]!.repost, true);
});

test("fetchTruth: official 403 → mirror; both down → via none, never throws", async () => {
  const calls: string[] = [];
  const cf: Fetcher = async (u) => { calls.push(u); return u === TRUTH_API ? { status: 403, body: "<title>Just a moment...</title>" } : { status: 200, body: FEED }; };
  const a = await fetchTruth({ fetcher: cf });
  assert.deepEqual(calls, [TRUTH_API, TRUTH_MIRROR]); assert.equal(a.via, "mirror"); assert.equal(a.data.length, 17);
  assert.deepEqual(a.errors, ["official: HTTP 403 (Cloudflare challenge)"]);
  const down = await fetchTruth({ fetcher: async (u) => { if (u === TRUTH_MIRROR) throw new Error("curl: (28) timeout"); return { status: 503, body: "" }; } });
  assert.equal(down.via, "none"); assert.equal(down.data.length, 0); assert.equal(down.errors.length, 2); assert.match(down.errors[1]!, /mirror: curl: \(28\) timeout/);
  assert.equal((await fetchTruth({ fetcher: async () => ({ status: 200, body: "not xml" }) })).via, "none", "garbage → none, no throw");
});

const X = (id: string, text: string, created_at: string) => ({ id, text, created_at, url: `https://x.com/realDonaldTrump/status/${id}`, source: "x" as const, repost: false });
const T = (id: string, text: string, created_at: string) => ({ id, text, created_at, url: `https://truthsocial.com/@realDonaldTrump/${id}`, source: "truth" as const, repost: false });

test("merge/dedupe: cross-post within 6h → one post with both platforms + URLs; different text or >6h apart stays separate", () => {
  const txt = "China has agreed to buy massive amounts of American Soybeans, starting immediately. Tariffs will come down!";
  const m = mergeTrumpPosts([
    T("t1", txt, "2026-10-19T12:00:00Z"),
    X("x1", txt.replace("immediately.", "immediately!!") + " https://t.co/abc", "2026-10-19T12:20:00Z"),
    X("x2", txt, "2026-10-19T20:30:00Z"), // same words but 8.5h later → a separate post
    T("t2", "Big crowds today in Kansas. See you later! President DJT", "2026-10-19T12:05:00Z"),
  ]);
  assert.equal(m.length, 3);
  const cross = m.find((p) => p.platforms.length === 2)!;
  assert.deepEqual([...cross.platforms].sort(), ["Truth Social", "X"]);
  assert.equal(cross.urls["Truth Social"], "https://truthsocial.com/@realDonaldTrump/t1"); assert.equal(cross.urls.X, "https://x.com/realDonaldTrump/status/x1");
  assert.equal(cross.created_at, "2026-10-19T12:00:00Z", "earliest copy's time");
  assert.ok(m.every((p, i) => i === 0 || m[i - 1]!.created_at >= p.created_at), "newest first");
  assert.equal(samePost({ text: "Short", at: "2026-10-19T12:00:00Z" }, { text: "Other", at: "2026-10-19T12:00:00Z" }), false);
});

test("npm run trump: mirror ok → truth-trump.json + merged file; Truth down → one warning, old file kept, continues with X only", async () => {
  const d = mkdtempSync(join(tmpdir(), "truth-")), truthPath = join(d, "truth.json"), xPath = join(d, "x.json"), mergedPath = join(d, "merged.json");
  writeFileSync(xPath, JSON.stringify({ fetchedAt: "2026-10-19T12:00:00Z", data: [{ id: "99", text: "We will put a 100% Tariff on China", created_at: "2026-10-19T12:30:00Z" }] }));
  const ok = await runTrumpFetch({ fetcher: async (u) => (u === TRUTH_API ? { status: 403, body: "Just a moment..." } : { status: 200, body: FEED }), truthPath, xPath, mergedPath });
  assert.equal(ok.warning, null); assert.match(ok.line, /Truth Social 17 条（trumpstruth\.org 镜像；official: HTTP 403/);
  const saved = JSON.parse(readFileSync(truthPath, "utf8"));
  assert.equal(saved.source, "truth"); assert.equal(saved.via, "mirror"); assert.equal(saved.data.length, 17);
  assert.deepEqual(Object.keys(saved.data[0]).slice(0, 4), ["id", "text", "created_at", "url"], "same core shape as x-trump.json");
  const merged = JSON.parse(readFileSync(mergedPath, "utf8")); assert.equal(merged.data.length, 18); assert.deepEqual(merged.data[0].platforms, ["X"]);
  const down = await runTrumpFetch({ fetcher: async () => { throw new Error("connection refused"); }, truthPath, xPath, mergedPath });
  assert.match(down.warning!, /^\[trump\] ⚠️ Truth Social 抓取失败.*→ 本轮只用 X（沿用旧 truth-trump\.json 17 条）$/);
  assert.equal(down.warning!.split("\n").length, 1, "one line");
  assert.equal(JSON.parse(readFileSync(truthPath, "utf8")).via, "mirror", "old file not clobbered");
  const fresh = join(d, "none.json");
  const xOnly = await runTrumpFetch({ fetcher: async () => ({ status: 500, body: "" }), truthPath: fresh, xPath, mergedPath });
  assert.ok(!existsSync(fresh)); assert.equal(JSON.parse(readFileSync(mergedPath, "utf8")).data.length, 1, "X only"); assert.equal(xOnly.merged, 1);
});

test("poll truthfile reader → store items (sourceId trump_truth, original URL, RT prefix only on reposts)", () => {
  const d = mkdtempSync(join(tmpdir(), "truth-")), p = join(d, "t.json");
  writeFileSync(p, JSON.stringify({ source: "truth", fetchedAt: "x", via: "mirror", errors: [], data: parseMirrorFeed(FEED) }));
  const r = readTruthFile(p); assert.equal(r.error, undefined); assert.equal(r.items.length, 17); assert.equal(r.via, "mirror");
  const ru = r.items.find((i) => i.guid === `truth:${RUSSIA_ID}`)!; assert.equal(ru.sourceId, "trump_truth"); assert.equal(ru.url, `https://truthsocial.com/@realDonaldTrump/${RUSSIA_ID}`);
  assert.equal(r.items.filter((i) => i.summary.startsWith("RT: ")).length, 1);
  assert.match(readTruthFile(join(d, "missing.json")).error!, /missing/);
});

const store = (items: ReturnType<typeof truthItems>, fetchedAt: string) => items.map((i, n) => ({ id: n + 1, sourceId: i.sourceId, title: i.title, summary: i.summary, url: i.url, publishedAt: i.publishedAt, fetchedAt }));

test("alerts: a market Truth post fetched 15h late (the 2026-10-18 Russia post) still alerts, with platform + link + delay", () => {
  const items = store(truthItems({ data: parseMirrorFeed(FEED) }), "2026-10-19T11:41:00Z");
  const now = Date.parse("2026-10-19T11:45:00Z");
  const a = trumpAlerts(items, { priorAlertScore: () => null }, 70, now - 12 * 3600_000);
  const ru = a.find((x) => x.alert.links.some((l) => l.url.endsWith(RUSSIA_ID)))!;
  assert.ok(ru, "Russia post alerted despite publishedAt 15h before the window");
  assert.deepEqual(ru.alert.links.map((l) => l.source), ["Truth Social"]);
  assert.match(ru.alert.note!, /发布于 10-18 16:36 ET（Truth Social），晚到 15 小时才抓到/);
  // without fetchedAt (old behaviour) it would have been dropped
  assert.ok(!trumpAlerts(items.map(({ fetchedAt: _f, ...i }) => i), { priorAlertScore: () => null }, 70, now - 12 * 3600_000).some((x) => x.alert.links.some((l) => l.url.endsWith(RUSSIA_ID))));
});

test("alerts: Truth + X cross-post → ONE alert listing both platforms and both links", () => {
  const txt = "We will put a 100% Tariff on China starting November 1st, on top of any Tariff they are currently paying";
  const items = [
    { id: 1, sourceId: "trump_truth", title: txt, summary: txt, url: "https://truthsocial.com/@realDonaldTrump/1", publishedAt: "2026-10-19T12:00:00Z", fetchedAt: "2026-10-19T12:05:00Z" },
    { id: 2, sourceId: "trump_x", title: txt + " https://t.co/z", summary: txt, url: "https://x.com/realDonaldTrump/status/2", publishedAt: "2026-10-19T12:10:00Z", fetchedAt: "2026-10-19T12:15:00Z" }];
  const a = trumpAlerts(items, { priorAlertScore: () => null }, 70, Date.parse("2026-10-19T06:00:00Z"));
  assert.equal(a.length, 1); assert.deepEqual(a[0]!.itemIds, [1, 2]);
  assert.deepEqual(a[0]!.alert.links.map((l) => `${l.source} ${l.url}`), ["Truth Social https://truthsocial.com/@realDonaldTrump/1", "X https://x.com/realDonaldTrump/status/2"]);
  assert.match(a[0]!.alert.headline, /Truth Social \+ X|X \+ Truth Social/);
});

const EV = [{ dateET: "2026-10-28", series: "FOMC", title: "FOMC 利率决议", timeET: "14:00" }];
const fed = { speeches: [], blackouts: [], coverTo: "2026-12-31", status: "缓存" };

test("能不能睡: a market Truth post within 24h flips Monday 可以睡 → 不能睡, exactly like an X post; reason shows platform + link", () => {
  const now = new Date("2026-10-19T11:45:00Z"); // Mon 07:45 ET (Mondays are 可以睡 by default)
  const truth = store(truthItems({ data: parseMirrorFeed(FEED) }), "2026-10-19T11:41:00Z");
  const sigT = trumpSignal(truth, now, 70);
  const day = (posts: typeof sigT.posts) => sleepDay({ date: "2026-10-19", now, events: EV, fed, trump: { posts, scheduled: [], status: "s" } });
  assert.equal(day([]).label, "sleep", "baseline Monday");
  const t = day(sigT.posts);
  assert.equal(t.label, "no_sleep");
  assert.ok(t.noSleep.some((r) => /川普 24h 内发了 \d+ 条市场相关帖.*Truth Social/.test(r.text)));
  assert.ok(t.notes.some((n) => n.includes(`https://truthsocial.com/@realDonaldTrump/${RUSSIA_ID}`) && /Truth Social/.test(n)));
  assert.match(sigT.status, /Truth Social \d+ 条（最新帖 2026-10-19 07:16 ET）/);
  // same post on X only → same verdict
  const x = trump_x(truth.find((i) => i.url.endsWith(RUSSIA_ID))!);
  const sigX = trumpSignal([x], now, 70);
  assert.equal(day(sigX.posts).label, "no_sleep"); assert.deepEqual(sigX.posts[0]!.platforms, ["X"]);
  // both platforms → merged into one post, still 不能睡
  const both = trumpSignal([...truth, x], now, 70);
  assert.equal(both.posts.filter((p) => p.platforms.length === 2).length, 1); assert.equal(both.posts.length, sigT.posts.length);
  assert.equal(day(both.posts).label, "no_sleep");
});
function trump_x(i: { id: number; title: string; summary: string; publishedAt: string; fetchedAt: string }) {
  return { ...i, id: 999, sourceId: "trump_x", url: "https://x.com/realDonaldTrump/status/1979", title: fullText({ title: i.title, summary: i.summary } as never), publishedAt: new Date(Date.parse(i.publishedAt) + 60_000).toISOString() };
}

test("dedupe: two text-less mirror placeholders ('Quote post from …') are never merged", () => {
  const m = mergeTrumpPosts([T("a", "Quote post from October 18, 2026", "2026-10-18T21:36:55Z"), T("b", "Quote post from October 18, 2026", "2026-10-18T18:27:02Z")]);
  assert.equal(m.length, 2);
});
