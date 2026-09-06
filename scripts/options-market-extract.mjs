import { createHash } from "node:crypto";
import { closeSync, createReadStream, existsSync, fstatSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { parseCboeOptionQuotesCsv } from "../src/integration/options-market-evidence/CboeOptionQuotesCsv.ts";
import { marketEvidenceFingerprint } from "../src/engines/options-market-evidence/OptionsMarketEvidenceEngine.ts";

const MAX_SOURCE_BYTES = 64 * 1024 * 1024, MAX_SOURCE_ROWS = 250_000;
const MAX_CHILD_BYTES = 4 * 1024 * 1024, MAX_CHILD_ROWS = 10_000, MAX_RECORD_BYTES = 16 * 1024;
const SELECTION_KEYS = ["selectionId", "sessionDate", "contractKeys", "rationale"];
const sha256 = (bytes) => "sha256:" + createHash("sha256").update(bytes).digest("hex");
const utc = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
function date(value) {
  return typeof value === "string" && /^[1-9]\d{3}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value + "T00:00:00.000Z")) && new Date(value + "T00:00:00.000Z").toISOString().slice(0, 10) === value;
}
function validateSelection(input) {
  if (!input || typeof input !== "object" || Array.isArray(input) || ![Object.prototype, null].includes(Object.getPrototypeOf(input))) throw new Error("EXTRACT_INVALID_SELECTION");
  const descriptors = Object.getOwnPropertyDescriptors(input);
  if (Reflect.ownKeys(input).length !== SELECTION_KEYS.length || SELECTION_KEYS.some((key) => !Object.hasOwn(descriptors, key)
    || !Object.hasOwn(descriptors[key], "value") || !descriptors[key].enumerable)) throw new Error("EXTRACT_INVALID_SELECTION_FIELDS");
  if (typeof input.selectionId !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(input.selectionId)
    || /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i.test(input.selectionId) || !date(input.sessionDate)
    || typeof input.rationale !== "string" || input.rationale !== input.rationale.trim() || input.rationale.length < 1 || input.rationale.length > 1000
    || /[\u0000-\u001F\u007F]/.test(input.rationale)) throw new Error("EXTRACT_INVALID_SELECTION");
  const keys = input.contractKeys;
  if (!Array.isArray(keys) || Object.getPrototypeOf(keys) !== Array.prototype || keys.length < 1 || keys.length > 4
    || Reflect.ownKeys(keys).length !== keys.length + 1) throw new Error("EXTRACT_INVALID_CONTRACT_SELECTION");
  for (let index = 0; index < keys.length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(keys, String(index));
    if (!descriptor || !Object.hasOwn(descriptor, "value") || !descriptor.enumerable || typeof descriptor.value !== "string") throw new Error("EXTRACT_INVALID_CONTRACT_SELECTION");
    const matched = /^(GLD|IBIT):([1-9]\d{3}-\d{2}-\d{2}):(CALL|PUT):([1-9]\d{0,15})$/.exec(descriptor.value);
    if (!matched || !date(matched[2]) || !Number.isSafeInteger(Number(matched[4]))) throw new Error("EXTRACT_INVALID_CONTRACT_SELECTION");
  }
  if (new Set(keys).size !== keys.length) throw new Error("EXTRACT_INVALID_CONTRACT_SELECTION");
  return Object.freeze({ selectionId: input.selectionId, sessionDate: input.sessionDate, contractKeys: Object.freeze([...keys].sort()), rationale: input.rationale });
}
function directoryWithin(root, parts, create) {
  let path = root;
  for (const part of parts) {
    path = resolve(path, part);
    if (!path.startsWith(root + sep)) throw new Error("EXTRACT_OUTPUT_PATH_ESCAPE");
    if (existsSync(path)) {
      const stat = lstatSync(path);
      if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error("EXTRACT_UNSAFE_OUTPUT_DIRECTORY");
      const actual = realpathSync(path);
      if (!actual.startsWith(root + sep)) throw new Error("EXTRACT_OUTPUT_PATH_ESCAPE");
    } else if (create) mkdirSync(path);
  }
  return path;
}
function checkedFile(path, maximum) {
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > maximum) throw new Error("EXTRACT_INVALID_OR_OVERSIZED_FILE");
  const bytes = readFileSync(path);
  if (bytes.byteLength > maximum) throw new Error("EXTRACT_INVALID_OR_OVERSIZED_FILE");
  return bytes;
}
function exclusiveWrite(path, content) {
  const fd = openSync(path, "wx");
  try { writeFileSync(fd, content, "utf8"); fsyncSync(fd); } finally { closeSync(fd); }
}
function stableManifest(manifest) {
  const { requestedAt, finishedAt, sourcePath, ...stable } = manifest;
  return stable;
}

/** Bounded local subset extraction; a selection is not data provenance or a trading instruction. */
export async function extractHistoricalQuoteSubset(workspaceRoot, sourcePath, selectionInput) {
  const selection = validateSelection(selectionInput), requestedAt = new Date().toISOString();
  if (typeof sourcePath !== "string" || !sourcePath) throw new Error("EXTRACT_INVALID_SOURCE_PATH");
  const root = realpathSync(workspaceRoot), input = resolve(root, sourcePath);
  const sourceStat = lstatSync(input);
  if (!sourceStat.isFile() || sourceStat.isSymbolicLink() || sourceStat.size > MAX_SOURCE_BYTES) throw new Error("EXTRACT_INVALID_OR_OVERSIZED_SOURCE");
  const fd = openSync(input, "r"), parentHash = createHash("sha256");
  let stream, sourceBytes = 0, sourceRowCount = 0, childBytes = 0, header = null, record = "", recordBytes = 0, inQuotes = false, pendingCr = false;
  const selected = [], keys = new Set(selection.contractKeys);
  const consumeRecord = () => {
    if (header === null) { parseCboeOptionQuotesCsv(record + "\n"); header = record; childBytes = new TextEncoder().encode(header + "\n").byteLength; }
    else {
      if (++sourceRowCount > MAX_SOURCE_ROWS) throw new Error("EXTRACT_SOURCE_ROW_LIMIT");
      const parsed = parseCboeOptionQuotesCsv(header + "\n" + record + "\n");
      const row = parsed.rows[0];
      if (row && row.root === row.underlyingSymbol && row.quoteDatetimeEt.slice(0, 10) === selection.sessionDate && keys.has(row.contractKey)) {
        if (selected.length >= MAX_CHILD_ROWS) throw new Error("EXTRACT_SELECTED_ROW_LIMIT");
        childBytes += new TextEncoder().encode(record + "\n").byteLength;
        if (childBytes > MAX_CHILD_BYTES) throw new Error("EXTRACT_CHILD_BYTE_LIMIT");
        selected.push(record);
      }
    }
    record = ""; recordBytes = 0;
  };
  const consumeText = (text) => {
    for (const character of text) {
      if (pendingCr) { pendingCr = false; if (character !== "\n") throw new Error("EXTRACT_INVALID_LINE_ENDING"); continue; }
      if (character === "\r" || character === "\n") {
        if (inQuotes) throw new Error("EXTRACT_MULTILINE_FIELDS_UNSUPPORTED");
        consumeRecord(); pendingCr = character === "\r"; continue;
      }
      if (character === '"') inQuotes = !inQuotes;
      const code = character.codePointAt(0);
      recordBytes += code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4;
      if (recordBytes > MAX_RECORD_BYTES) throw new Error("EXTRACT_RECORD_BYTE_LIMIT");
      record += character;
    }
  };
  try {
    const opened = fstatSync(fd);
    if (!opened.isFile() || opened.dev !== sourceStat.dev || opened.ino !== sourceStat.ino || opened.size !== sourceStat.size) throw new Error("EXTRACT_SOURCE_CHANGED");
    const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
    stream = createReadStream(input, { fd, autoClose: true, highWaterMark: 64 * 1024 });
    for await (const chunk of stream) {
      sourceBytes += chunk.byteLength;
      if (sourceBytes > MAX_SOURCE_BYTES) throw new Error("EXTRACT_SOURCE_BYTE_LIMIT");
      parentHash.update(chunk); consumeText(decoder.decode(chunk, { stream: true }));
    }
    consumeText(decoder.decode());
    if (pendingCr) throw new Error("EXTRACT_INVALID_LINE_ENDING");
    if (inQuotes) throw new Error("EXTRACT_UNTERMINATED_QUOTE");
    if (record.length) consumeRecord();
    if (header === null) throw new Error("EXTRACT_MISSING_HEADER");
    const after = lstatSync(input);
    if (!after.isFile() || after.isSymbolicLink() || after.dev !== opened.dev || after.ino !== opened.ino || sourceBytes !== opened.size
      || after.size !== opened.size || after.mtimeMs !== opened.mtimeMs || after.ctimeMs !== opened.ctimeMs) throw new Error("EXTRACT_SOURCE_CHANGED");
  } finally {
    if (!stream) closeSync(fd);
    else if (!stream.closed) await new Promise((done) => { stream.once("close", done); stream.destroy(); });
  }
  const child = [header, ...selected].join("\n") + "\n";
  const parsed = parseCboeOptionQuotesCsv(child);
  const manifest = {
    schemaVersion: "1.0", extractionVersion: "SOURCE_PRESERVING_CSV_SUBSET_V1", status: selected.length ? "EXTRACTED" : "NO_MATCH",
    selection, selectionFingerprint: marketEvidenceFingerprint(selection), requestedAt, finishedAt: new Date().toISOString(), sourcePath: input,
    parentRawSha256: "sha256:" + parentHash.digest("hex"), childSha256: selected.length ? sha256(child) : null,
    sourceBytes, sourceRowCount, selectedRowCount: selected.length, excludedRowCount: sourceRowCount - selected.length,
    normalizedSelectedRowCount: parsed.rows.length, duplicateSelectedRowCount: parsed.duplicateRowCount,
    selectionStatus: "RETROSPECTIVE_DECLARATION_NOT_PREREGISTERED", sourceClassification: "UNVERIFIED_LOCAL_FILE", recordSeparatorNormalization: "LF", executionAllowed: false,
  };
  if (manifest.finishedAt < requestedAt) throw new Error("EXTRACT_CLOCK_REGRESSION");
  const parent = directoryWithin(root, ["data", "runtime", "options-historical-replay", "extracts"], true);
  const output = directoryWithin(root, ["data", "runtime", "options-historical-replay", "extracts", selection.selectionId], false);
  const quotesPath = resolve(output, "quotes.csv"), manifestPath = resolve(output, "manifest.json");
  if (existsSync(output)) {
    const expectedNames = selected.length ? ["manifest.json", "quotes.csv"] : ["manifest.json"];
    if (JSON.stringify(readdirSync(output).sort()) !== JSON.stringify(expectedNames)) throw new Error("EXTRACT_PARTIAL_OR_UNEXPECTED_OUTPUT");
    const saved = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(checkedFile(manifestPath, 64 * 1024)));
    if (!saved || typeof saved !== "object" || Array.isArray(saved)) throw new Error("EXTRACT_INVALID_SAVED_MANIFEST");
    const { fingerprint, ...body } = saved;
    if (!utc(body.requestedAt) || !utc(body.finishedAt) || body.finishedAt < body.requestedAt || typeof body.sourcePath !== "string"
      || fingerprint !== marketEvidenceFingerprint(body) || marketEvidenceFingerprint(stableManifest(body)) !== marketEvidenceFingerprint(stableManifest(manifest))) throw new Error("EXTRACT_SELECTION_ID_CONFLICT_OR_CORRUPTION");
    if (selected.length && sha256(checkedFile(quotesPath, MAX_CHILD_BYTES)) !== manifest.childSha256) throw new Error("EXTRACT_CHILD_INTEGRITY_FAILURE");
    return { changed: false, manifest: saved, quotesPath: selected.length ? quotesPath : null, manifestPath, executionAllowed: false };
  }
  // Creating this directory exclusively is the publication claim. Any failed
  // subsequent write remains visible and blocks retry; no partial output is deleted.
  mkdirSync(resolve(parent, selection.selectionId));
  if (selected.length) exclusiveWrite(quotesPath, child);
  const saved = { ...manifest, fingerprint: marketEvidenceFingerprint(manifest) };
  exclusiveWrite(manifestPath, JSON.stringify(saved, null, 2) + "\n");
  return { changed: true, manifest: saved, quotesPath: selected.length ? quotesPath : null, manifestPath, executionAllowed: false };
}

export async function runOptionsMarketExtractCommand(args, { workspaceRoot = process.cwd() } = {}) {
  if (args.length !== 4 || args[0] !== "--input" || args[2] !== "--selection" || args[1].startsWith("--") || args[3].startsWith("--")) throw new Error("EXTRACT_UNSUPPORTED_COMMAND: --input <local CSV> --selection <local JSON>");
  const selection = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(checkedFile(resolve(workspaceRoot, args[3]), 16 * 1024)));
  return extractHistoricalQuoteSubset(workspaceRoot, args[1], selection);
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try { console.log(JSON.stringify(await runOptionsMarketExtractCommand(process.argv.slice(2)), null, 2)); }
  catch (error) { console.error(JSON.stringify({ status: "BLOCKED", executionAllowed: false, error: error instanceof Error ? error.message : "EXTRACT_COMMAND_FAILED" })); process.exitCode = 2; }
}
