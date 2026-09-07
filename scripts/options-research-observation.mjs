import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, realpathSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { runOptionsResearchProtocolCommand } from "./options-research-protocol.mjs";
import { runOptionsContextCaptureCommand, CONTEXT_CAPTURE_MAX_BYTES } from "./options-context-capture.mjs";
import { optionsEvidenceExportStorage as io } from "./options-evidence-export.mjs";
import { parseOptionsSampleJson } from "./options-sample-partition.mjs";
import { exportId } from "../src/engines/options-evidence-export/OptionsEvidenceExportEngine.ts";
import { readinessClock, readinessFingerprint } from "../src/engines/options-readiness/OptionsReadinessEngine.ts";
import { freezePaper } from "../src/engines/options-paper/OptionsPaperTradingEngine.ts";

const INPUT_MAX = 256 * 1024, PROTOCOL_MAX = 2 * 1024 * 1024, RECEIPT_MAX = 64 * 1024;
const REPORT_MAX = 128 * 1024 * 1024;
const BASE = "data/runtime/options-research-observations";
const fail = code => { throw Error("RESEARCH_OBSERVATION_" + code); };
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
function parse(bytes) { try { return parseOptionsSampleJson(bytes); } catch { fail("JSON_ENCODING_OR_STRUCTURE"); } }
function encode(value, max) { const bytes = Buffer.from(JSON.stringify(value, null, 2) + "\n"); if (bytes.length > max) fail("SIZE_LIMIT"); return bytes; }

/** @param {import('../src/contracts/OptionsResearchObservation.ts').OptionsResearchObservationInput} input */
export function validateOptionsResearchObservation(input) {
  const keys = ["version", "observationId", "protocolId", "captureId", "symbol", "disposition", "reason"];
  if (!input || typeof input !== "object" || Object.getPrototypeOf(input) !== Object.prototype) fail("SHAPE");
  const descriptors = Object.getOwnPropertyDescriptors(input), own = Reflect.ownKeys(input);
  if (own.length !== keys.length || own.some(k => typeof k !== "string" || !keys.includes(k) || !("value" in descriptors[k]) || !descriptors[k].enumerable)) fail("SHAPE");
  if (input.version !== "OPTIONS_RESEARCH_OBSERVATION_INPUT_V1") fail("VERSION");
  for (const key of ["observationId", "protocolId", "captureId"]) exportId(input[key]);
  if (!["GLD", "IBIT"].includes(input.symbol)) fail("SYMBOL_SCOPE");
  if (!["OBSERVE_ONLY", "NO_TRADE"].includes(input.disposition)) fail("DISPOSITION");
  if (typeof input.reason !== "string" || !input.reason.trim() || input.reason.length > 16_384 ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(input.reason) || /[\uD800-\uDFFF]/u.test(input.reason)) fail("REASON_TEXT");
  return freezePaper(structuredClone(input));
}

async function dependencies(root, input, now) {
  const protocol = runOptionsResearchProtocolCommand(["--verify", input.protocolId], { workspaceRoot: root, now });
  const context = await runOptionsContextCaptureCommand(["--verify", input.captureId], { workspaceRoot: root, now });
  const files = [
    { path: protocol.path + "/payload.json", limit: PROTOCOL_MAX, sha256: protocol.payloadSha256 },
    { path: protocol.path + "/receipt.json", limit: RECEIPT_MAX, sha256: protocol.receiptSha256 },
    { path: context.path + "/payload.json", limit: CONTEXT_CAPTURE_MAX_BYTES, sha256: context.payloadSha256 },
    { path: context.path + "/receipt.json", limit: RECEIPT_MAX, sha256: context.receiptSha256 },
  ].map(file => { const bytes = io.readBytes(root, file.path, file.limit); if (sha(bytes) !== file.sha256) fail("DEPENDENCY_CHANGED"); return { ...file, bytes }; });
  return { protocol, context, files, declaration: parse(files[0].bytes).assessment.declaration, contextReport: parse(files[2].bytes).report };
}
function unchanged(root, files) {
  for (const file of files) if (!file.bytes.equals(io.readBytes(root, file.path, file.limit))) fail("DEPENDENCY_CHANGED");
}
function inspection(raw, input, { protocol, context, declaration, contextReport }, startedAt, observationAt) {
  for (const at of [startedAt, observationAt, protocol.verifiedAt, context.verifiedAt]) readinessClock(at);
  if (protocol.verifiedAt < startedAt || protocol.verifiedAt < protocol.receiptPreparedAt || context.verifiedAt < context.receiptPreparedAt ||
    context.verifiedAt < protocol.verifiedAt || observationAt <= protocol.verifiedAt || observationAt <= context.verifiedAt) fail("OBSERVATION_CLOCK_ORDER");
  const inDeclaredWindow = Object.values(declaration.windows).some(w => observationAt >= w.startAt && observationAt < w.endAt);
  const body = { version: "OPTIONS_RESEARCH_OBSERVATION_INSPECTION_V1", status: "REFERENCES_RECOMPUTED_OBSERVATION_NOT_SAVED",
    input, sourceInputText: new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(raw), sourceInputSha256: sha(raw), sourceInputBytes: raw.length,
    startedAt, observationAt, protocol, context, contextReport,
    datasetId: declaration.datasetId, origin: declaration.origin, strategyVersion: declaration.strategyVersion,
    declaredWindows: declaration.windows, observationInsideDeclaredWindow: inDeclaredWindow,
    diagnostics: [...(protocol.payloadFrozenBeforeFirstWindow ? [] : ["LATE_PROTOCOL_PAYLOAD"]),
      ...(protocol.receiptPreparedBeforeFirstWindow ? [] : ["PROTOCOL_RECEIPT_PREPARED_AT_OR_AFTER_FIRST_WINDOW"]),
      ...(inDeclaredWindow ? [] : ["OBSERVATION_OUTSIDE_DECLARED_WINDOWS"])],
    contextAgeAtObservationMs: Date.parse(observationAt) - Date.parse(context.cutoffAt), contextFreshnessAssessedAt: context.cutoffAt,
    contextFreshnessAtObservationProven: false, recordSaved: false, payloadSavedAt: null,
    featureWindowStartAt: null, featuresKnownAt: null, episodeId: null, outcomeState: null, outcomeKnownAt: null,
    featureCompletenessProven: false, sampleInputGenerated: false, sampleCount: 0, historicalDecisionProven: false,
    heldOutAccessSealed: false, externalTimestampAttested: false, snapshotAtomicAcrossStores: false,
    sourceStoresRead: false, sourceJournalAppends: 0, networkAccess: false, winProbability: null, replayAllowed: false, executionAllowed: false };
  const report = { ...body, artifactSha256: readinessFingerprint(body) };
  if (Buffer.byteLength(JSON.stringify(report), "utf8") > REPORT_MAX) fail("SIZE_LIMIT");
  return freezePaper(report);
}
function payload(report) { return { version: "OPTIONS_RESEARCH_OBSERVATION_PAYLOAD_V1", observationId: report.input.observationId, inspection: report }; }
function receipt(saved, bytes, payloadSavedAt, receiptPreparedAt) {
  readinessClock(payloadSavedAt); readinessClock(receiptPreparedAt);
  if (payloadSavedAt < saved.inspection.observationAt || receiptPreparedAt < payloadSavedAt) fail("SAVE_CLOCK_ORDER");
  return { version: "OPTIONS_RESEARCH_OBSERVATION_RECEIPT_V1", observationId: saved.observationId,
    payloadSha256: sha(bytes), payloadBytes: bytes.length, inspectionSha256: saved.inspection.artifactSha256,
    protocolPayloadSha256: saved.inspection.protocol.payloadSha256, protocolReceiptSha256: saved.inspection.protocol.receiptSha256,
    contextPayloadSha256: saved.inspection.context.payloadSha256, contextReceiptSha256: saved.inspection.context.receiptSha256,
    payloadSavedAt, receiptPreparedAt, clockBasis: "LOCAL_CLOCK_OBSERVED_AFTER_PAYLOAD_FSYNC_AND_CLOSE", externalTimestampAttested: false };
}
async function verify(root, observationId, now) {
  const base = BASE + "/" + observationId; let bytes, receiptBytes;
  try { bytes = io.readBytes(root, base + "/payload.json", REPORT_MAX); receiptBytes = io.readBytes(root, base + "/receipt.json", RECEIPT_MAX); }
  catch (error) { if (error?.code === "ENOENT") fail("PAIR_INCOMPLETE_OR_MISSING"); throw error; }
  const saved = parse(bytes), savedReceipt = parse(receiptBytes);
  if (!saved || saved.version !== "OPTIONS_RESEARCH_OBSERVATION_PAYLOAD_V1" || saved.observationId !== observationId) fail("PAYLOAD_ID_OR_VERSION");
  if (!savedReceipt || savedReceipt.version !== "OPTIONS_RESEARCH_OBSERVATION_RECEIPT_V1" || savedReceipt.observationId !== observationId) fail("RECEIPT_ID_OR_VERSION");
  if (savedReceipt.payloadSha256 !== sha(bytes) || savedReceipt.payloadBytes !== bytes.length) fail("PAYLOAD_BYTES_MISMATCH");
  const original = saved.inspection;
  if (!original || typeof original.sourceInputText !== "string" || /[\uD800-\uDFFF]/u.test(original.sourceInputText)) fail("INPUT_TEXT");
  const raw = Buffer.from(original.sourceInputText, "utf8"); if (raw.length > INPUT_MAX) fail("SIZE_LIMIT");
  const input = validateOptionsResearchObservation(parse(raw)); if (input.observationId !== observationId) fail("PAYLOAD_ID_OR_VERSION");
  const recovered = await dependencies(root, input, now);
  // Recompute original evidence at original clocks, while independently verifying current bytes.
  const historical = { ...recovered, protocol: { ...recovered.protocol, verifiedAt: original.protocol?.verifiedAt }, context: { ...recovered.context, verifiedAt: original.context?.verifiedAt } };
  const rebuilt = payload(inspection(raw, input, historical, original.startedAt, original.observationAt));
  if (!bytes.equals(encode(rebuilt, REPORT_MAX))) fail("PAYLOAD_RECOMPUTATION_MISMATCH");
  const rebuiltReceipt = receipt(rebuilt, bytes, savedReceipt.payloadSavedAt, savedReceipt.receiptPreparedAt);
  if (!receiptBytes.equals(encode(rebuiltReceipt, RECEIPT_MAX))) fail("RECEIPT_RECOMPUTATION_MISMATCH");
  const entries = readdirSync(resolve(root, base), { withFileTypes: true });
  if (entries.length !== 2 || entries.some(e => !e.isFile() || e.isSymbolicLink()) || entries.map(e => e.name).sort().join() !== "payload.json,receipt.json") fail("PAIR_ENTRIES");
  unchanged(root, recovered.files);
  if (!bytes.equals(io.readBytes(root, base + "/payload.json", REPORT_MAX)) || !receiptBytes.equals(io.readBytes(root, base + "/receipt.json", RECEIPT_MAX))) fail("PAIR_CHANGED");
  const verifiedAt = now(); readinessClock(verifiedAt);
  if (verifiedAt < rebuiltReceipt.receiptPreparedAt || recovered.protocol.verifiedAt < rebuiltReceipt.receiptPreparedAt ||
    recovered.context.verifiedAt < recovered.protocol.verifiedAt || verifiedAt < recovered.context.verifiedAt) fail("VERIFICATION_CLOCK_ORDER");
  return freezePaper({ status: "OBSERVATION_PAIR_AND_DEPENDENCIES_RECOMPUTED", observationId, path: base, observationAt: original.observationAt,
    payloadSavedAt: rebuiltReceipt.payloadSavedAt, receiptPreparedAt: rebuiltReceipt.receiptPreparedAt, verifiedAt,
    payloadSha256: sha(bytes), receiptSha256: sha(receiptBytes), inspectionSha256: rebuilt.inspection.artifactSha256,
    protocolPayloadSha256: recovered.protocol.payloadSha256, contextPayloadSha256: recovered.context.payloadSha256,
    recordSaved: true, observationReceiptVerified: true, prerequisitePairCount: 2, originalObservationClocksPreserved: true,
    missingStores: recovered.context.missingStores, blockedStores: recovered.context.blockedStores,
    sourceInputRead: false, sourceStoresRead: false, sourceJournalAppends: 0, networkAccess: false,
    featureWindowStartAt: null, featuresKnownAt: null, episodeId: null, outcomeState: null, outcomeKnownAt: null,
    featureCompletenessProven: false, sampleInputGenerated: false, sampleCount: 0, historicalDecisionProven: false,
    externalTimestampAttested: false, heldOutAccessSealed: false, winProbability: null, replayAllowed: false, executionAllowed: false });
}
/** Local inspection, exclusive current-clock recording, or recovery with both saved prerequisites. */
export async function runOptionsResearchObservationCommand(args, { workspaceRoot = process.cwd(), now = () => new Date().toISOString() } = {}) {
  if (args.length === 1 && args[0] === "--help") return { usage: ["options:research-observation -- --inspect <workspace-json>", "options:research-observation -- --record <workspace-json>", "options:research-observation -- --verify <observation-id>"],
    meaning: "Verify saved evidence before a current research note; recording preserves an exclusive payload/receipt pair. Recovery requires both original prerequisite pairs. No trade outcome or supplied historical clock.", recordSaved: false, executionAllowed: false };
  if (args.length !== 2 || !["--inspect", "--record", "--verify"].includes(args[0])) fail("ARGUMENTS");
  if (args[0] === "--verify") { exportId(args[1]); return verify(realpathSync(workspaceRoot), args[1], now); }
  const root = realpathSync(workspaceRoot), startedAt = now(); readinessClock(startedAt);
  const raw = io.readBytes(root, args[1], INPUT_MAX), input = validateOptionsResearchObservation(parse(raw));
  const recovered = await dependencies(root, input, now);
  const report = inspection(raw, input, recovered, startedAt, now());
  if (!raw.equals(io.readBytes(root, args[1], INPUT_MAX))) fail("INPUT_CHANGED");
  unchanged(root, recovered.files);
  if (args[0] === "--inspect") return report;
  const saved = payload(report), bytes = encode(saved, REPORT_MAX); parse(bytes);
  if (!raw.equals(io.readBytes(root, args[1], INPUT_MAX))) fail("INPUT_CHANGED");
  unchanged(root, recovered.files);
  const parent = io.directory(root, BASE);
  try { mkdirSync(resolve(parent, input.observationId)); } catch (error) { if (error?.code === "EEXIST") fail("ID_ALREADY_EXISTS"); throw error; }
  const base = BASE + "/" + input.observationId;
  io.writeExclusive(root, base + "/payload.json", bytes);
  const savedReceipt = receipt(saved, bytes, now(), now());
  io.writeExclusive(root, base + "/receipt.json", encode(savedReceipt, RECEIPT_MAX));
  return { ...await verify(root, input.observationId, now), status: "OBSERVATION_SAVED_AND_RECOMPUTED", sourceInputRead: true };
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try { console.log(JSON.stringify(await runOptionsResearchObservationCommand(process.argv.slice(2), { workspaceRoot: resolve(import.meta.dirname, "..") }), null, 2)); }
  catch (error) { console.error(JSON.stringify({ status: "RESEARCH_OBSERVATION_ERROR", code: /^(?:(?:RESEARCH_OBSERVATION|PROTOCOL_REGISTRATION|CONTEXT_CAPTURE|CONTEXT_CUTOFF|RESEARCH_PROTOCOL|SAMPLE_PARTITION|OPTIONS_EXPORT)_[A-Z_]+|OPTIONS_READINESS_CLOCK)$/.test(error?.message) ? error.message : "RESEARCH_OBSERVATION_LOCAL_FAILURE", executionAllowed: false })); process.exitCode = 2; }
}
