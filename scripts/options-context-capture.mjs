import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, realpathSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { loadOptionsContextCutoffHistories } from "./options-context-cutoff.mjs";
import { buildOptionsContextManifest } from "../src/engines/options-readiness/OptionsContextManifest.ts";
import { readinessClock } from "../src/engines/options-readiness/OptionsReadinessEngine.ts";
import { exportId } from "../src/engines/options-evidence-export/OptionsEvidenceExportEngine.ts";
import { optionsEvidenceExportStorage as io } from "./options-evidence-export.mjs";
import { parseOptionsSampleJson } from "./options-sample-partition.mjs";

const BASE = "data/runtime/options-context-captures";
export const CONTEXT_CAPTURE_MAX_BYTES = 64 * 1024 * 1024;
const RECEIPT_MAX_BYTES = 64 * 1024;
const fail = code => { throw Error("CONTEXT_CAPTURE_" + code); };
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
function encode(value, maximum) {
  const bytes = Buffer.from(JSON.stringify(value, null, 2) + "\n");
  if (bytes.length > maximum) fail("SIZE_LIMIT");
  return bytes;
}
function parse(bytes) { try { return parseOptionsSampleJson(bytes); } catch { fail("JSON_ENCODING_OR_STRUCTURE"); } }
function payload(histories, captureId, cutoffAt, constructedAt) {
  const report = buildOptionsContextManifest(histories, cutoffAt, constructedAt);
  return { version: "OPTIONS_CONTEXT_CAPTURE_PAYLOAD_V1", captureId, cutoffAt, constructedAt, histories, report };
}
function receipt(saved, bytes, payloadSavedAt, receiptPreparedAt) {
  readinessClock(payloadSavedAt); readinessClock(receiptPreparedAt);
  if (payloadSavedAt < saved.constructedAt || receiptPreparedAt < payloadSavedAt) fail("SAVE_CLOCK_ORDER");
  return { version: "OPTIONS_CONTEXT_CAPTURE_RECEIPT_V1", captureId: saved.captureId,
    payloadSha256: sha(bytes), payloadBytes: bytes.length,
    contextSha256: saved.report.manifest.contextSha256, manifestSha256: saved.report.manifestSha256,
    payloadSavedAt, receiptPreparedAt, clockBasis: "LOCAL_CLOCK_OBSERVED_AFTER_PAYLOAD_FSYNC_AND_CLOSE",
    sourceClockRewritten: false, externalTimestampAttested: false };
}
function verify(root, captureId, now) {
  const base = BASE + "/" + captureId;
  let bytes, receiptBytes;
  try {
    bytes = io.readBytes(root, base + "/payload.json", CONTEXT_CAPTURE_MAX_BYTES);
    receiptBytes = io.readBytes(root, base + "/receipt.json", RECEIPT_MAX_BYTES);
  } catch (error) { if (error?.code === "ENOENT") fail("PAIR_INCOMPLETE_OR_MISSING"); throw error; }
  const saved = parse(bytes), savedReceipt = parse(receiptBytes);
  if (!saved || saved.captureId !== captureId || saved.version !== "OPTIONS_CONTEXT_CAPTURE_PAYLOAD_V1") fail("PAYLOAD_ID_OR_VERSION");
  if (!savedReceipt || savedReceipt.captureId !== captureId || savedReceipt.version !== "OPTIONS_CONTEXT_CAPTURE_RECEIPT_V1") fail("RECEIPT_ID_OR_VERSION");
  if (savedReceipt.payloadSha256 !== sha(bytes) || savedReceipt.payloadBytes !== bytes.length) fail("PAYLOAD_BYTES_MISMATCH");
  const recomputed = payload(saved.histories, captureId, saved.cutoffAt, saved.constructedAt);
  if (!bytes.equals(encode(recomputed, CONTEXT_CAPTURE_MAX_BYTES))) fail("PAYLOAD_RECOMPUTATION_MISMATCH");
  const rebuiltReceipt = receipt(recomputed, bytes, savedReceipt.payloadSavedAt, savedReceipt.receiptPreparedAt);
  if (!receiptBytes.equals(encode(rebuiltReceipt, RECEIPT_MAX_BYTES))) fail("RECEIPT_RECOMPUTATION_MISMATCH");
  const entries = readdirSync(resolve(root, base), { withFileTypes: true });
  if (entries.length !== 2 || entries.some(e => !e.isFile() || e.isSymbolicLink()) || entries.map(e => e.name).sort().join() !== "payload.json,receipt.json") fail("PAIR_ENTRIES");
  if (!bytes.equals(io.readBytes(root, base + "/payload.json", CONTEXT_CAPTURE_MAX_BYTES)) ||
    !receiptBytes.equals(io.readBytes(root, base + "/receipt.json", RECEIPT_MAX_BYTES))) fail("PAIR_CHANGED");
  const verifiedAt = now(); readinessClock(verifiedAt);
  if (verifiedAt < rebuiltReceipt.receiptPreparedAt) fail("VERIFICATION_CLOCK_ORDER");
  return { status: "CONTEXT_CAPTURE_PAIR_RECOMPUTED", captureId, path: base,
    cutoffAt: saved.cutoffAt, constructedAt: saved.constructedAt,
    payloadSavedAt: rebuiltReceipt.payloadSavedAt, receiptPreparedAt: rebuiltReceipt.receiptPreparedAt, verifiedAt,
    payloadSha256: sha(bytes), receiptSha256: sha(receiptBytes), manifestSha256: rebuiltReceipt.manifestSha256,
    contextSha256: rebuiltReceipt.contextSha256, memberCount: recomputed.report.manifest.memberCount,
    blockedStores: recomputed.report.reconstruction.blockedStores, missingStores: recomputed.report.reconstruction.missingStores,
    captureReceiptVerified: true, sourceStoresRead: false, snapshotAtomicAcrossStores: false,
    historicalDecisionProven: false, globalKnowledgeCoverageComplete: false, externalTimestampAttested: false,
    sourceJournalAppends: 0, networkAccess: false, executionAllowed: false, replayAllowed: false };
}

export async function runOptionsContextCaptureCommand(args, { workspaceRoot = process.cwd(), now = () => new Date().toISOString() } = {}) {
  if (args.length === 1 && args[0] === "--help") return { usage: ["options:context-capture -- --inspect", "options:context-capture -- --capture <new-id>", "options:context-capture -- --verify <id>"],
    meaning: "Local current-clock context inspection or immutable payload/receipt capture. Verification uses saved files only. No historical capture time, source refresh, trade decision or replay permission.", executionAllowed: false };
  const inspect = args.length === 1 && args[0] === "--inspect";
  if (!inspect && (args.length !== 2 || !["--capture", "--verify"].includes(args[0]))) fail("ARGUMENTS");
  if (!inspect) exportId(args[1]);
  const root = realpathSync(workspaceRoot);
  if (args[0] === "--verify") return verify(root, args[1], now);
  const cutoffAt = now(); readinessClock(cutoffAt);
  const { histories, constructedAt } = await loadOptionsContextCutoffHistories(cutoffAt, { workspaceRoot: root, now, v2: true });
  if (inspect) return buildOptionsContextManifest(histories, cutoffAt, constructedAt);
  const captureId = args[1], saved = payload(histories, captureId, cutoffAt, constructedAt);
  const bytes = encode(saved, CONTEXT_CAPTURE_MAX_BYTES);
  // Refuse an unsupported representation before claiming a new capture directory.
  parse(bytes);
  const parent = io.directory(root, BASE);
  // Exclusive directory creation reserves the entire pair, including failed/empty attempts.
  // An old partial pair can never be resumed or silently completed with a later clock.
  try { mkdirSync(resolve(parent, captureId)); } catch (error) { if (error?.code === "EEXIST") fail("ID_ALREADY_EXISTS"); throw error; }
  const base = BASE + "/" + captureId;
  io.writeExclusive(root, base + "/payload.json", bytes);
  const payloadSavedAt = now();
  const savedReceipt = receipt(saved, bytes, payloadSavedAt, now());
  io.writeExclusive(root, base + "/receipt.json", encode(savedReceipt, RECEIPT_MAX_BYTES));
  return { ...verify(root, captureId, now), status: "CONTEXT_CAPTURE_SAVED_AND_RECOMPUTED", sourceStoresRead: true };
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try { const report = await runOptionsContextCaptureCommand(process.argv.slice(2), { workspaceRoot: resolve(import.meta.dirname, "..") }); console.log(JSON.stringify(report, null, 2)); if ((report.blockedStores ?? report.reconstruction?.blockedStores)?.length) process.exitCode = 3; }
  catch (error) { console.error(JSON.stringify({ status: "CONTEXT_CAPTURE_ERROR", code: /^(?:CONTEXT_CAPTURE_[A-Z_]+|CONTEXT_CUTOFF_[A-Z_]+|OPTIONS_READINESS_CLOCK|OPTIONS_EXPORT_[A-Z_]+)$/.test(error?.message) ? error.message : "CONTEXT_CAPTURE_LOCAL_FAILURE", executionAllowed: false })); process.exitCode = 2; }
}
