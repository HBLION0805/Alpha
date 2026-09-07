import { createHash } from "node:crypto";
import { realpathSync } from "node:fs";
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
const fail = code => { throw Error("RESEARCH_OBSERVATION_" + code); };
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
function parse(bytes) { try { return parseOptionsSampleJson(bytes); } catch { fail("JSON_ENCODING_OR_STRUCTURE"); } }

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

/** Resolves saved pairs only. No writer, current-source loader or supplied historical clock. */
export async function runOptionsResearchObservationCommand(args, { workspaceRoot = process.cwd(), now = () => new Date().toISOString() } = {}) {
  if (args.length === 1 && args[0] === "--help") return { usage: ["options:research-observation -- --inspect <workspace-json>"],
    meaning: "Verify declared protocol/context pairs before a current research observation inspection. Does not save an observation or produce a trade outcome.", recordSaved: false, executionAllowed: false };
  if (args.length !== 2 || args[0] !== "--inspect") fail("ARGUMENTS");
  const root = realpathSync(workspaceRoot), startedAt = now(); readinessClock(startedAt);
  const raw = io.readBytes(root, args[1], INPUT_MAX), input = validateOptionsResearchObservation(parse(raw));
  const protocol = runOptionsResearchProtocolCommand(["--verify", input.protocolId], { workspaceRoot: root, now });
  const context = await runOptionsContextCaptureCommand(["--verify", input.captureId], { workspaceRoot: root, now });
  const files = [
    { path: protocol.path + "/payload.json", limit: PROTOCOL_MAX, sha256: protocol.payloadSha256 },
    { path: protocol.path + "/receipt.json", limit: RECEIPT_MAX, sha256: protocol.receiptSha256 },
    { path: context.path + "/payload.json", limit: CONTEXT_CAPTURE_MAX_BYTES, sha256: context.payloadSha256 },
    { path: context.path + "/receipt.json", limit: RECEIPT_MAX, sha256: context.receiptSha256 },
  ].map(file => { const bytes = io.readBytes(root, file.path, file.limit); if (sha(bytes) !== file.sha256) fail("DEPENDENCY_CHANGED"); return { ...file, bytes }; });
  const declaration = parse(files[0].bytes).assessment.declaration, contextReport = parse(files[2].bytes).report;
  const observationAt = now(); readinessClock(observationAt);
  if (protocol.verifiedAt < startedAt || context.verifiedAt < protocol.verifiedAt || observationAt <= protocol.verifiedAt || observationAt <= context.verifiedAt) fail("OBSERVATION_CLOCK_ORDER");
  // Stable re-reads detect replacements during resolution; this is not a cross-store lock.
  if (!raw.equals(io.readBytes(root, args[1], INPUT_MAX))) fail("INPUT_CHANGED");
  for (const file of files) if (!file.bytes.equals(io.readBytes(root, file.path, file.limit))) fail("DEPENDENCY_CHANGED");
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
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try { console.log(JSON.stringify(await runOptionsResearchObservationCommand(process.argv.slice(2), { workspaceRoot: resolve(import.meta.dirname, "..") }), null, 2)); }
  catch (error) { console.error(JSON.stringify({ status: "RESEARCH_OBSERVATION_ERROR", code: /^(?:(?:RESEARCH_OBSERVATION|PROTOCOL_REGISTRATION|CONTEXT_CAPTURE|CONTEXT_CUTOFF|RESEARCH_PROTOCOL|SAMPLE_PARTITION|OPTIONS_EXPORT)_[A-Z_]+|OPTIONS_READINESS_CLOCK)$/.test(error?.message) ? error.message : "RESEARCH_OBSERVATION_LOCAL_FAILURE", executionAllowed: false })); process.exitCode = 2; }
}
