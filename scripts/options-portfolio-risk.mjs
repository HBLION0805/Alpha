import { createHash } from "node:crypto";
import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { assessOptionsPortfolioRisk } from "../src/engines/options-portfolio-risk/OptionsPortfolioRiskEngine.ts";
import { portfolioDemoScenarios } from "../src/engines/options-portfolio-risk/OptionsPortfolioRiskFixtures.ts";
import { readinessClock, readinessFingerprint } from "../src/engines/options-readiness/OptionsReadinessEngine.ts";
import { optionsEvidenceExportStorage as io } from "./options-evidence-export.mjs";
import { exportId } from "../src/engines/options-evidence-export/OptionsEvidenceExportEngine.ts";

const BASE = "data/runtime/options-portfolio-risk", MAX_INPUT = 2 * 1024 * 1024, MAX_ARTIFACT = 12 * 1024 * 1024;
const fail = code => { throw Error("PORTFOLIO_RISK_" + code); };
function parse(bytes) {
  let value, source;
  try { source = new TextDecoder("utf-8", { fatal: true }).decode(bytes); value = JSON.parse(source); } catch { fail("JSON_ENCODING"); }
  // JSON.parse checks grammar. This bounded token pass rejects duplicate decoded
  // property names instead of allowing a later risk/authority field to replace one.
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
const amount = cents => cents === null ? "unknown" : (cents / 100).toFixed(2) + " USD";
function brief(cases, recordedAt) {
  const lines = ["Alpha GLD/IBIT portfolio scenario risk", `Recorded: ${recordedAt}`, "Declared simulations only. No broker account inspected; automatic orders remain off.", ""];
  for (const { result: r } of cases) {
    lines.push(`${r.scenarioId}: ${r.status} (${r.origin})`, `  Scenario as of: ${r.asOf}; New York loss date: ${r.account.dailyDateNewYork}`,
      `  Settled: ${amount(r.account.settledCashCents)}; unsettled: ${amount(r.account.unsettledCashCents)}; reserved: ${amount(r.account.reservedCashCents)}`,
      `  Available settled: ${amount(r.account.availableSettledCashCents)}; modeled equity: ${amount(r.account.currentEquityCents)}`,
      `  Including candidate: ${r.withCandidate.count} exposures; premium plus fees: ${amount(r.withCandidate.fullPremiumAndFeesCents)}; original planned R: ${amount(r.withCandidate.originalPlannedRiskCents)}`,
      `  Capacity risk from current marks/planned stops: ${amount(r.withCandidate.capacityRiskCents)}; mark-to-zero exposure: ${amount(r.withCandidate.currentMarkToZeroCents)}`,
      `  Blockers: ${r.blockers.length ? r.blockers.map(b => b.code + " [" + b.subject + "]").join(", ") : "none under declared assumptions"}`, "");
  }
  lines.push("A favorable scenario does not authorize a trade. Unknown histories, settlement, marks, event coverage and account rules remain limitations.");
  return lines.join("\n") + "\n";
}
function artifact(scenarios, artifactId, recordedAt, source) {
  const cases = scenarios.map(scenario => ({ scenario, result: assessOptionsPortfolioRisk(scenario) }));
  const body = { version: "OPTIONS_PORTFOLIO_ARTIFACT_V1", artifactId, recordedAt, source, cases, brief: brief(cases, recordedAt),
    existingJournalAppends: 0, brokerAccountInspected: false, executionAllowed: false };
  return { ...body, artifactSha256: readinessFingerprint(body) };
}
function verify(root, id, now) {
  exportId(id); const bytes = io.readBytes(root, BASE + "/" + id + ".json", MAX_ARTIFACT), saved = parse(bytes);
  if (!saved || saved.version !== "OPTIONS_PORTFOLIO_ARTIFACT_V1" || saved.artifactId !== id) fail("ARTIFACT_ID_OR_VERSION");
  readinessClock(saved.recordedAt);
  if (!saved.source || Object.keys(saved.source).sort().join() !== "kind,sha256" || !["SYNTHETIC_DEMO", "LOCAL_FILE"].includes(saved.source.kind) ||
    (saved.source.kind === "SYNTHETIC_DEMO" ? saved.source.sha256 !== null : !/^[0-9a-f]{64}$/.test(saved.source.sha256))) fail("ARTIFACT_SOURCE");
  if (!Array.isArray(saved.cases) || saved.cases.length < 1 || saved.cases.length > 7 || saved.source.kind === "LOCAL_FILE" && saved.cases.length !== 1) fail("ARTIFACT_CASE_LIMIT");
  const recomputed = artifact(saved.cases.map(c => c.scenario), id, saved.recordedAt, saved.source);
  if (!bytes.equals(Buffer.from(JSON.stringify(recomputed, null, 2) + "\n"))) fail("ARTIFACT_REPLAY_MISMATCH");
  const checkedAt = now(); readinessClock(checkedAt); if (checkedAt < saved.recordedAt) fail("RECORDING_CLOCK");
  return { status: "PORTFOLIO_ARTIFACT_RECOMPUTED", artifactId: id, recordedAt: saved.recordedAt, checkedAt, artifactSha256: recomputed.artifactSha256,
    caseCount: recomputed.cases.length, blockedScenarios: recomputed.cases.filter(c => c.result.status === "SCENARIO_BLOCKED").length, brief: recomputed.brief, existingJournalAppends: 0, executionAllowed: false };
}
export function runOptionsPortfolioRiskCommand(args, { workspaceRoot = process.cwd(), now = () => new Date().toISOString() } = {}) {
  if (args.length === 1 && args[0] === "--help") return { usage: ["options:portfolio-risk -- --demo [--save <new-id>]", "options:portfolio-risk -- --input <workspace-json> [--save <new-id>]", "options:portfolio-risk -- --verify <saved-id>"], meaning: "Independent local portfolio scenarios. No broker account, source refresh, host change, old journal append or order. SCENARIO_BLOCKED is a normal result.", executionAllowed: false };
  if (args.length === 2 && args[0] === "--verify") return verify(realpathSync(workspaceRoot), args[1], now);
  const demo = args[0] === "--demo", count = demo ? 1 : 2;
  if ((!demo && args[0] !== "--input") || ![count, count + 2].includes(args.length) || args.length > count && args[count] !== "--save") fail("ARGUMENTS");
  const id = args.length > count ? args[count + 1] : null; if (id !== null) exportId(id);
  const root = realpathSync(workspaceRoot), startedAt = now(); readinessClock(startedAt);
  let scenarios, source;
  if (demo) { scenarios = portfolioDemoScenarios(); source = { kind: "SYNTHETIC_DEMO", sha256: null }; }
  else { const bytes = io.readBytes(root, args[1], MAX_INPUT); scenarios = [parse(bytes)]; source = { kind: "LOCAL_FILE", sha256: createHash("sha256").update(bytes).digest("hex") }; }
  const recordedAt = now(); readinessClock(recordedAt); if (recordedAt < startedAt) fail("RECORDING_CLOCK");
  const result = artifact(scenarios, id, recordedAt, source), encoded = Buffer.from(JSON.stringify(result, null, 2) + "\n");
  if (encoded.length > MAX_ARTIFACT) fail("ARTIFACT_SIZE");
  if (id === null) return result;
  io.directory(root, BASE); io.writeExclusive(root, BASE + "/" + id + ".json", encoded);
  return { ...verify(root, id, now), status: "PORTFOLIO_ARTIFACT_SAVED_AND_RECOMPUTED", path: BASE + "/" + id + ".json" };
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try { console.log(JSON.stringify(runOptionsPortfolioRiskCommand(process.argv.slice(2), { workspaceRoot: resolve(import.meta.dirname, "..") }), null, 2)); }
  catch (error) { console.error(JSON.stringify({ status: "PORTFOLIO_RISK_ERROR", code: /^(?:PORTFOLIO_RISK_[A-Z_]+|OPTIONS_READINESS_CLOCK|OPTIONS_EXPORT_[A-Z_]+)$/.test(error?.message) ? error.message : error?.code === "EEXIST" ? "PORTFOLIO_RISK_ARTIFACT_EXISTS" : "PORTFOLIO_RISK_LOCAL_FAILURE", executionAllowed: false })); process.exitCode = 2; }
}
