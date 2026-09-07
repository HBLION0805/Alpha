import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, realpathSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { assessOptionsResearchProtocol } from "../src/engines/options-sample-partition/OptionsResearchProtocol.ts";
import { readinessClock } from "../src/engines/options-readiness/OptionsReadinessEngine.ts";
import { exportId } from "../src/engines/options-evidence-export/OptionsEvidenceExportEngine.ts";
import { optionsEvidenceExportStorage as io } from "./options-evidence-export.mjs";
import { parseOptionsSampleJson } from "./options-sample-partition.mjs";

const BASE = "data/runtime/options-research-protocols", INPUT_MAX = 256 * 1024, PAYLOAD_MAX = 2 * 1024 * 1024, RECEIPT_MAX = 64 * 1024;
const fail = code => { throw Error("PROTOCOL_REGISTRATION_" + code); };
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
function parse(bytes) { try { return parseOptionsSampleJson(bytes); } catch { fail("JSON_ENCODING_OR_STRUCTURE"); } }
function encode(value, max) { const bytes = Buffer.from(JSON.stringify(value, null, 2) + "\n"); if (bytes.length > max) fail("SIZE_LIMIT"); return bytes; }
function payload(inputText, preparedAt) {
  if (typeof inputText !== "string" || /[\uD800-\uDFFF]/u.test(inputText)) fail("INPUT_TEXT");
  const inputBytes = Buffer.from(inputText, "utf8"); if (inputBytes.length > INPUT_MAX) fail("SIZE_LIMIT");
  const input = parse(inputBytes), assessment = assessOptionsResearchProtocol(input, preparedAt);
  exportId(input.protocolId);
  return { version: "OPTIONS_PROTOCOL_REGISTRATION_PAYLOAD_V1", protocolId: input.protocolId, preparedAt,
    sourceInputText: inputText, sourceInputSha256: sha(inputBytes), sourceInputBytes: inputBytes.length, assessment };
}
function receipt(saved, bytes, payloadSavedAt, receiptPreparedAt) {
  readinessClock(payloadSavedAt); readinessClock(receiptPreparedAt);
  if (payloadSavedAt < saved.preparedAt || receiptPreparedAt < payloadSavedAt) fail("SAVE_CLOCK_ORDER");
  const assessment = assessOptionsResearchProtocol(saved.assessment.declaration, payloadSavedAt);
  return { version: "OPTIONS_PROTOCOL_REGISTRATION_RECEIPT_V1", protocolId: saved.protocolId,
    payloadSha256: sha(bytes), payloadBytes: bytes.length, declarationSha256: assessment.declarationSha256,
    featureDefinitionSha256: assessment.featureDefinitionSha256, outcomeDefinitionSha256: assessment.outcomeDefinitionSha256,
    payloadSavedAt, receiptPreparedAt, registrationAssessmentSha256: assessment.artifactSha256,
    payloadFrozenBeforeFirstWindow: payloadSavedAt < assessment.firstWindowStartAt,
    receiptPreparedBeforeFirstWindow: receiptPreparedAt < assessment.firstWindowStartAt,
    clockBasis: "LOCAL_CLOCK_OBSERVED_AFTER_PAYLOAD_FSYNC_AND_CLOSE", externalTimestampAttested: false };
}
function verify(root, protocolId, now) {
  const base = BASE + "/" + protocolId; let bytes, receiptBytes;
  try { bytes = io.readBytes(root, base + "/payload.json", PAYLOAD_MAX); receiptBytes = io.readBytes(root, base + "/receipt.json", RECEIPT_MAX); }
  catch (error) { if (error?.code === "ENOENT") fail("PAIR_INCOMPLETE_OR_MISSING"); throw error; }
  const saved = parse(bytes), savedReceipt = parse(receiptBytes);
  if (!saved || saved.version !== "OPTIONS_PROTOCOL_REGISTRATION_PAYLOAD_V1" || saved.protocolId !== protocolId) fail("PAYLOAD_ID_OR_VERSION");
  if (!savedReceipt || savedReceipt.version !== "OPTIONS_PROTOCOL_REGISTRATION_RECEIPT_V1" || savedReceipt.protocolId !== protocolId) fail("RECEIPT_ID_OR_VERSION");
  if (savedReceipt.payloadSha256 !== sha(bytes) || savedReceipt.payloadBytes !== bytes.length) fail("PAYLOAD_BYTES_MISMATCH");
  const rebuilt = payload(saved.sourceInputText, saved.preparedAt);
  if (!bytes.equals(encode(rebuilt, PAYLOAD_MAX))) fail("PAYLOAD_RECOMPUTATION_MISMATCH");
  const rebuiltReceipt = receipt(rebuilt, bytes, savedReceipt.payloadSavedAt, savedReceipt.receiptPreparedAt);
  if (!receiptBytes.equals(encode(rebuiltReceipt, RECEIPT_MAX))) fail("RECEIPT_RECOMPUTATION_MISMATCH");
  const entries = readdirSync(resolve(root, base), { withFileTypes: true });
  if (entries.length !== 2 || entries.some(e => !e.isFile() || e.isSymbolicLink()) || entries.map(e => e.name).sort().join() !== "payload.json,receipt.json") fail("PAIR_ENTRIES");
  if (!bytes.equals(io.readBytes(root, base + "/payload.json", PAYLOAD_MAX)) || !receiptBytes.equals(io.readBytes(root, base + "/receipt.json", RECEIPT_MAX))) fail("PAIR_CHANGED");
  const verifiedAt = now(); readinessClock(verifiedAt); if (verifiedAt < rebuiltReceipt.receiptPreparedAt) fail("VERIFICATION_CLOCK_ORDER");
  return { status: "PROTOCOL_REGISTRATION_PAIR_RECOMPUTED", protocolId, path: base,
    preparedAt: rebuilt.preparedAt, payloadSavedAt: rebuiltReceipt.payloadSavedAt, receiptPreparedAt: rebuiltReceipt.receiptPreparedAt, verifiedAt,
    payloadSha256: sha(bytes), receiptSha256: sha(receiptBytes), declarationSha256: rebuiltReceipt.declarationSha256,
    featureDefinitionSha256: rebuiltReceipt.featureDefinitionSha256, outcomeDefinitionSha256: rebuiltReceipt.outcomeDefinitionSha256,
    registrationReceiptVerified: true, payloadFrozenBeforeFirstWindow: rebuiltReceipt.payloadFrozenBeforeFirstWindow,
    receiptPreparedBeforeFirstWindow: rebuiltReceipt.receiptPreparedBeforeFirstWindow,
    timing: rebuiltReceipt.payloadFrozenBeforeFirstWindow ? "PAYLOAD_FROZEN_BEFORE_FIRST_WINDOW" : "LATE_PAYLOAD_FREEZE",
    firstWindowStartAt: rebuilt.assessment.firstWindowStartAt, emptyPartitionBlockers: rebuilt.assessment.partitionAudit.blockers,
    sourceInputRead: false, sourceJournalAppends: 0, sampleCount: 0, decisionRecorded: false,
    featureCompletenessProven: false, heldOutAccessSealed: false, externalTimestampAttested: false,
    executionAllowed: false, replayAllowed: false, winProbability: null };
}
export function runOptionsResearchProtocolCommand(args, { workspaceRoot = process.cwd(), now = () => new Date().toISOString() } = {}) {
  if (args.length === 1 && args[0] === "--help") return { usage: ["options:research-protocol -- --inspect <workspace-json>", "options:research-protocol -- --register <workspace-json>", "options:research-protocol -- --verify <protocol-id>"],
    meaning: "Freeze a complete local research declaration with an actual post-write receipt. Late and partial registrations remain distinct. No historical registration clock, dataset selection, source refresh or trading authority.", executionAllowed: false };
  if (args.length !== 2 || !["--inspect", "--register", "--verify"].includes(args[0])) fail("ARGUMENTS");
  if (args[0] === "--verify") { exportId(args[1]); return verify(realpathSync(workspaceRoot), args[1], now); }
  const root = realpathSync(workspaceRoot), startedAt = now(); readinessClock(startedAt);
  const raw = io.readBytes(root, args[1], INPUT_MAX); parse(raw);
  const preparedAt = now(); readinessClock(preparedAt); if (preparedAt < startedAt) fail("PREPARATION_CLOCK_ORDER");
  const saved = payload(new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(raw), preparedAt);
  if (args[0] === "--inspect") return saved.assessment;
  const bytes = encode(saved, PAYLOAD_MAX); parse(bytes);
  if (!raw.equals(io.readBytes(root, args[1], INPUT_MAX))) fail("INPUT_CHANGED");
  const parent = io.directory(root, BASE);
  try { mkdirSync(resolve(parent, saved.protocolId)); } catch (error) { if (error?.code === "EEXIST") fail("ID_ALREADY_EXISTS"); throw error; }
  const base = BASE + "/" + saved.protocolId;
  io.writeExclusive(root, base + "/payload.json", bytes);
  const payloadSavedAt = now(), savedReceipt = receipt(saved, bytes, payloadSavedAt, now());
  io.writeExclusive(root, base + "/receipt.json", encode(savedReceipt, RECEIPT_MAX));
  return { ...verify(root, saved.protocolId, now), status: "PROTOCOL_REGISTERED_AND_RECOMPUTED", sourceInputRead: true };
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try { console.log(JSON.stringify(runOptionsResearchProtocolCommand(process.argv.slice(2), { workspaceRoot: resolve(import.meta.dirname, "..") }), null, 2)); }
  catch (error) { console.error(JSON.stringify({ status: "PROTOCOL_REGISTRATION_ERROR", code: /^(?:PROTOCOL_REGISTRATION_[A-Z_]+|RESEARCH_PROTOCOL_[A-Z_]+|SAMPLE_PARTITION_[A-Z_]+|OPTIONS_READINESS_CLOCK|OPTIONS_EXPORT_[A-Z_]+)$/.test(error?.message) ? error.message : "PROTOCOL_REGISTRATION_LOCAL_FAILURE", executionAllowed: false })); process.exitCode = 2; }
}
