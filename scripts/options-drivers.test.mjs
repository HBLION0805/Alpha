import assert from "node:assert/strict";
import { appendFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import { parseDriverFeed, PUBLIC_SOURCE_URLS, readPublicDriverFeed, withDriverJournal } from "./lib/options-driver-io.mjs";

const root = resolve(import.meta.dirname, "..");
const asOf = "2026-09-06T12:00:00.000Z";
const item = (extra = "", guid = "example") => `<item><guid>${guid}</guid><title>Inflation &amp; monetary policy</title><link>https://www.federalreserve.gov/news/example.htm</link><pubDate>Sun, 06 Sep 2026 10:00:00 GMT</pubDate>${extra}</item>`;
const rss = (content) => `<rss version="2.0"><channel>${content}</channel></rss>`;
function cli(args) {
  return spawnSync(process.execPath, [resolve(root, "node_modules/tsx/dist/cli.mjs"), resolve(root, "scripts/options-drivers.mjs"), ...args], { cwd: root, encoding: "utf8", timeout: 30000 });
}
async function temporary(run) {
  const directory = mkdtempSync(join(tmpdir(), "alpha-driver-test-"));
  try { await run(directory); } finally {
    const rel = relative(tmpdir(), directory);
    if (isAbsolute(rel) || rel.startsWith("..") || !rel.startsWith("alpha-driver-test-")) throw new Error("UNSAFE_TEST_CLEANUP");
    rmSync(directory, { recursive: true });
  }
}
const tests = [
  ["RSS parser preserves source and canonical publication time", () => {
    const parsed = parseDriverFeed(rss(item()), "fed", asOf);
    assert.equal(parsed.items[0].headline, "Inflation & monetary policy");
    assert.equal(parsed.items[0].publishedAt, "2026-09-06T10:00:00.000Z");
    assert.equal(parsed.items[0].origin, "PUBLIC_FEED");
  }],
  ["Atom parser handles title CDATA and explicit alternate links", () => {
    const parsed = parseDriverFeed('<feed xmlns="http://www.w3.org/2005/Atom"><entry><id>x</id><title><![CDATA[Bitcoin custody]]></title><link href="https://www.sec.gov/news/x"/><published>2026-09-06T10:00:00Z</published></entry></feed>', "sec", asOf);
    assert.equal(parsed.items[0].headline, "Bitcoin custody");
    assert.equal(parsed.items[0].link, "https://www.sec.gov/news/x");
  }],
  ["missing or ambiguous publication time stays unknown", () => {
    const parsed = parseDriverFeed(rss(item().replace(/<pubDate>.*?<\/pubDate>/, "<pubDate>2026-09-06 10:00:00</pubDate>")), "fed", asOf);
    assert.equal(parsed.items[0].publishedAt, null);
  }],
  ["entity declarations, HTML errors and malformed items fail closed", () => {
    for (const xml of ['<!DOCTYPE rss [<!ENTITY file SYSTEM "file:///secret">]>' + rss(item()), "<html>error</html>", rss(item()).replace("</item>", ""), rss(item()).replace("</rss>", "")]) {
      assert.throws(() => parseDriverFeed(xml, "fed", asOf));
    }
  }],
  ["unregistered sources and unsafe item links are not followed", () => {
    assert.throws(() => parseDriverFeed(rss(item()), "arbitrary-url", asOf));
    assert.equal(parseDriverFeed(rss(item().replace("https://www.federalreserve.gov/news/example.htm", "file:///secret")), "fed", asOf).rejectedItems, 1);
  }],
  ["oversized identifiers are hashed without prefix collisions", () => {
    const first = parseDriverFeed(rss(item("", "a".repeat(1200) + "1")), "fed", asOf).items[0].itemId;
    const second = parseDriverFeed(rss(item("", "a".repeat(1200) + "2")), "fed", asOf).items[0].itemId;
    assert.notEqual(first, second); assert.match(first, /^sha256:/);
  }],
  ["item and byte caps are explicit", () => {
    const parsed = parseDriverFeed(rss(item().repeat(101)), "fed", asOf);
    assert.equal(parsed.items.length, 100); assert.equal(parsed.truncated, true);
    assert.throws(() => parseDriverFeed(" ".repeat(524289), "fed", asOf), /FEED_TOO_LARGE/);
  }],
  ["transport binds its fixed URL and omits credentials and redirects", async () => {
    const text = await readPublicDriverFeed("fed", async (url, options) => {
      assert.equal(url, PUBLIC_SOURCE_URLS.fed); assert.equal(options.redirect, "manual"); assert.equal(options.credentials, "omit");
      return new Response(rss(item()), { headers: { "content-type": "text/xml" } });
    });
    assert.match(text, /<rss/);
  }],
  ["unknown transport source fails before any request", async () => {
    let calls = 0;
    await assert.rejects(readPublicDriverFeed("http://localhost/", async () => { calls++; return new Response(); }), /UNREGISTERED/);
    assert.equal(calls, 0);
  }],
  ["redirects, HTTP errors, content mismatch and declared oversized body reject", async () => {
    for (const response of [new Response("", { status: 302 }), new Response("", { status: 503 }), new Response("html", { headers: { "content-type": "text/html" } }), new Response("x", { headers: { "content-type": "text/xml", "content-length": "999999" } })]) {
      await assert.rejects(readPublicDriverFeed("fed", async () => response));
    }
  }],
  ["streaming limit rejects body without trusting content-length", async () => {
    await assert.rejects(readPublicDriverFeed("fed", async () => new Response("x".repeat(524289), { headers: { "content-type": "text/xml" } })), /FEED_TOO_LARGE/);
  }],
  ["journal stores observations and health together and reopens history", () => temporary((directory) => {
    withDriverJournal(directory, (store) => store.appendBatch([{ example: 1 }], [{ status: "test" }]));
    withDriverJournal(directory, (store) => {
      assert.equal(store.observations.length, 1); assert.equal(store.health.length, 1);
      store.appendBatch([{ example: 2 }], []);
    });
    withDriverJournal(directory, (store) => assert.equal(store.observations.length, 2));
  })],
  ["checksum corruption and partial append block instead of deleting history", () => temporary((directory) => {
    withDriverJournal(directory, (store) => store.appendBatch([{ example: 1 }], []));
    const path = join(directory, "data/runtime/options-driver-monitor/refreshes.ndjson");
    const original = readFileSync(path, "utf8");
    writeFileSync(path, original.replace('"example":1', '"example":2'));
    assert.throws(() => withDriverJournal(directory, () => {}), /INTEGRITY/);
    writeFileSync(path, original); appendFileSync(path, "{");
    assert.throws(() => withDriverJournal(directory, () => {}), /TRUNCATED/);
    assert.equal(readFileSync(path, "utf8"), original + "{");
  })],
  ["single-writer lock rejects overlap and does not remove another lock", () => temporary((directory) => {
    withDriverJournal(directory, (store) => {
      assert.throws(() => withDriverJournal(directory, () => {}), /EEXIST/);
      assert.equal(existsSync(join(store.directory, "writer.lock")), true);
    });
    assert.equal(existsSync(join(directory, "data/runtime/options-driver-monitor/writer.lock")), false);
  })],
  ["catalog and offline demo run without adding public evidence", () => {
    const catalog = cli(["--catalog"]); assert.equal(catalog.status, 0, catalog.stderr);
    assert.equal(JSON.parse(catalog.stdout).factors.length, 16);
    const demo = cli(["--demo"]); assert.equal(demo.status, 0, demo.stderr);
    const report = JSON.parse(demo.stdout);
    assert.equal(report.executionAllowed, false);
    assert(report.factors.every((factor) => factor.recentPublicCandidateCount === 0));
  }],
  ["CLI forbids arbitrary URLs, live order mode and extra arguments", () => {
    for (const args of [["--url", "https://example.com"], ["--trade"], ["--refresh", "--demo"]]) {
      const response = cli(args); assert.equal(response.status, 2); assert.equal(JSON.parse(response.stderr).executionAllowed, false);
    }
  }],
];
for (const [name, run] of tests) { await run(); console.log(`PASS ${name}`); }
console.log(`Options Driver IO and CLI: ${tests.length}/${tests.length} tests passed.`);
