import { createHash } from "node:crypto";
import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { auditOptionsSamplePartitions } from "../src/engines/options-sample-partition/OptionsSamplePartitionEngine.ts";
import { samplePartitionDemo } from "../src/engines/options-sample-partition/OptionsSamplePartitionFixtures.ts";
import { readinessClock, readinessFingerprint } from "../src/engines/options-readiness/OptionsReadinessEngine.ts";
import { optionsEvidenceExportStorage as io } from "./options-evidence-export.mjs";
import { exportId } from "../src/engines/options-evidence-export/OptionsEvidenceExportEngine.ts";

const BASE = "data/runtime/options-sample-partition", MAX_INPUT = 1024 * 1024, MAX_ARTIFACT = 8 * 1024 * 1024;
function fail(code) { throw Error("SAMPLE_PARTITION_" + code); }
export function parseOptionsSampleJson(bytes) {
  let source, value; try { source = new TextDecoder("utf-8", { fatal: true }).decode(bytes); value = JSON.parse(source); } catch { fail("JSON_ENCODING"); }
  // Match the existing offline scenario boundary: reject duplicate decoded keys
  // and deeply nested inputs after JSON.parse has verified the grammar.
  const stack = [];
  for (const match of source.matchAll(/"(?:\\[\s\S]|[^"\\])*"|[{}\[\],:]|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null/g)) {
    const token = match[0];
    if (token === "{" || token === "[") { if (stack.length >= 32) fail("JSON_DEPTH"); stack.push({ object: token === "{", key: token === "{", names: new Set() }); }
    else if (token === "}" || token === "]") stack.pop();
    else { const top = stack.at(-1); if (!top?.object) continue;
      if (token === ",") top.key = true;
      else if (top.key && token.startsWith('"')) { const key = JSON.parse(token); if (top.names.has(key)) fail("DUPLICATE_JSON_KEY"); top.names.add(key); top.key = false; }
    }
  }
  return value;
}
function brief(cases, recordedAt) {
  const lines = ["Alpha GLD/IBIT declared sample partition audit", "Recorded: " + recordedAt,
    "Retrospective declarations only. Holdout access is not sealed; no model or win rate is evaluated.", ""];
  for (const { result: r } of cases) {
    lines.push(r.datasetId + " | " + r.origin + " | " + r.status,
      "All samples: " + r.counts.total + "; assigned: " + r.counts.assigned + "; purged: " + r.counts.purged + "; blocked: " + r.counts.blocked + "; outside: " + r.counts.unassigned,
      "Blockers: " + (r.blockers.join(", ") || "none in the supplied declaration; not market validation"));
    for (const p of r.partitions) lines.push("  " + p.name + ": " + p.assignedCount + " assigned samples on " + p.distinctDecisionDatesNewYork.length + " declared New York dates; independence unknown.");
    for (const c of r.cases) if (c.reasons.length) lines.push("  " + c.sample.sampleId + ": " + c.disposition + " / " + c.reasons.join(", "));
    lines.push("");
  }
  lines.push("Every supplied case and dependence conflict is retained. No automatic strategy change or order is authorized.");
  return lines.join("\n") + "\n";
}
function artifact(inputs, artifactId, recordedAt, source) {
  if (source.kind === "SYNTHETIC_DEMO" && readinessFingerprint(inputs) !== readinessFingerprint(samplePartitionDemo())) fail("DEMO_INPUT_MISMATCH");
  const cases = inputs.map(input => ({ input, result: auditOptionsSamplePartitions(input) }));
  const body = { version: "OPTIONS_SAMPLE_PARTITION_ARTIFACT_V1", artifactId, recordedAt, source, cases, brief: brief(cases, recordedAt),
    existingJournalAppends: 0, brokerAccountInspected: false, executionAllowed: false };
  return { ...body, artifactSha256: readinessFingerprint(body) };
}
function verify(root, id, now) {
  exportId(id); const bytes = io.readBytes(root, BASE + "/" + id + ".json", MAX_ARTIFACT), saved = parseOptionsSampleJson(bytes);
  if (!saved || saved.version !== "OPTIONS_SAMPLE_PARTITION_ARTIFACT_V1" || saved.artifactId !== id) fail("ARTIFACT_ID_OR_VERSION"); readinessClock(saved.recordedAt);
  if (!saved.source || Object.keys(saved.source).sort().join() !== "kind,sha256" || !["SYNTHETIC_DEMO", "LOCAL_FILE"].includes(saved.source.kind) ||
    (saved.source.kind === "SYNTHETIC_DEMO" ? saved.source.sha256 !== null : typeof saved.source.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(saved.source.sha256))) fail("ARTIFACT_SOURCE");
  if (!Array.isArray(saved.cases) || saved.cases.length < 1 || saved.cases.length > 2 || saved.source.kind === "LOCAL_FILE" && saved.cases.length !== 1) fail("ARTIFACT_CASE_LIMIT");
  const recomputed = artifact(saved.cases.map(c => c.input), id, saved.recordedAt, saved.source);
  if (!bytes.equals(Buffer.from(JSON.stringify(recomputed, null, 2) + "\n"))) fail("ARTIFACT_REPLAY_MISMATCH");
  const checkedAt = now(); readinessClock(checkedAt); if (checkedAt < saved.recordedAt) fail("RECORDING_CLOCK");
  return { status: "SAMPLE_PARTITION_ARTIFACT_RECOMPUTED", artifactId: id, recordedAt: saved.recordedAt, checkedAt, artifactSha256: recomputed.artifactSha256,
    comparisonCount: recomputed.cases.length, sampleCounts: recomputed.cases.map(c => ({ datasetId: c.result.datasetId, status: c.result.status, counts: c.result.counts })), brief: recomputed.brief, existingJournalAppends: 0, executionAllowed: false };
}
export function runOptionsSamplePartitionCommand(args, { workspaceRoot = process.cwd(), now = () => new Date().toISOString() } = {}) {
  if (args.length === 1 && args[0] === "--help") return { usage: ["options:sample-partition -- --demo [--save <new-id>]", "options:sample-partition -- --input <workspace-json> [--save <new-id>]", "options:sample-partition -- --verify <saved-id>"],
    meaning: "Offline declared chronological sample audit. No sealed holdout, performance estimate, source refresh, account or order action. All excluded cases are retained.", executionAllowed: false };
  if (args.length === 2 && args[0] === "--verify") return verify(realpathSync(workspaceRoot), args[1], now);
  const demo = args[0] === "--demo", count = demo ? 1 : 2;
  if ((!demo && args[0] !== "--input") || ![count, count + 2].includes(args.length) || args.length > count && args[count] !== "--save") fail("ARGUMENTS");
  const id = args.length > count ? args[count + 1] : null; if (id !== null) exportId(id);
  const root = realpathSync(workspaceRoot), start = now(); readinessClock(start);
  let inputs, source;
  if (demo) { inputs = samplePartitionDemo(); source = { kind: "SYNTHETIC_DEMO", sha256: null }; }
  else { const bytes = io.readBytes(root, args[1], MAX_INPUT); inputs = [parseOptionsSampleJson(bytes)]; source = { kind: "LOCAL_FILE", sha256: createHash("sha256").update(bytes).digest("hex") }; }
  const recordedAt = now(); readinessClock(recordedAt); if (recordedAt < start) fail("RECORDING_CLOCK");
  const result = artifact(inputs, id, recordedAt, source), encoded = Buffer.from(JSON.stringify(result, null, 2) + "\n");
  if (encoded.length > MAX_ARTIFACT) fail("ARTIFACT_SIZE"); if (id === null) return result;
  io.directory(root, BASE); io.writeExclusive(root, BASE + "/" + id + ".json", encoded);
  return { ...verify(root, id, now), status: "SAMPLE_PARTITION_ARTIFACT_SAVED_AND_RECOMPUTED", path: BASE + "/" + id + ".json" };
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try { console.log(JSON.stringify(runOptionsSamplePartitionCommand(process.argv.slice(2), { workspaceRoot: resolve(import.meta.dirname, "..") }), null, 2)); }
  catch (error) { console.error(JSON.stringify({ status: "SAMPLE_PARTITION_ERROR", code: /^(?:SAMPLE_PARTITION_[A-Z_]+|OPTIONS_READINESS_CLOCK|OPTIONS_EXPORT_[A-Z_]+)$/.test(error?.message) ? error.message : error?.code === "EEXIST" ? "SAMPLE_PARTITION_ARTIFACT_EXISTS" : "SAMPLE_PARTITION_LOCAL_FAILURE", executionAllowed: false })); process.exitCode = 2; }
}
