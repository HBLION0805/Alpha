import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";
import { closeSync, fstatSync, fsyncSync, lstatSync, mkdirSync, openSync, readSync, realpathSync, writeFileSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { validateSelection } from "./options-market-extract.mjs";
import { parseCboeOptionQuotesCsv } from "../src/integration/options-market-evidence/CboeOptionQuotesCsv.ts";
import { createOptionsMarketEvidence, marketEvidenceFingerprint } from "../src/engines/options-market-evidence/OptionsMarketEvidenceEngine.ts";
import { validateHistoricalReplayConfig } from "../src/engines/options-historical-replay/OptionsHistoricalReplayEngine.ts";

const HEADER = "underlying_symbol,quote_datetime,root,expiration,strike,option_type,open,high,low,close,trade_volume,bid_size,bid,ask_size,ask,underlying_bid,underlying_ask\n";
const MANIFEST_KEYS = ["schemaVersion", "extractionVersion", "status", "selection", "selectionFingerprint", "requestedAt", "finishedAt", "sourcePath", "parentRawSha256", "childSha256", "sourceBytes", "sourceRowCount", "selectedRowCount", "excludedRowCount", "normalizedSelectedRowCount", "duplicateSelectedRowCount", "selectionStatus", "sourceClassification", "recordSeparatorNormalization", "executionAllowed", "fingerprint"];
const EXTRACT_PREFIX = ["data", "runtime", "options-historical-replay", "extracts"];
const MAX_ARTIFACT_BYTES = 16 * 1024 * 1024;
const ET = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" });
const digest = (value) => createHash("sha256").update(value).digest("hex");
const hash = (value) => "sha256:" + digest(value);
const isHash = (value) => typeof value === "string" && /^sha256:[0-9a-f]{64}$/.test(value);
const utc = (value) => typeof value === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const integer = (value, maximum) => Number.isSafeInteger(value) && !Object.is(value, -0) && value >= 0 && value <= maximum;
function freeze(value) { if (value && typeof value === "object") { for (const child of Object.values(value)) freeze(child); Object.freeze(value); } return value; }
function exact(value, keys, code) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length !== keys.length || keys.some((key) => !Object.hasOwn(value, key))) throw new Error(code);
}
function statOrNull(path) { try { return lstatSync(path); } catch (error) { if (error.code === "ENOENT") return null; throw error; } }
function readBounded(path, maximum) {
  const before = lstatSync(path);
  if (!before.isFile() || before.isSymbolicLink() || before.size > maximum) throw new Error("PREFLIGHT_UNSAFE_OR_OVERSIZED_INPUT");
  const same = (stat) => stat.isFile() && !stat.isSymbolicLink() && stat.dev === before.dev && stat.ino === before.ino
    && stat.size === before.size && stat.mtimeMs === before.mtimeMs && stat.ctimeMs === before.ctimeMs;
  const fd = openSync(path, "r");
  try {
    if (!same(fstatSync(fd)) || !same(lstatSync(path))) throw new Error("PREFLIGHT_INPUT_CHANGED");
    const buffer = Buffer.alloc(maximum + 1);
    let count = 0;
    while (count < buffer.length) {
      const read = readSync(fd, buffer, count, buffer.length - count, null);
      if (read === 0) break;
      count += read;
    }
    if (count > maximum) throw new Error("PREFLIGHT_UNSAFE_OR_OVERSIZED_INPUT");
    if (count !== before.size || !same(fstatSync(fd)) || !same(lstatSync(path))) throw new Error("PREFLIGHT_INPUT_CHANGED");
    const bytes = buffer.subarray(0, count);
    return { bytes, text: new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes) };
  } finally { closeSync(fd); }
}
const json = (path, maximum) => JSON.parse(readBounded(path, maximum).text.replace(/^\uFEFF/, ""));
function checkedDirectories(root, parts, create = false) {
  let path = root;
  for (const part of parts) {
    path = resolve(path, part);
    if (!path.startsWith(root + sep)) throw new Error("PREFLIGHT_PATH_ESCAPE");
    const stat = statOrNull(path);
    if (stat) {
      if (!stat.isDirectory() || stat.isSymbolicLink() || !realpathSync(path).startsWith(root + sep)) throw new Error("PREFLIGHT_UNSAFE_DIRECTORY");
    } else if (create) mkdirSync(path);
    else throw new Error("PREFLIGHT_MISSING_DIRECTORY");
  }
  return path;
}
function loadInputs(root, manifestInput, metadataInput, configInput, requestedAt) {
  if (!utc(requestedAt)) throw new Error("PREFLIGHT_INVALID_REQUEST_CLOCK");
  const manifestPath = resolve(root, manifestInput), pathParts = relative(root, manifestPath).split(sep);
  if (pathParts.length !== 6 || EXTRACT_PREFIX.some((part, index) => pathParts[index] !== part) || pathParts[5] !== "manifest.json") throw new Error("PREFLIGHT_MANIFEST_OUTSIDE_EXTRACTS");
  const directory = checkedDirectories(root, pathParts.slice(0, -1));
  const manifest = json(manifestPath, 64 * 1024);
  exact(manifest, MANIFEST_KEYS, "PREFLIGHT_INVALID_MANIFEST_FIELDS");
  const selection = validateSelection(manifest.selection);
  if (selection.selectionId !== pathParts[4] || marketEvidenceFingerprint(selection) !== marketEvidenceFingerprint(manifest.selection)
    || manifest.selectionFingerprint !== marketEvidenceFingerprint(selection)) throw new Error("PREFLIGHT_SELECTION_INTEGRITY_FAILURE");
  const { fingerprint, ...body } = manifest;
  if (fingerprint !== marketEvidenceFingerprint(body) || manifest.schemaVersion !== "1.0" || manifest.extractionVersion !== "SOURCE_PRESERVING_CSV_SUBSET_V1"
    || !["EXTRACTED", "NO_MATCH"].includes(manifest.status) || !utc(manifest.requestedAt) || !utc(manifest.finishedAt)
    || manifest.requestedAt > manifest.finishedAt || manifest.finishedAt > requestedAt || !isHash(manifest.parentRawSha256)
    || typeof manifest.sourcePath !== "string" || manifest.sourcePath.length < 1 || manifest.sourcePath.length > 4096 || /[\u0000-\u001f\u007f]/.test(manifest.sourcePath)
    || manifest.selectionStatus !== "RETROSPECTIVE_DECLARATION_NOT_PREREGISTERED" || manifest.sourceClassification !== "UNVERIFIED_LOCAL_FILE"
    || manifest.recordSeparatorNormalization !== "LF" || manifest.executionAllowed !== false) throw new Error("PREFLIGHT_MANIFEST_INTEGRITY_FAILURE");
  if (!integer(manifest.sourceBytes, 64 * 1024 * 1024) || manifest.sourceBytes === 0 || !integer(manifest.sourceRowCount, 250_000)
    || !integer(manifest.selectedRowCount, 10_000) || !integer(manifest.excludedRowCount, 250_000) || !integer(manifest.normalizedSelectedRowCount, 10_000)
    || !integer(manifest.duplicateSelectedRowCount, 10_000) || manifest.sourceRowCount !== manifest.selectedRowCount + manifest.excludedRowCount
    || manifest.selectedRowCount !== manifest.normalizedSelectedRowCount + manifest.duplicateSelectedRowCount) throw new Error("PREFLIGHT_MANIFEST_COUNT_MISMATCH");
  const childPath = resolve(directory, "quotes.csv");
  let child = null;
  if (manifest.status === "NO_MATCH") {
    if (manifest.selectedRowCount !== 0 || manifest.childSha256 !== null || statOrNull(childPath)) throw new Error("PREFLIGHT_NO_MATCH_INTEGRITY_FAILURE");
  } else {
    if (!isHash(manifest.childSha256) || manifest.normalizedSelectedRowCount === 0) throw new Error("PREFLIGHT_EXTRACTED_MANIFEST_INCOMPLETE");
    child = readBounded(childPath, 4 * 1024 * 1024);
    if (hash(child.bytes) !== manifest.childSha256) throw new Error("PREFLIGHT_CHILD_HASH_MISMATCH");
    if (child.text.includes("\r") || !child.text.endsWith("\n")) throw new Error("PREFLIGHT_CHILD_RECORD_NORMALIZATION_MISMATCH");
    const parsed = parseCboeOptionQuotesCsv(child.text);
    if (parsed.nonTargetRowCount !== 0 || parsed.rows.length !== manifest.normalizedSelectedRowCount || parsed.duplicateRowCount !== manifest.duplicateSelectedRowCount
      || parsed.rows.some((row) => row.root !== row.underlyingSymbol || row.quoteDatetimeEt.slice(0, 10) !== selection.sessionDate || !selection.contractKeys.includes(row.contractKey))) throw new Error("PREFLIGHT_CHILD_SELECTION_OR_COUNT_MISMATCH");
  }
  const config = validateHistoricalReplayConfig(json(resolve(root, configInput), 64 * 1024));
  const metadata = createOptionsMarketEvidence(HEADER, json(resolve(root, metadataInput), 16 * 1024), requestedAt).metadata;
  return { manifest, config, metadata, childText: child?.text ?? null,
    manifestPath: pathParts.join("/"), childPath: child ? [...pathParts.slice(0, -1), "quotes.csv"].join("/") : null };
}
function buildReport(inputs, requestedAt) {
  if (!utc(requestedAt) || requestedAt < inputs.manifest.finishedAt) throw new Error("PREFLIGHT_INVALID_PREPARATION_CLOCK");
  const { config, metadata, manifest } = inputs;
  const candidate = inputs.childText === null ? null : createOptionsMarketEvidence(inputs.childText, metadata, requestedAt);
  const blockers = [];
  if (!candidate || candidate.rows.length === 0) blockers.push("NO_TARGET_QUOTES");
  if (metadata.datasetId !== config.datasetId) blockers.push("DATASET_ID_MISMATCH");
  if (!manifest.selection.contractKeys.includes(config.contractKey)) blockers.push("SELECTED_CONTRACT_UNDECLARED");
  if (!candidate?.rows.some((row) => row.contractKey === config.contractKey)) blockers.push("SELECTED_CONTRACT_MISSING");
  const local = Object.fromEntries(ET.formatToParts(new Date(config.plan.decisionAt)).map((part) => [part.type, part.value]));
  if (`${local.year.padStart(4, "0")}-${local.month}-${local.day}` !== manifest.selection.sessionDate) blockers.push("PLAN_DATE_MISMATCH");
  if (!config.assumptions.contractTerms) blockers.push("CONTRACT_ASSUMPTIONS_MISSING");
  if (!config.assumptions.session) blockers.push("SESSION_ASSUMPTIONS_MISSING");
  else if (config.assumptions.session.sessionDate !== manifest.selection.sessionDate) blockers.push("SESSION_DATE_MISMATCH");
  if (!config.assumptions.costs) blockers.push("COST_ASSUMPTIONS_MISSING");
  if (!config.assumptions.acknowledgeCounterfactual) blockers.push("COUNTERFACTUAL_ACKNOWLEDGEMENT_MISSING");
  if (metadata.origin === "OWNER_PROVIDED_FILE" && metadata.usageDeclaration !== "OWNER_ATTESTED_LOCAL_USE") blockers.push("OWNER_USAGE_DECLARATION_MISSING");
  if (metadata.delivery !== "HISTORICAL_FILE") blockers.push("HISTORICAL_FILE_DELIVERY_REQUIRED");
  if (metadata.intervalMinutes > 15) blockers.push("RESEARCH_INTERVAL_UNSUPPORTED");
  if (manifest.selection.sessionDate >= "2026-06-22" && config.assumptions.liquidityModel === "REQUIRE_CONTEMPORANEOUS_SIZE") blockers.push("CONTEMPORANEOUS_SIZE_UNPROVEN");
  return freeze({ schemaVersion: "1.0", engineVersion: "INPUT_PREPARATION_V1", requestedAt,
    status: blockers.length ? "BLOCKED" : "INPUTS_LINKED_FOR_RESEARCH", blockers: [...new Set(blockers)].sort(),
    inputFingerprints: { config: marketEvidenceFingerprint(config), metadata: marketEvidenceFingerprint(metadata), sourceManifest: manifest.fingerprint,
      childSha256: manifest.childSha256, evidenceCandidate: candidate ? marketEvidenceFingerprint(candidate) : null },
    metadata, config, sourceManifest: manifest, sourceManifestPath: inputs.manifestPath, childPath: inputs.childPath, childSha256: manifest.childSha256,
    evidenceCandidate: candidate, candidateImportStatus: "NOT_SAVED_MARKET_IMPORT_PREPARATION_CLOCK_ONLY", sourceOrigin: metadata.origin,
    executionAllowed: false, marketValidated: false, winProbability: null, brokerAccountVerified: false, originalQualificationUnchanged: true, tradesExecuted: 0,
    limitations: [
      "Linked inputs are coherent declarations, not verified data rights, publisher identity, listed contract terms, calendar accuracy or actual broker fees.",
      "The parent hash is a linked extractor claim. This preflight verifies the current child bytes and does not open or authenticate the manifest-supplied parent path.",
      "This preparation does not evaluate affordability, available liquidity, path completeness, strategy quality or any hypothetical fill.",
      "The candidate import clock is the actual preparation read time. The candidate is not a saved market import or historical feed-availability claim.",
      "Selection remains retrospective and replay remains counterfactual. The original market qualification gate and all prior journals are unchanged.",
    ],
    nextSteps: [
      { action: "MANUAL_MARKET_IMPORT", command: "npm run options:market-data -- --import <validated quotes.csv> --metadata <reviewed metadata.json>", condition: "Resolve blockers and retain this manifest/preparation. Import only the entitled child with the reviewed dataset ID; the importer assigns its own actual clock." },
      { action: "MANUAL_RESEARCH_RUN", command: "npm run options:historical-replay -- --input <reviewed research-config.json>", condition: "Use the reviewed contract, session, costs and explicit counterfactual assumptions. Changed inputs require a new run ID; no broker order is authorized." },
    ],
  });
}
const semanticIdentity = ({ config, metadata, manifest }) => marketEvidenceFingerprint({ config, metadata, sourceManifest: manifest, childSha256: manifest.childSha256 });

export function runOptionsResearchPreflightCommand(args, { workspaceRoot = process.cwd(), now = () => new Date().toISOString() } = {}) {
  if (args.length === 1 && args[0] === "--help") return { command: "options:research-preflight", usage: "--manifest <JSON> --metadata <JSON> --config <JSON> [--save]", executionAllowed: false,
    meaning: "Link declared research inputs without imports, fills or brokerage access. --save preserves one immutable preparation per run ID; existing qualification gates remain unchanged." };
  const save = args.length === 7 && args[6] === "--save";
  if ((!save && args.length !== 6) || args[0] !== "--manifest" || args[2] !== "--metadata" || args[4] !== "--config"
    || [args[1], args[3], args[5]].some((path) => typeof path !== "string" || path.startsWith("--"))) throw new Error("PREFLIGHT_UNSUPPORTED_COMMAND");
  const root = realpathSync(workspaceRoot), requestedAt = now();
  const inputs = loadInputs(root, args[1], args[3], args[5], requestedAt);
  const report = buildReport(inputs, requestedAt), identity = semanticIdentity(inputs);
  if (!save) return freeze({ saved: false, changed: false, artifactPath: null, report });
  const directory = checkedDirectories(root, ["data", "runtime", "options-historical-replay", "preparations"], true);
  const artifactPath = resolve(directory, digest(inputs.config.runId) + ".json");
  if (statOrNull(artifactPath)) {
    const saved = json(artifactPath, MAX_ARTIFACT_BYTES);
    exact(saved, ["schemaVersion", "requestedAt", "semanticFingerprint", "report", "fingerprint"], "PREFLIGHT_INVALID_SAVED_ARTIFACT");
    const { fingerprint, ...body } = saved;
    if (body.schemaVersion !== "1.0" || !utc(body.requestedAt) || body.requestedAt > requestedAt || fingerprint !== marketEvidenceFingerprint(body)) throw new Error("PREFLIGHT_SAVED_ARTIFACT_INTEGRITY_FAILURE");
    if (body.semanticFingerprint !== identity) throw new Error("PREFLIGHT_RUN_ID_CONFLICT");
    const recomputed = buildReport(inputs, body.requestedAt);
    if (marketEvidenceFingerprint(body.report) !== marketEvidenceFingerprint(recomputed)) throw new Error("PREFLIGHT_SAVED_REPORT_REPLAY_MISMATCH");
    return freeze({ saved: true, changed: false, artifactPath, report: recomputed });
  }
  const body = { schemaVersion: "1.0", requestedAt, semanticFingerprint: identity, report };
  const serialized = JSON.stringify({ ...body, fingerprint: marketEvidenceFingerprint(body) }, null, 2) + "\n";
  if (new TextEncoder().encode(serialized).byteLength > MAX_ARTIFACT_BYTES) throw new Error("PREFLIGHT_ARTIFACT_BYTE_LIMIT");
  const fd = openSync(artifactPath, "wx");
  try { writeFileSync(fd, serialized, "utf8"); fsyncSync(fd); } finally { closeSync(fd); }
  return freeze({ saved: true, changed: true, artifactPath, report });
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try { console.log(JSON.stringify(runOptionsResearchPreflightCommand(process.argv.slice(2)), null, 2)); }
  catch (error) { console.error(JSON.stringify({ status: "BLOCKED", executionAllowed: false, error: error instanceof Error ? error.message : "PREFLIGHT_COMMAND_FAILED" })); process.exitCode = 2; }
}
