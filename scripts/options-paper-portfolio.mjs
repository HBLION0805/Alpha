import { createHash } from "node:crypto";
import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { assessOptionsPaperPortfolio } from "../src/engines/options-portfolio-risk/OptionsPaperPortfolio.ts";
import { portfolioDefinition, portfolioFixture } from "../src/engines/options-portfolio-risk/OptionsPortfolioRiskFixtures.ts";
import { optionsPaperDemoScenarios } from "../src/engines/options-paper/OptionsPaperFixtures.ts";
import { appendOptionsPaperScenario, paperFingerprint } from "../src/engines/options-paper/OptionsPaperTradingEngine.ts";
import { withOptionsPaperRepository } from "../src/repositories/LocalOptionsPaperRepository.ts";
import { readinessClock } from "../src/engines/options-readiness/OptionsReadinessEngine.ts";
import { exportId } from "../src/engines/options-evidence-export/OptionsEvidenceExportEngine.ts";
import { optionsEvidenceExportStorage as io } from "./options-evidence-export.mjs";

const BASE = "data/runtime/options-paper-portfolio", JOURNAL = "data/runtime/options-paper/sessions.ndjson";
const MAX_INPUT = 16 * 1024 * 1024, MAX_ARTIFACT = 48 * 1024 * 1024;
const fail = code => { throw Error("PAPER_PORTFOLIO_" + code); };
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
function parse(bytes) {
  let source, value;
  try { source = new TextDecoder("utf-8", { fatal: true }).decode(bytes); value = JSON.parse(source); } catch { fail("JSON_ENCODING"); }
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
function demo() {
  let history = [];
  for (const s of optionsPaperDemoScenarios()) history = appendOptionsPaperScenario(history, s).scenarios;
  const candidate = portfolioDefinition("bridge-demo-candidate", 40, "IBIT");
  return { version: "OPTIONS_PAPER_PORTFOLIO_INPUT_V1", scenarioId: "paper-portfolio-demo", origin: "SYNTHETIC_FIXTURE",
    asOf: candidate.asOf, historyComplete: true, modeledCostsReviewed: true, history, candidate,
    eventReview: { ...portfolioFixture().eventReview, receivedAt: candidate.asOf } };
}
function artifact(input, artifactId, recordedAt, source) {
  const result = assessOptionsPaperPortfolio(input);
  const body = { version: "OPTIONS_PAPER_PORTFOLIO_ARTIFACT_V1", artifactId, recordedAt, source, input, result,
    existingJournalAppends: 0, executionAllowed: false };
  return { ...body, artifactFingerprint: paperFingerprint(body) };
}
function verify(root, id, now) {
  exportId(id); const bytes = io.readBytes(root, BASE + "/" + id + ".json", MAX_ARTIFACT), saved = parse(bytes);
  if (!saved || saved.version !== "OPTIONS_PAPER_PORTFOLIO_ARTIFACT_V1" || saved.artifactId !== id) fail("ARTIFACT_ID_OR_VERSION");
  readinessClock(saved.recordedAt);
  const s = saved.source, validHash = value => typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
  if (!s || Object.keys(s).sort().join() !== "journalSha256,kind,requestSha256" ||
      !["SYNTHETIC_DEMO", "LOCAL_INPUT", "RECOVERED_PAPER_JOURNAL"].includes(s.kind) ||
      (s.kind === "SYNTHETIC_DEMO" ? s.requestSha256 !== null : !validHash(s.requestSha256)) ||
      (s.kind === "RECOVERED_PAPER_JOURNAL" ? !validHash(s.journalSha256) : s.journalSha256 !== null)) fail("ARTIFACT_SOURCE");
  const recomputed = artifact(saved.input, id, saved.recordedAt, s);
  if (!bytes.equals(Buffer.from(JSON.stringify(recomputed, null, 2) + "\n"))) fail("ARTIFACT_REPLAY_MISMATCH");
  const checkedAt = now(); readinessClock(checkedAt); if (checkedAt < saved.recordedAt) fail("RECORDING_CLOCK");
  const r = recomputed.result;
  return { status: "PAPER_PORTFOLIO_SNAPSHOT_RECOMPUTED", artifactId: id, recordedAt: saved.recordedAt, checkedAt,
    artifactFingerprint: recomputed.artifactFingerprint, reportFingerprint: r.reportFingerprint,
    diagnosticStatus: r.status, blockers: r.blockers, tradeCount: r.inventory.length, closedReviews: r.paper.reviews.length,
    candidateLessons: r.paper.mistakeNotebook.entries.length, reconciliation: r.reconciliation,
    verifiedCurrentJournal: false, existingJournalAppends: 0, executionAllowed: false };
}
export function runOptionsPaperPortfolioCommand(args, { workspaceRoot = process.cwd(), now = () => new Date().toISOString() } = {}) {
  if (args.length === 1 && args[0] === "--help") return { usage: ["options:paper-portfolio -- --demo [--save <new-id>]",
    "options:paper-portfolio -- --input <workspace-json> [--save <new-id>]", "options:paper-portfolio -- --paper <settings-without-history-json> [--save <new-id>]",
    "options:paper-portfolio -- --verify <saved-id>"], meaning: "Unrecorded candidate preview and portfolio diagnostics for one modeled account. No HTTP, brokerage access or journal appends.", executionAllowed: false };
  if (args.length === 2 && args[0] === "--verify") return verify(realpathSync(workspaceRoot), args[1], now);
  const isDemo = args[0] === "--demo", count = isDemo ? 1 : 2;
  if ((!isDemo && !["--input", "--paper"].includes(args[0])) || ![count, count + 2].includes(args.length) || args.length > count && args[count] !== "--save") fail("ARGUMENTS");
  const id = args.length > count ? args[count + 1] : null; if (id !== null) exportId(id);
  const root = realpathSync(workspaceRoot), startedAt = now(); readinessClock(startedAt);
  let input, source;
  if (isDemo) { input = demo(); source = { kind: "SYNTHETIC_DEMO", requestSha256: null, journalSha256: null }; }
  else {
    const bytes = io.readBytes(root, args[1], MAX_INPUT); input = parse(bytes);
    source = { kind: "LOCAL_INPUT", requestSha256: hash(bytes), journalSha256: null };
    if (args[0] === "--paper") {
      if (!input || typeof input !== "object" || Array.isArray(input) || Object.hasOwn(input, "history")) fail("SETTINGS_SHAPE");
      let before, history;
      try {
        before = io.readBytes(root, JOURNAL, MAX_INPUT);
        // Validate transport and duplicate keys before the original journal reader.
        const text = new TextDecoder("utf-8", { fatal: true }).decode(before);
        for (const line of text.trimEnd() ? text.trimEnd().split("\n") : []) parse(Buffer.from(line));
        history = withOptionsPaperRepository(root, r => r.readReport().trades.map(t => r.readScenario(t.tradeId)));
        if (!before.equals(io.readBytes(root, JOURNAL, MAX_INPUT))) fail("STORE_CHANGED");
      } catch (error) {
        fail(error?.code === "ENOENT" ? "STORE_MISSING" : error?.code === "EEXIST" ? "STORE_BUSY" : "STORE_RECOVERY_FAILED");
      }
      input = { ...input, history };
      source = { kind: "RECOVERED_PAPER_JOURNAL", requestSha256: hash(bytes), journalSha256: hash(before) };
    }
  }
  // Finish deterministic recovery/assessment before taking the actual construction clock.
  assessOptionsPaperPortfolio(input);
  const recordedAt = now(); readinessClock(recordedAt); if (recordedAt < startedAt) fail("RECORDING_CLOCK");
  const result = artifact(input, id, recordedAt, source), encoded = Buffer.from(JSON.stringify(result, null, 2) + "\n");
  if (encoded.length > MAX_ARTIFACT) fail("ARTIFACT_SIZE");
  if (id === null) return result;
  io.directory(root, BASE); io.writeExclusive(root, BASE + "/" + id + ".json", encoded);
  return { ...verify(root, id, now), status: "PAPER_PORTFOLIO_SAVED_AND_RECOMPUTED", path: BASE + "/" + id + ".json" };
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try { console.log(JSON.stringify(runOptionsPaperPortfolioCommand(process.argv.slice(2), { workspaceRoot: resolve(import.meta.dirname, "..") }), null, 2)); }
  catch (error) { console.error(JSON.stringify({ status: "PAPER_PORTFOLIO_ERROR", code: /^(?:PAPER_PORTFOLIO_[A-Z_]+|OPTIONS_READINESS_CLOCK|OPTIONS_EXPORT_[A-Z_]+)$/.test(error?.message) ? error.message : error?.code === "EEXIST" ? "PAPER_PORTFOLIO_ARTIFACT_EXISTS" : "PAPER_PORTFOLIO_LOCAL_FAILURE", executionAllowed: false })); process.exitCode = 2; }
}
