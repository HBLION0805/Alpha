import { appendFileSync, closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, realpathSync, unlinkSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { assessBtcContext, reportBtcContext, btcContextClock, btcContextFingerprint, BTC_CONTEXT_URL, BTC_CONTEXT_MAX_BYTES } from "../../src/engines/options-btc-context/BtcSpotContextEngine.ts";

const MAX_JOURNAL_BYTES = 16 * 1024 * 1024;
const MAX_RETRIEVALS = 1000;
const fail = code => { throw Error("BTC_CONTEXT_" + code); };
/** Exactly one documented, anonymous fixed BTC-USD level 1 GET. No provider body enters an error. */
export async function retrieveBtcContext({ fetchImplementation = globalThis.fetch, clock = () => new Date().toISOString(), deadlineMs = 12000 } = {}) {
  if (!Number.isSafeInteger(deadlineMs) || deadlineMs < 1 || deadlineMs > 12000) fail("DEADLINE_CONFIGURATION");
  const requestedAt = clock(); btcContextClock(requestedAt);
  const url = BTC_CONTEXT_URL, controller = new AbortController();
  let timer, reader, sourceText = null, errorCode = null;
  const deadline = new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(Error("DEADLINE_EXCEEDED")); }, deadlineMs); });
  const withinDeadline = work => Promise.race([work, deadline]);
  try {
    const response = await withinDeadline(fetchImplementation(url, { redirect: "manual", credentials: "omit", signal: controller.signal,
      headers: { "User-Agent": "Alpha-Options-Research/0.2 (public IBIT underlying context)", Accept: "application/json" } }));
    if (response.status !== 200 || response.redirected) throw Error("HTTP_STATUS");
    if (!/^application\/json(?:\s*;\s*charset\s*=\s*(?:utf-8|"utf-8"))?\s*$/i.test(response.headers.get("content-type") ?? "")) throw Error("CONTENT_TYPE");
    const length = response.headers.get("content-length");
    if (length !== null && (!/^\d+$/.test(length) || Number(length) > BTC_CONTEXT_MAX_BYTES)) throw Error("BODY_TOO_LARGE");
    if (!response.body) throw Error("BODY_MISSING");
    reader = response.body.getReader();
    const chunks = []; let bytes = 0;
    while (true) {
      const part = await withinDeadline(reader.read());
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > BTC_CONTEXT_MAX_BYTES) throw Error("BODY_TOO_LARGE");
      chunks.push(part.value);
    }
    if (!bytes) throw Error("BODY_MISSING");
    try { sourceText = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(Buffer.concat(chunks)); }
    catch { throw Error("INVALID_UTF8"); }
  } catch (error) {
    const allowed = ["DEADLINE_EXCEEDED", "HTTP_STATUS", "CONTENT_TYPE", "BODY_TOO_LARGE", "BODY_MISSING", "INVALID_UTF8"];
    errorCode = allowed.includes(error?.message) ? error.message : "NETWORK_FAILED";
    sourceText = null;
  } finally {
    clearTimeout(timer); controller.abort();
    if (reader) void reader.cancel().catch(() => {});
  }
  const receivedAt = clock();
  btcContextClock(receivedAt);
  if (receivedAt < requestedAt) fail("CLOCK_ROLLBACK");
  let input = { requestedAt, receivedAt, url, sourceText, errorCode };
  if (sourceText !== null) {
    try { assessBtcContext(input); }
    catch { input = { ...input, sourceText: null, errorCode: "SOURCE_SCHEMA" }; }
  }
  return { input, assessment: assessBtcContext(input) };
}

function within(root, file) {
  const path = relative(root, file);
  if (isAbsolute(path) || path === ".." || path.startsWith(".." + sep)) fail("STORE_PATH_ESCAPE");
}
function safeFile(path) {
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > MAX_JOURNAL_BYTES) fail("UNSAFE_OR_OVERSIZED_JOURNAL");
  return stat;
}
/** Single-process, single-writer journal. Corruption fails without rewriting prior history. */
export async function withBtcContextJournal(workspace, operation, assessedAt = new Date().toISOString()) {
  btcContextClock(assessedAt);
  const root = realpathSync(workspace);
  let directory = root;
  for (const part of ["data", "runtime", "options-btc-context"]) {
    directory = resolve(directory, part); within(root, directory);
    if (existsSync(directory)) {
      const stat = lstatSync(directory);
      if (!stat.isDirectory() || stat.isSymbolicLink()) fail("UNSAFE_STORE_DIRECTORY");
    } else mkdirSync(directory);
    within(root, realpathSync(directory));
  }
  const path = resolve(directory, "retrievals.ndjson"), lock = resolve(directory, "writer.lock");
  const fd = openSync(lock, "wx");
  let active = true, uncertainWrite = false;
  try {
    const text = existsSync(path) ? (safeFile(path), readFileSync(path, "utf8")) : "";
    if (text && !text.endsWith("\n")) fail("TRUNCATED_JOURNAL_REQUIRES_REVIEW");
    const lines = text ? text.slice(0, -1).split("\n") : [];
    if (lines.length > MAX_RETRIEVALS) fail("JOURNAL_LIMIT");
    const inputs = []; let previousFingerprint = null;
    for (const line of lines) {
      let record;
      try { record = JSON.parse(line); } catch { fail("JOURNAL_JSON"); }
      if (!record || typeof record !== "object" || Array.isArray(record)) fail("JOURNAL_SHAPE");
      const { fingerprint, ...body } = record;
      if (Object.keys(body).sort().join() !== "assessment,input,previousFingerprint,version" || body.version !== "1.0" ||
        body.previousFingerprint !== previousFingerprint || btcContextFingerprint(body) !== fingerprint) fail("JOURNAL_INTEGRITY");
      const assessment = assessBtcContext(body.input);
      if (btcContextFingerprint(assessment) !== btcContextFingerprint(body.assessment)) fail("JOURNAL_ASSESSMENT");
      inputs.push(body.input); previousFingerprint = fingerprint;
    }
    reportBtcContext(inputs, assessedAt);
    const append = (input, savedAt = new Date().toISOString()) => {
      if (!active) fail("JOURNAL_SCOPE_CLOSED");
      if (uncertainWrite) fail("JOURNAL_WRITE_UNCERTAIN_REOPEN_REQUIRED");
      const next = structuredClone(input), assessment = assessBtcContext(next);
      reportBtcContext([...inputs, next], savedAt);
      if (inputs.length >= MAX_RETRIEVALS) fail("JOURNAL_LIMIT");
      const body = { version: "1.0", previousFingerprint, input: next, assessment };
      const fingerprint = btcContextFingerprint(body), line = JSON.stringify({ ...body, fingerprint }) + "\n";
      const currentSize = existsSync(path) ? safeFile(path).size : 0;
      if (currentSize + Buffer.byteLength(line) > MAX_JOURNAL_BYTES) fail("JOURNAL_ROTATION_REQUIRED");
      uncertainWrite = true;
      appendFileSync(path, line, { encoding: "utf8", flag: existsSync(path) ? "a" : "wx" });
      const syncFd = openSync(path, "r+");
      try { fsyncSync(syncFd); } finally { closeSync(syncFd); }
      inputs.push(next); previousFingerprint = fingerprint;
      uncertainWrite = false;
      return { fingerprint, retrievalCount: inputs.length, assessment };
    };
    return await operation({ directory, path, inputs: structuredClone(inputs), previousFingerprint, append });
  } finally { active = false; closeSync(fd); unlinkSync(lock); }
}
