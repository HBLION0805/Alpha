import { appendFileSync, closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, realpathSync, unlinkSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { createHash } from "node:crypto";

export const PUBLIC_SOURCE_URLS = Object.freeze({
  fed: "https://www.federalreserve.gov/feeds/press_all.xml",
  bls: "https://www.bls.gov/feed/bls_latest.rss",
  bea: "https://apps.bea.gov/rss/rss.xml",
  ecb: "https://www.ecb.europa.eu/rss/press.html",
  ofac: "https://ofac.treasury.gov/rss.xml",
  sec: "https://www.sec.gov/news/pressreleases.rss",
});
const MAX_FEED_BYTES = 524288;
const MAX_JOURNAL_BYTES = 16 * 1024 * 1024;

function clean(text) {
  const withoutCdata = text.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]*>/g, " ");
  const decoded = withoutCdata.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, entity) => {
    const named = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
    if (!entity.startsWith("#")) return named[entity.toLowerCase()];
    const code = entity[1].toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
    return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : " ";
  });
  return decoded.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
}
function tag(block, name) {
  return clean(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}\\s*>`, "i").exec(block)?.[1] ?? "");
}
function published(value) {
  if (!/(?:GMT|UTC|Z|[+-]\d{2}:?\d{2})$/i.test(value)) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}
/** Bounded RSS 2.0 / Atom headline subset. DTD/entity declarations are never interpreted. */
export function parseDriverFeed(xml, sourceId, observedAt, origin = "PUBLIC_FEED") {
  if (!Object.hasOwn(PUBLIC_SOURCE_URLS, sourceId)) throw new Error("UNREGISTERED_DRIVER_SOURCE");
  if (typeof xml !== "string" || Buffer.byteLength(xml, "utf8") > MAX_FEED_BYTES) throw new Error("FEED_TOO_LARGE");
  if (/<!DOCTYPE|<!ENTITY/i.test(xml) || !/<(?:rss|feed)(?:\s|>)/i.test(xml) || !/<\/(?:rss|feed)>\s*$/i.test(xml)) throw new Error("UNSUPPORTED_OR_INCOMPLETE_FEED");
  const blocks = [...xml.matchAll(/<(item|entry)(?:\s[^>]*)?>([\s\S]*?)<\/\1\s*>/gi)];
  // Refuse partial item parsing; RSS documents cannot silently lose a malformed entry.
  if ((xml.match(/<(?:item|entry)(?:\s|>)/gi) ?? []).length !== blocks.length) throw new Error("MALFORMED_FEED_ITEMS");
  const items = [];
  let rejectedItems = 0;
  for (const [, , block] of blocks.slice(0, 100)) {
    const headline = tag(block, "title").slice(0, 400);
    let link = tag(block, "link");
    if (!link) link = clean(/<link\b[^>]*href=["']([^"']+)["'][^>]*\/?\s*>/i.exec(block)?.[1] ?? "");
    if (!headline || !/^https:\/\/[a-z0-9][a-z0-9.-]+\//i.test(link) || /[@\\\s]/.test(link) || link.length > 2048) { rejectedItems++; continue; }
    const fullId = tag(block, "guid") || tag(block, "id") || link;
    const itemId = fullId.length > 1024 ? `sha256:${createHash("sha256").update(fullId).digest("hex")}` : fullId;
    items.push({ sourceId, itemId, link, headline, publishedAt: published(tag(block, "pubDate") || tag(block, "published") || tag(block, "updated") || tag(block, "dc:date")), observedAt, origin });
  }
  return { items, rejectedItems, truncated: blocks.length > 100, sourceItemCount: blocks.length };
}

// Inspect only fixed system codes, never error messages/URLs. Node fetch may
// wrap Windows socket errors inside a cause and an IPv4/IPv6 AggregateError.
function networkFailureCode(error) {
  const pending = [error], seen = new Set();
  for (let i = 0; i < pending.length && i < 16; i++) {
    const value = pending[i];
    if (!value || typeof value !== "object" || seen.has(value)) continue;
    seen.add(value);
    if (value.code === "EACCES" || value.code === "EPERM") return "FEED_NETWORK_ACCESS_DENIED";
    if (value.cause && pending.length < 16) pending.push(value.cause);
    if (Array.isArray(value.errors)) {
      for (const child of value.errors.slice(0, 16 - pending.length)) pending.push(child);
    }
  }
  return "FEED_NETWORK_FAILED";
}

export async function readPublicDriverFeed(sourceId, fetchImplementation = globalThis.fetch, { deadlineMs = 12000 } = {}) {
  if (!Object.hasOwn(PUBLIC_SOURCE_URLS, sourceId)) throw new Error("UNREGISTERED_DRIVER_SOURCE");
  if (!Number.isSafeInteger(deadlineMs) || deadlineMs < 1 || deadlineMs > 12000) throw Error("DRIVER_DEADLINE_CONFIGURATION");
  const controller = new AbortController(); let timer, reader;
  const deadline = new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(Error("FEED_DEADLINE_EXCEEDED")); }, deadlineMs); });
  const withinDeadline = work => Promise.race([work, deadline]);
  try {
    const response = await withinDeadline(fetchImplementation(PUBLIC_SOURCE_URLS[sourceId], {
      redirect: "manual", credentials: "omit", signal: controller.signal,
      headers: { "User-Agent": "Alpha-Options-Research/0.2 (public-feed monitor)", Accept: "application/rss+xml, application/atom+xml, text/xml, application/xml" },
    }));
    if (response.status !== 200 || response.redirected) throw Error(Number.isInteger(response.status) && response.status >= 100 && response.status <= 599 && response.status !== 200 ? `HTTP_${response.status}` : "FEED_HTTP_STATUS");
    if (!/^(?:text|application)\/(?:xml|rss\+xml|atom\+xml)(?:\s*;\s*charset\s*=\s*(?:utf-?8|"utf-?8"))?\s*$/i.test(response.headers.get("content-type") ?? "")) throw Error("UNEXPECTED_CONTENT_TYPE");
    const length = response.headers.get("content-length");
    if (length !== null && !/^\d+$/.test(length)) throw Error("INVALID_CONTENT_LENGTH");
    if (length !== null && Number(length) > MAX_FEED_BYTES) throw Error("FEED_TOO_LARGE");
    if (!response.body) throw Error("EMPTY_RESPONSE_BODY");
    reader = response.body.getReader();
    const chunks = []; let bytes = 0;
    while (true) {
      const { done, value } = await withinDeadline(reader.read());
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_FEED_BYTES) throw new Error("FEED_TOO_LARGE");
      chunks.push(value);
    }
    if (!bytes) throw Error("EMPTY_RESPONSE_BODY");
    try { return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(Buffer.concat(chunks)); }
    catch { throw Error("INVALID_FEED_UTF8"); }
  } catch (error) {
    const safe = /^(?:HTTP_[1-5]\d{2}|FEED_HTTP_STATUS|FEED_DEADLINE_EXCEEDED|FEED_TOO_LARGE|UNEXPECTED_CONTENT_TYPE|INVALID_CONTENT_LENGTH|EMPTY_RESPONSE_BODY|INVALID_FEED_UTF8)$/.test(error?.message);
    throw Error(safe ? error.message : networkFailureCode(error));
  } finally {
    clearTimeout(timer); controller.abort();
    if (reader) void Promise.resolve().then(() => reader.cancel()).catch(() => {});
  }
}

function within(root, candidate) {
  const rel = relative(root, candidate);
  if (rel === ".." || rel.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) || isAbsolute(rel)) throw new Error("DRIVER_STORE_PATH_ESCAPE");
}
/** Single-writer local history; interrupted/truncated stores fail visibly rather than being discarded. */
export function withDriverJournal(workspace, operation) {
  const root = realpathSync(workspace);
  let directory = root;
  for (const part of ["data", "runtime", "options-driver-monitor"]) {
    directory = resolve(directory, part);
    within(root, directory);
    if (existsSync(directory)) {
      if (lstatSync(directory).isSymbolicLink() || !lstatSync(directory).isDirectory()) throw new Error("UNSAFE_DRIVER_STORE_DIRECTORY");
    } else mkdirSync(directory);
    within(root, realpathSync(directory));
  }
  const path = resolve(directory, "refreshes.ndjson");
  const lock = resolve(directory, "writer.lock");
  const lockFd = openSync(lock, "wx");
  let active = true, uncertainWrite = false;
  try {
    const read = (file) => {
      if (!existsSync(file)) return [];
      const stat = lstatSync(file);
      if (stat.isSymbolicLink() || !stat.isFile() || stat.nlink !== 1 || stat.size > MAX_JOURNAL_BYTES) throw new Error("UNSAFE_OR_OVERSIZED_DRIVER_JOURNAL");
      const text = readFileSync(file, "utf8");
      if (text && !text.endsWith("\n")) throw new Error("TRUNCATED_DRIVER_JOURNAL_REQUIRES_REVIEW");
      return text ? text.trimEnd().split("\n").map((line) => JSON.parse(line)) : [];
    };
    const batches = read(path);
    const observations = [];
    const health = [];
    let previousFingerprint = null;
    for (const batch of batches) {
      if (!batch || typeof batch !== "object" || Array.isArray(batch)) throw new Error("INVALID_DRIVER_BATCH");
      const { fingerprint, ...body } = batch;
      if (Object.keys(body).length !== 4 || body.schemaVersion !== "1.0" || body.previousFingerprint !== previousFingerprint
        || !Array.isArray(body.observations) || body.observations.length > 600 || !Array.isArray(body.health) || body.health.length > 6
        || fingerprint !== `sha256:${createHash("sha256").update(JSON.stringify(body)).digest("hex")}`) throw new Error("DRIVER_BATCH_INTEGRITY_FAILURE");
      observations.push(...body.observations);
      health.push(...body.health);
      previousFingerprint = fingerprint;
    }
    const appendBatch = (newObservations, newHealth) => {
      if (!active) throw new Error("DRIVER_JOURNAL_SCOPE_CLOSED");
      if (uncertainWrite) throw new Error("DRIVER_JOURNAL_WRITE_UNCERTAIN_REOPEN_REQUIRED");
      if (!newObservations.length && !newHealth.length) return;
      if (newObservations.length > 600 || newHealth.length > 6) throw new Error("DRIVER_BATCH_LIMIT_EXCEEDED");
      const body = { schemaVersion: "1.0", previousFingerprint, observations: newObservations, health: newHealth };
      const fingerprint = `sha256:${createHash("sha256").update(JSON.stringify(body)).digest("hex")}`;
      const data = JSON.stringify({ ...body, fingerprint }) + "\n";
      let size = 0;
      if (existsSync(path)) {
        const stat = lstatSync(path);
        if (stat.isSymbolicLink() || !stat.isFile() || stat.nlink !== 1 || stat.size > MAX_JOURNAL_BYTES) throw Error("UNSAFE_OR_OVERSIZED_DRIVER_JOURNAL");
        size = stat.size;
      }
      if (size + Buffer.byteLength(data) > MAX_JOURNAL_BYTES) throw new Error("DRIVER_JOURNAL_ROTATION_REQUIRED");
      uncertainWrite = true;
      appendFileSync(path, data, "utf8");
      const fd = openSync(path, "r+");
      try { fsyncSync(fd); } finally { closeSync(fd); }
      previousFingerprint = fingerprint;
      uncertainWrite = false;
    };
    const result = operation({ observations, health, appendBatch, directory });
    if (result && (typeof result === "object" || typeof result === "function") && "then" in result) throw new Error("DRIVER_JOURNAL_REQUIRES_SYNCHRONOUS_CALLBACK");
    return result;
  } finally { active = false; closeSync(lockFd); unlinkSync(lock); }
}
