import assert from "node:assert/strict";
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { appendFileSync, copyFileSync, existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
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
function isolatedCli(directory) {
  for (const file of ["scripts/options-drivers.mjs", "scripts/lib/options-driver-io.mjs", "src/engines/options-drivers/OptionsDriverMonitorEngine.ts", "src/engines/options-drivers/OptionsDriverCatalog.ts", "src/contracts/OptionsDriverMonitor.ts"]) {
    mkdirSync(dirname(join(directory, file)), { recursive: true }); copyFileSync(join(root, file), join(directory, file));
  }
  writeFileSync(join(directory, "package.json"), '{"type":"module"}');
  return join(directory, "scripts/options-drivers.mjs");
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
tests.push(
  ["system permission codes survive direct and Node fetch error wrappers with one request", async () => {
    const denied = code => Object.assign(Error("PRIVATE_SOCKET_DETAILS"), { code });
    for (const failure of [denied("EACCES"), denied("EPERM"), new TypeError("fetch failed", { cause: denied("EACCES") }),
      new TypeError("fetch failed", { cause: new AggregateError([denied("ECONNREFUSED"), denied("EACCES")]) })]) {
      let requests = 0;
      await assert.rejects(readPublicDriverFeed("fed", async () => { requests++; throw failure; }),
        error => error.message === "FEED_NETWORK_ACCESS_DENIED");
      assert.equal(requests, 1);
    }
  }],
  ["unknown errors and permission words in messages do not imply access denial", async () => {
    for (const failure of [Error("EACCES PRIVATE_MESSAGE"), { code: "PRIVATE_CODE" }, { cause: { code: "ENOTFOUND" } }])
      await assert.rejects(readPublicDriverFeed("fed", async () => { throw failure; }), error => error.message === "FEED_NETWORK_FAILED");
    await assert.rejects(readPublicDriverFeed("fed", async () => new Response("denied", { status: 403 })), error => error.message === "HTTP_403");
  }],
  ["cyclic or oversized exception trees are bounded", async () => {
    const cyclic = {}; cyclic.cause = cyclic;
    const many = { errors: [...Array.from({ length: 20 }, () => ({})), { code: "EACCES" }] };
    for (const failure of [cyclic, many])
      await assert.rejects(readPublicDriverFeed("fed", async () => { throw failure; }), error => error.message === "FEED_NETWORK_FAILED");
  }],
  ["body permission failures are sanitized like header failures", async () => {
    const body = new ReadableStream({ start(controller) { controller.error(Object.assign(Error("PRIVATE_BODY_DETAILS"), { code: "EPERM" })); } });
    await assert.rejects(readPublicDriverFeed("fed", async () => new Response(body, { headers: { "content-type": "text/xml" } })),
      error => error.message === "FEED_NETWORK_ACCESS_DENIED");
  }],
  ["CLI persists access failure then recovery without deleting the failed batch", () => temporary(directory => {
    const command = isolatedCli(directory), preload = join(directory, "network-provider.mjs");
    const invoke = mode => spawnSync(process.execPath, ["--import", "tsx", "--import", pathToFileURL(preload).href, command, mode], { cwd: root, encoding: "utf8", timeout: 30000 });
    writeFileSync(preload, 'globalThis.fetch = async () => { throw new TypeError("PRIVATE_PROVIDER_MESSAGE", { cause: new AggregateError([Object.assign(new Error("PRIVATE_ADDRESS"), { code: "EACCES" })]) }); };');
    const failed = invoke("--refresh"); assert.equal(failed.status, 3, failed.stderr);
    assert(JSON.parse(failed.stdout).sources.every(s => s.health.diagnostic === "FEED_NETWORK_ACCESS_DENIED"));
    const journal = join(directory, "data/runtime/options-driver-monitor/refreshes.ndjson"), prefix = readFileSync(journal);
    assert(!prefix.toString().includes("PRIVATE"));
    writeFileSync(preload, `globalThis.fetch = async () => new Response(${JSON.stringify(rss(item()))}, { headers: { "content-type": "text/xml" } });`);
    const recovered = invoke("--refresh"); assert.equal(recovered.status, 0, recovered.stderr);
    const result = JSON.parse(recovered.stdout); assert(result.sources.every(s => s.health.status === "OK"));
    const after = readFileSync(journal); assert(after.subarray(0, prefix.length).equals(prefix));
    assert.equal(after.toString().trimEnd().split("\n").length, 2);
    const restart = invoke("--report"); assert.equal(restart.status, 0, restart.stderr);
    assert.deepEqual(JSON.parse(restart.stdout).sources.map(s => s.health), result.sources.map(s => s.health));
    assert(readFileSync(journal).equals(after));
  })],
  ["CLI corruption errors do not expose the invalid journal body", () => temporary(directory => {
    const command = isolatedCli(directory);
    withDriverJournal(directory, s => s.appendBatch([{ example: 1 }], []));
    const path = join(directory, "data/runtime/options-driver-monitor/refreshes.ndjson"); writeFileSync(path, "{PRIVATE_JOURNAL_CONTENT}\n");
    const r = spawnSync(process.execPath, ["--import", "tsx", command, "--report"], { cwd: root, encoding: "utf8", timeout: 30000 });
    assert.equal(r.status, 2); assert.equal(JSON.parse(r.stderr).message, "DRIVER_LOCAL_FAILURE"); assert(!r.stderr.includes("PRIVATE")); assert.equal(readFileSync(path, "utf8"), "{PRIVATE_JOURNAL_CONTENT}\n");
  })],
  ["CLI records fixed source failures for all six feeds without leaking provider errors", () => temporary(directory => {
    const command = isolatedCli(directory), preload = join(directory, "fault-provider.mjs");
    writeFileSync(preload, 'globalThis.fetch = async () => { throw Error("PRIVATE_PROVIDER_MESSAGE"); };');
    const r = spawnSync(process.execPath, ["--import", "tsx", "--import", pathToFileURL(preload).href, command, "--refresh"], { cwd: root, encoding: "utf8", timeout: 30000 });
    assert.equal(r.status, 3, r.stderr); const result = JSON.parse(r.stdout); assert.equal(result.sources.length, 6);
    assert(result.sources.every(s => s.health.status === "FAILED" && s.health.diagnostic === "FEED_NETWORK_FAILED"));
    assert(!r.stdout.includes("PRIVATE")); assert(!readFileSync(join(directory, "data/runtime/options-driver-monitor/refreshes.ndjson"), "utf8").includes("PRIVATE"));
  })],
  ["deadline bounds headers even when a transport ignores its abort signal", async () => {
    await assert.rejects(readPublicDriverFeed("fed", () => new Promise(() => {}), { deadlineMs: 5 }), /FEED_DEADLINE_EXCEEDED/);
  }],
  ["one deadline bounds body reads and a stalled cancellation cannot block it", async () => {
    const response = { status: 200, headers: new Headers({ "content-type": "text/xml" }), body: { getReader: () => ({ read: () => new Promise(() => {}), cancel: () => new Promise(() => {}) }) } };
    await assert.rejects(readPublicDriverFeed("fed", async () => response, { deadlineMs: 5 }), /FEED_DEADLINE_EXCEEDED/);
  }],
  ["successful bytes are returned even if cleanup never resolves or rejects", async () => {
    for (const cancel of [() => new Promise(() => {}), async () => { throw Error("PRIVATE_CANCEL_FAILURE"); }]) {
      let read = false;
      const response = { status: 200, headers: new Headers({ "content-type": "application/rss+xml; charset=UTF-8" }), body: { getReader: () => ({ read: async () => read ? { done: true } : (read = true, { done: false, value: Buffer.from(rss(item())) }), cancel }) } };
      assert.equal(await readPublicDriverFeed("fed", async () => response, { deadlineMs: 10 }), rss(item()));
    }
  }],
  ["invalid UTF-8 is rejected rather than altered into replacement characters", async () => {
    await assert.rejects(readPublicDriverFeed("fed", async () => new Response(new Uint8Array([0xc3, 0x28]), { headers: { "content-type": "text/xml" } })), /INVALID_FEED_UTF8/);
  }],
  ["unsupported charset and deceptive content-type values are rejected", async () => {
    for (const value of ["text/html; charset=xml", "application/xmlish", "text/xml; charset=latin1"])
      await assert.rejects(readPublicDriverFeed("fed", async () => new Response(rss(item()), { headers: { "content-type": value } })), /UNEXPECTED_CONTENT_TYPE/);
  }],
  ["malformed Content-Length and empty streams retain distinct fixed failures", async () => {
    for (const value of ["-1", "NaN", "1.2"])
      await assert.rejects(readPublicDriverFeed("fed", async () => new Response(rss(item()), { headers: { "content-type": "text/xml", "content-length": value } })), /INVALID_CONTENT_LENGTH/);
    await assert.rejects(readPublicDriverFeed("fed", async () => new Response("", { headers: { "content-type": "text/xml" } })), /EMPTY_RESPONSE_BODY/);
  }],
  ["provider status and network error text cannot become stored diagnostics", async () => {
    await assert.rejects(readPublicDriverFeed("fed", async () => { throw Error("PRIVATE_TOKEN_VALUE"); }), error => error.message === "FEED_NETWORK_FAILED");
    await assert.rejects(readPublicDriverFeed("fed", async () => ({ status: "PRIVATE_TOKEN_VALUE" })), error => error.message === "FEED_HTTP_STATUS");
    await assert.rejects(readPublicDriverFeed("fed", async () => ({ status: 200, redirected: true })), /FEED_HTTP_STATUS/);
  }],
  ["unbounded or invalid deadline overrides fail before any source call", async () => {
    for (const deadlineMs of [0, -1, 12001, 1.1, Infinity]) {
      let called = false; await assert.rejects(readPublicDriverFeed("fed", async () => { called = true; }, { deadlineMs }), /DEADLINE_CONFIGURATION/); assert.equal(called, false);
    }
  }],
  ["direct journal recovery rejects hard links without appending any bytes", () => temporary(directory => {
    withDriverJournal(directory, s => s.appendBatch([{ example: 1 }], []));
    const path = join(directory, "data/runtime/options-driver-monitor/refreshes.ndjson"), before = readFileSync(path);
    linkSync(path, join(directory, "alias")); assert.throws(() => withDriverJournal(directory, () => {}), /UNSAFE/); assert.deepEqual(readFileSync(path), before);
  })],
  ["append rechecks link safety after the journal callback begins", () => temporary(directory => {
    withDriverJournal(directory, s => s.appendBatch([{ example: 1 }], []));
    withDriverJournal(directory, s => {
      const path = join(s.directory, "refreshes.ndjson"), before = readFileSync(path); linkSync(path, join(directory, "alias"));
      assert.throws(() => s.appendBatch([{ example: 2 }], []), /UNSAFE/); assert.deepEqual(readFileSync(path), before);
    });
  })],
  ["headline append capability expires after the writer callback returns", () => temporary(directory => {
    const escaped = withDriverJournal(directory, store => store);
    assert.throws(() => escaped.appendBatch([{ example: 1 }], []), /SCOPE_CLOSED/);
    withDriverJournal(directory, store => assert.equal(store.observations.length, 0));
  })],
  ["headline thenables cannot claim asynchronous lock ownership", () => temporary(directory => {
    assert.throws(() => withDriverJournal(directory, () => ({ then: () => {} })), /REQUIRES_SYNCHRONOUS_CALLBACK/);
    withDriverJournal(directory, store => store.appendBatch([{ example: 1 }], []));
  })],
  ["uncertain headline persistence stops appends until checked recovery", () => temporary(directory => {
    withDriverJournal(directory, store => {
      const original = fs.fsyncSync;
      fs.fsyncSync = () => { throw Error("SIMULATED_DRIVER_SYNC_FAILURE"); }; syncBuiltinESMExports();
      try { assert.throws(() => store.appendBatch([{ example: 1 }], []), /SIMULATED_DRIVER_SYNC_FAILURE/); }
      finally { fs.fsyncSync = original; syncBuiltinESMExports(); }
      assert.throws(() => store.appendBatch([{ example: 2 }], []), /WRITE_UNCERTAIN/);
    });
    withDriverJournal(directory, store => { assert.equal(store.observations.length, 1); store.appendBatch([{ example: 2 }], []); });
    withDriverJournal(directory, store => assert.equal(store.observations.length, 2));
  })],
  ["partial headline append remains intact and blocks recovery", () => temporary(directory => {
    withDriverJournal(directory, store => {
      const original = fs.appendFileSync;
      fs.appendFileSync = (path, data, options) => { original(path, data.slice(0, 15), options); throw Error("SIMULATED_PARTIAL_DRIVER_WRITE"); }; syncBuiltinESMExports();
      try { assert.throws(() => store.appendBatch([{ example: 1 }], []), /SIMULATED_PARTIAL_DRIVER_WRITE/); }
      finally { fs.appendFileSync = original; syncBuiltinESMExports(); }
      assert.throws(() => store.appendBatch([{ example: 2 }], []), /WRITE_UNCERTAIN/);
    });
    const path = join(directory, "data/runtime/options-driver-monitor/refreshes.ndjson"), before = readFileSync(path, "utf8");
    assert.throws(() => withDriverJournal(directory, () => {}), /TRUNCATED/); assert.equal(readFileSync(path, "utf8"), before);
  })],
);
for (const [name, run] of tests) { await run(); console.log(`PASS ${name}`); }
console.log(`Options Driver IO and CLI: ${tests.length}/${tests.length} tests passed.`);
