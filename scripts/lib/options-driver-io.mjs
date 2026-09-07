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

export async function readPublicDriverFeed(sourceId, fetchImplementation = globalThis.fetch) {
  if (!Object.hasOwn(PUBLIC_SOURCE_URLS, sourceId)) throw new Error("UNREGISTERED_DRIVER_SOURCE");
  const response = await fetchImplementation(PUBLIC_SOURCE_URLS[sourceId], {
    redirect: "manual", credentials: "omit", signal: AbortSignal.timeout(12000),
    headers: { "User-Agent": "Alpha-Options-Research/0.2 (public-feed monitor)", Accept: "application/rss+xml, application/atom+xml, text/xml, application/xml" },
  });
  if (response.status !== 200) throw new Error(`HTTP_${response.status}`);
  if (!/(?:xml|rss|atom)/i.test(response.headers.get("content-type") ?? "")) throw new Error("UNEXPECTED_CONTENT_TYPE");
  if (Number(response.headers.get("content-length") ?? 0) > MAX_FEED_BYTES) throw new Error("FEED_TOO_LARGE");
  if (!response.body) throw new Error("EMPTY_RESPONSE_BODY");
  const reader = response.body.getReader();
  const chunks = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_FEED_BYTES) throw new Error("FEED_TOO_LARGE");
      chunks.push(value);
    }
  } finally { await reader.cancel(); }
  return Buffer.concat(chunks).toString("utf8");
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
      if (stat.isSymbolicLink() || !stat.isFile() || stat.size > MAX_JOURNAL_BYTES) throw new Error("UNSAFE_OR_OVERSIZED_DRIVER_JOURNAL");
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
      if ((existsSync(path) ? lstatSync(path).size : 0) + Buffer.byteLength(data) > MAX_JOURNAL_BYTES) throw new Error("DRIVER_JOURNAL_ROTATION_REQUIRED");
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
