import { createHash } from "node:crypto";
import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { compareOptionsStructures } from "../src/engines/options-structure-comparison/OptionsStructureComparisonEngine.ts";
import { structureComparisonDemo } from "../src/engines/options-structure-comparison/OptionsStructureComparisonFixtures.ts";
import { readinessClock, readinessFingerprint } from "../src/engines/options-readiness/OptionsReadinessEngine.ts";
import { optionsEvidenceExportStorage as io } from "./options-evidence-export.mjs";
import { exportId } from "../src/engines/options-evidence-export/OptionsEvidenceExportEngine.ts";

const BASE = "data/runtime/options-structure-comparison", MAX_INPUT = 1024 * 1024, MAX_ARTIFACT = 8 * 1024 * 1024;
function fail(code) { throw Error("STRUCTURE_COMPARISON_" + code); }
function parse(bytes) {
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
const amount = value => value === null ? "unknown" : (value / 100).toFixed(2) + " USD";
function brief(cases, recordedAt) {
  const lines = ["Alpha GLD/IBIT structure comparison", `Recorded: ${recordedAt}`, "Declared scenarios only. No trade selection, live account inspection or automatic orders.", ""];
  for (const { result: r } of cases) {
    lines.push(`${r.comparisonId} | ${r.symbol} | ${r.origin}`, `Scenario as of ${r.asOf}; common expiry ${r.expiryDate}.`,
      "Terminal intrinsic payoffs are not pre-expiry exit prices or guarantees against early assignment.");
    for (const c of r.candidates) {
      const t = c.terminal, e = c.quotedEconomics;
      lines.push(`  ${c.candidateId}: ${c.structure}, quantity ${c.quantity}; ${c.calculationStatus}`,
        `    Net entry debit: ${amount(e?.netEntryDebitCents ?? null)} (negative means credit); terminal loss: ${amount(t?.maximumLossCents ?? null)}; terminal gain: ${t?.maximumGainUnbounded ? "unbounded on the upside" : amount(t?.maximumGainCents ?? null)}`,
        `    Quoted immediate liquidation friction: ${amount(e?.immediateLiquidationFrictionCents ?? null)}; modeled terminal risk reserve: ${amount(c.capitalComparison.modeledTerminalRiskReserveCents)}; actual broker collateral unknown.`,
        `    Input blockers: ${c.inputBlockers.map(b => b.code + " [" + b.subject + "]").join(", ") || "none in this declared comparison"}`,
        `    Diagnostics: ${c.diagnostics.join(", ") || "none against stated benchmarks; not a trading permission"}`,
        `    Exact terminal break-even (underlying cents): ${t ? JSON.stringify(t.breakEven) : "unknown"}`,
        `    Existing single-leg economics: ${c.singleLegFeasibility?.status ?? "not evaluated"}; multi-leg lifecycle is not implemented.`);
    }
    lines.push("");
  }
  lines.push("No win rate, preferred structure or new strategy authority is inferred. Full inputs, individual price scenarios and report hashes are retained below.");
  return lines.join("\n") + "\n";
}
function artifact(inputs, artifactId, recordedAt, source) {
  if (source.kind === "SYNTHETIC_DEMO" && readinessFingerprint(inputs) !== readinessFingerprint(structureComparisonDemo())) fail("DEMO_INPUT_MISMATCH");
  const cases = inputs.map(input => ({ input, result: compareOptionsStructures(input) }));
  const body = { version: "OPTIONS_STRUCTURE_ARTIFACT_V1", artifactId, recordedAt, source, cases, brief: brief(cases, recordedAt),
    existingJournalAppends: 0, brokerAccountInspected: false, executionAllowed: false };
  return { ...body, artifactSha256: readinessFingerprint(body) };
}
function verify(root, id, now) {
  exportId(id); const bytes = io.readBytes(root, BASE + "/" + id + ".json", MAX_ARTIFACT), saved = parse(bytes);
  if (!saved || saved.version !== "OPTIONS_STRUCTURE_ARTIFACT_V1" || saved.artifactId !== id) fail("ARTIFACT_ID_OR_VERSION"); readinessClock(saved.recordedAt);
  if (!saved.source || Object.keys(saved.source).sort().join() !== "kind,sha256" || !["SYNTHETIC_DEMO", "LOCAL_FILE"].includes(saved.source.kind) ||
    (saved.source.kind === "SYNTHETIC_DEMO" ? saved.source.sha256 !== null : typeof saved.source.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(saved.source.sha256))) fail("ARTIFACT_SOURCE");
  if (!Array.isArray(saved.cases) || saved.cases.length < 1 || saved.cases.length > 2 || saved.source.kind === "LOCAL_FILE" && saved.cases.length !== 1) fail("ARTIFACT_CASE_LIMIT");
  const recomputed = artifact(saved.cases.map(c => c.input), id, saved.recordedAt, saved.source);
  if (!bytes.equals(Buffer.from(JSON.stringify(recomputed, null, 2) + "\n"))) fail("ARTIFACT_REPLAY_MISMATCH");
  const checkedAt = now(); readinessClock(checkedAt); if (checkedAt < saved.recordedAt) fail("RECORDING_CLOCK");
  return { status: "STRUCTURE_ARTIFACT_RECOMPUTED", artifactId: id, recordedAt: saved.recordedAt, checkedAt, artifactSha256: recomputed.artifactSha256,
    comparisonCount: recomputed.cases.length, calculatedCandidates: recomputed.cases.reduce((s, c) => s + c.result.calculatedCount, 0),
    uncalculatedCandidates: recomputed.cases.reduce((s, c) => s + c.result.uncalculatedCount, 0), brief: recomputed.brief, existingJournalAppends: 0, executionAllowed: false };
}
export function runOptionsStructuresCommand(args, { workspaceRoot = process.cwd(), now = () => new Date().toISOString() } = {}) {
  if (args.length === 1 && args[0] === "--help") return { usage: ["options:structures -- --demo [--save <new-id>]", "options:structures -- --input <workspace-json> [--save <new-id>]", "options:structures -- --verify <saved-id>"],
    meaning: "Offline structure/cost/terminal-risk comparisons. No ranking, source refresh, account or order action. Missing inputs are retained as diagnostics.", executionAllowed: false };
  if (args.length === 2 && args[0] === "--verify") return verify(realpathSync(workspaceRoot), args[1], now);
  const demo = args[0] === "--demo", count = demo ? 1 : 2;
  if ((!demo && args[0] !== "--input") || ![count, count + 2].includes(args.length) || args.length > count && args[count] !== "--save") fail("ARGUMENTS");
  const id = args.length > count ? args[count + 1] : null; if (id !== null) exportId(id);
  const root = realpathSync(workspaceRoot), start = now(); readinessClock(start);
  let inputs, source;
  if (demo) { inputs = structureComparisonDemo(); source = { kind: "SYNTHETIC_DEMO", sha256: null }; }
  else { const bytes = io.readBytes(root, args[1], MAX_INPUT); inputs = [parse(bytes)]; source = { kind: "LOCAL_FILE", sha256: createHash("sha256").update(bytes).digest("hex") }; }
  const recordedAt = now(); readinessClock(recordedAt); if (recordedAt < start) fail("RECORDING_CLOCK");
  const result = artifact(inputs, id, recordedAt, source), encoded = Buffer.from(JSON.stringify(result, null, 2) + "\n");
  if (encoded.length > MAX_ARTIFACT) fail("ARTIFACT_SIZE"); if (id === null) return result;
  io.directory(root, BASE); io.writeExclusive(root, BASE + "/" + id + ".json", encoded);
  return { ...verify(root, id, now), status: "STRUCTURE_ARTIFACT_SAVED_AND_RECOMPUTED", path: BASE + "/" + id + ".json" };
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try { console.log(JSON.stringify(runOptionsStructuresCommand(process.argv.slice(2), { workspaceRoot: resolve(import.meta.dirname, "..") }), null, 2)); }
  catch (error) { console.error(JSON.stringify({ status: "STRUCTURE_COMPARISON_ERROR", code: /^(?:STRUCTURE_COMPARISON_[A-Z_]+|OPTIONS_READINESS_CLOCK|OPTIONS_EXPORT_[A-Z_]+)$/.test(error?.message) ? error.message : error?.code === "EEXIST" ? "STRUCTURE_COMPARISON_ARTIFACT_EXISTS" : "STRUCTURE_COMPARISON_LOCAL_FAILURE", executionAllowed: false })); process.exitCode = 2; }
}
