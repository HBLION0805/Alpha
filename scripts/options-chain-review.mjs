import { createHash } from "node:crypto";
import { existsSync, mkdirSync, realpathSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { assessRobinhoodChainSurvey, parseChainSurveyJson } from "../src/engines/options-robinhood-data/RobinhoodChainSurvey.ts";
import { readinessClock } from "../src/engines/options-readiness/OptionsReadinessEngine.ts";
import { paperFingerprint } from "../src/engines/options-paper/OptionsPaperTradingEngine.ts";
import { exportId } from "../src/engines/options-evidence-export/OptionsEvidenceExportEngine.ts";
import { optionsEvidenceExportStorage as io } from "./options-evidence-export.mjs";
import { runOptionsPaperPortfolioCommand } from "./options-paper-portfolio.mjs";
import { renderChainReviewBoard } from "./lib/options-chain-review-render.mjs";
import { compareRobinhoodChainSurveys } from "../src/engines/options-robinhood-data/RobinhoodChainComparison.ts";
import { routeChainClose, collectChainClose } from "./lib/options-chain-close-host.mjs";

const BASE = "data/runtime/options-chain-survey", MAX = 32 * 1024 * 1024;
const hash = b => createHash("sha256").update(b).digest("hex");
const fail = code => { throw Error("CHAIN_REVIEW_" + code); };
function utf8(bytes) { try { return new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { fail("UTF8"); } }
const parse = b => parseChainSurveyJson(utf8(b));
const json = v => Buffer.from(JSON.stringify(v, null, 2) + "\n");
function paperPath(id) { exportId(id); return "data/runtime/options-paper-portfolio/" + id + ".json"; }
function loadPaper(root, id, now) {
  if (id === null) return { bytes: null, report: null };
  const path = paperPath(id), before = io.readBytes(root, path, MAX);
  const verified = runOptionsPaperPortfolioCommand(["--verify", id], { workspaceRoot: root, now });
  if (!before.equals(io.readBytes(root, path, MAX))) fail("PAPER_CHANGED");
  const a = parse(before); if (a.artifactFingerprint !== verified.artifactFingerprint || a.result.reportFingerprint !== verified.reportFingerprint) fail("PAPER_MISMATCH");
  return { bytes: before, report: { artifactId: id, artifactFingerprint: a.artifactFingerprint, result: a.result } };
}
function board(sourceText, paper, createdAt) {
  const body = { version: "OPTIONS_CHAIN_REVIEW_BOARD_V1", createdAt, chain: assessRobinhoodChainSurvey(sourceText, createdAt), paper,
    marketAccountLinked: false, sourceJournalAppends: 0, executionAllowed: false };
  return { ...body, reportFingerprint: paperFingerprint(body) };
}
function verify(root, id, now) {
  exportId(id); const base = BASE + "/" + id, m = parse(io.readBytes(root, base + "/manifest.json", 32768));
  if (!m || Object.keys(m).sort().join() !== "createdAt,executionAllowed,files,paperArtifactId,reportFingerprint,snapshotId,sourceJournalAppends,version" ||
      m.version !== "OPTIONS_CHAIN_REVIEW_FILES_V1" || m.snapshotId !== id || m.executionAllowed !== false || m.sourceJournalAppends !== 0) fail("MANIFEST");
  readinessClock(m.createdAt); if (m.paperArtifactId !== null) exportId(m.paperArtifactId);
  const expected = ["capture.json", "report.json", "index.html", ...(m.paperArtifactId === null ? [] : ["paper/" + paperPath(m.paperArtifactId)])];
  if (!Array.isArray(m.files) || JSON.stringify(m.files.map(f => f?.path)) !== JSON.stringify(expected)) fail("FILES");
  const content = new Map();
  for (const f of m.files) {
    if (!f || Object.keys(f).sort().join() !== "bytes,path,sha256" || !Number.isSafeInteger(f.bytes) || f.bytes < 1 || f.bytes > MAX || !/^[0-9a-f]{64}$/.test(f.sha256)) fail("FILE_METADATA");
    const b = io.readBytes(root, base + "/" + f.path, MAX); if (b.length !== f.bytes || hash(b) !== f.sha256) fail("FILE_HASH"); content.set(f.path, b);
  }
  const paper = m.paperArtifactId === null ? null : loadPaper(realpathSync(resolve(root, base, "paper")), m.paperArtifactId, now).report;
  const r = board(utf8(content.get("capture.json")), paper, m.createdAt);
  if (r.reportFingerprint !== m.reportFingerprint || !json(r).equals(content.get("report.json")) || !Buffer.from(renderChainReviewBoard(r)).equals(content.get("index.html"))) fail("RECOMPUTATION");
  const checkedAt = now(); readinessClock(checkedAt); if (checkedAt < m.createdAt) fail("CLOCK_ORDER");
  return { status: "CHAIN_REVIEW_BOARD_RECOMPUTED", snapshotId: id, createdAt: m.createdAt, checkedAt, path: base + "/index.html", reportFingerprint: r.reportFingerprint,
    instrumentCount: r.chain.instrumentCount, quoteCount: r.chain.quoteCount, flaggedCount: r.chain.flaggedCount, sourceStatus: r.chain.status,
    paperAttached: paper !== null, paperDiagnosticStatus: paper?.result.status ?? null, verifiedCurrentJournal: false,
    sourceJournalAppends: 0, networkAccess: false, executionAllowed: false };
}
export function runOptionsChainReviewCommand(args, { workspaceRoot = process.cwd(), now = () => new Date().toISOString() } = {}) {
  if (args.length === 1 && args[0] === "--route-close") return routeChainClose(now());
  if (args.length === 1 && args[0] === "--host-source") return { source: collectChainClose.toString() };
  if (args.length === 2 && args[0] === "--close-status") {
    if (!/^2026-09-(08|09|10|11|14|15|16)$/.test(args[1])) fail("SESSION");
    const root = realpathSync(workspaceRoot), id = "close-" + args[1].replaceAll("-", "");
    return { snapshotId: id, sessionDate: args[1], existingEvidence: ["-attempt.json", "-capture.json", "-receipt.json", ""].some(suffix => existsSync(resolve(root, BASE, id + suffix))), ordersEnabled: false };
  }
  if (args.length === 3 && args[0] === "--record-close") {
    const root = realpathSync(workspaceRoot), source = io.readBytes(root, args[1], MAX), a = parse(source), route = routeChainClose(now());
    const id = args[2]; exportId(id);
    if (a.version !== "CHAIN_CLOSE_ATTEMPT_V1" || route.action !== "CLOSE_CAPTURE" || a.sessionDate !== route.sessionDate || id !== "close-" + a.sessionDate.replaceAll("-", "") || a.ordersEnabled !== false || a.futureSessionBackfill !== false || !Array.isArray(a.failures) || !Number.isSafeInteger(a.calls) || a.calls < 0 || a.calls > 240 || !Number.isSafeInteger(a.expiredQueriesCompleted)) fail("CLOSE_ATTEMPT");
    if (a.capture?.scope?.expirationStart !== a.sessionDate || a.capture?.capturedAt !== a.capturedAt || a.capture?.origin !== "HOST_MARKET_TOOL_RESPONSES") fail("CLOSE_CAPTURE");
    io.directory(root, BASE); io.writeExclusive(root, BASE + "/" + id + "-attempt.json", source);
    io.writeExclusive(root, BASE + "/" + id + "-capture.json", json(a.capture));
    let saved = null, error = null;
    try { saved = runOptionsChainReviewCommand(["--build", BASE + "/" + id + "-capture.json", id], { workspaceRoot: root, now }); }
    catch (e) { error = /^(CHAIN_SURVEY|CHAIN_REVIEW)_[A-Z_]+$/.test(e.message) ? e.message : "CHAIN_CLOSE_BOARD_FAILED"; }
    const report = saved ? parse(io.readBytes(root, BASE + "/" + id + "/report.json", MAX)) : null;
    const receipt = { version: "CHAIN_CLOSE_RECEIPT_V1", snapshotId: id, sessionDate: a.sessionDate, recordedAt: now(), attemptSha256: hash(source), sourceCalls: a.calls,
      sourceFailures: a.failures.length, expiredQueriesCompleted: a.expiredQueriesCompleted, board: saved, boardError: error,
      quoteDateMatchesSession: report?.chain.rows.filter(r => r.quoteRefreshDateNewYork === a.sessionDate).length ?? 0,
      quoteDateDoesNotMatchSession: report?.chain.rows.filter(r => r.quoteRefreshDateNewYork !== a.sessionDate).length ?? 0,
      completeSessionVolumeVerified: false, ordersEnabled: false };
    io.writeExclusive(root, BASE + "/" + id + "-receipt.json", json(receipt)); return receipt;
  }
  if (args.length === 4 && args[0] === "--compare" || args.length === 2 && args[0] === "--verify-comparison") {
    const root = realpathSync(workspaceRoot), recovering = args[0] === "--verify-comparison", id = recovering ? args[1] : args[3]; exportId(id);
    const path = BASE + "/" + id + ".comparison.json", saved = recovering ? parse(io.readBytes(root, path, MAX)) : null;
    const beforeId = recovering ? saved.beforeId : args[1], afterId = recovering ? saved.afterId : args[2];
    const before = verify(root, beforeId, now), after = verify(root, afterId, now);
    const report = compareRobinhoodChainSurveys(utf8(io.readBytes(root, BASE + "/" + beforeId + "/capture.json", MAX)), before.createdAt, utf8(io.readBytes(root, BASE + "/" + afterId + "/capture.json", MAX)), after.createdAt);
    const result = { version: "CHAIN_REVIEW_COMPARISON_FILE_V1", comparisonId: id, beforeId, afterId, report };
    if (recovering) { if (!json(result).equals(io.readBytes(root, path, MAX))) fail("COMPARISON_RECOMPUTATION"); }
    else io.writeExclusive(root, path, json(result));
    return { status: recovering ? "CHAIN_COMPARISON_RECOMPUTED" : "CHAIN_COMPARISON_SAVED", comparisonId: id, path, reportFingerprint: report.reportFingerprint, counts: report.counts, executionAllowed: false };
  }
  if (args.length === 1 && args[0] === "--help") return { usage: ["options:chain-review -- --build <workspace-capture-json> <new-id> [--paper <saved-paper-portfolio-id>]", "options:chain-review -- --verify <saved-id>", "options:chain-review -- --compare <before-id> <after-id> <new-id>", "options:chain-review -- --verify-comparison <id>", "options:chain-review -- --route-close", "options:chain-review -- --close-status <session-date>", "options:chain-review -- --record-close <workspace-attempt-json> <close-YYYYMMDD>", "options:chain-review -- --host-source"], meaning: "Offline complete-chain activity review and original modeled-account diagnostics. No source refresh, account access or order.", executionAllowed: false };
  if (args.length === 2 && args[0] === "--verify") return verify(realpathSync(workspaceRoot), args[1], now);
  if (args[0] !== "--build" || ![3, 5].includes(args.length) || args.length === 5 && args[3] !== "--paper") fail("ARGUMENTS");
  const id = args[2], paperId = args.length === 5 ? args[4] : null; exportId(id); if (paperId !== null) exportId(paperId);
  const root = realpathSync(workspaceRoot), startedAt = now(); readinessClock(startedAt);
  const source = io.readBytes(root, args[1], MAX), paper = loadPaper(root, paperId, now), createdAt = now(); readinessClock(createdAt);
  if (createdAt < startedAt) fail("CLOCK_ORDER"); const report = board(utf8(source), paper.report, createdAt);
  const files = [["capture.json", source], ["report.json", json(report)], ["index.html", Buffer.from(renderChainReviewBoard(report))]];
  if (paper.bytes) files.push(["paper/" + paperPath(paperId), paper.bytes]);
  if (files.some(([, bytes]) => bytes.length > MAX)) fail("SIZE");
  io.directory(root, BASE); const base = BASE + "/" + id; mkdirSync(resolve(root, base));
  for (const [path, bytes] of files) {
    if (path.includes("/")) io.directory(root, base + "/" + path.slice(0, path.lastIndexOf("/")));
    io.writeExclusive(root, base + "/" + path, bytes);
  }
  const manifest = { version: "OPTIONS_CHAIN_REVIEW_FILES_V1", snapshotId: id, createdAt, paperArtifactId: paperId,
    reportFingerprint: report.reportFingerprint, files: files.map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: hash(bytes) })), sourceJournalAppends: 0, executionAllowed: false };
  io.writeExclusive(root, base + "/manifest.json", json(manifest));
  return { ...verify(root, id, now), status: "CHAIN_REVIEW_BOARD_SAVED_AND_RECOMPUTED" };
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try { console.log(JSON.stringify(runOptionsChainReviewCommand(process.argv.slice(2), { workspaceRoot: resolve(import.meta.dirname, "..") }), null, 2)); }
  catch (e) { console.error(JSON.stringify({ status: "CHAIN_REVIEW_ERROR", code: /^(?:CHAIN_REVIEW|CHAIN_SURVEY|OPTIONS_EXPORT|OPTIONS_READINESS|PAPER_PORTFOLIO)_[A-Z_]+$/.test(e?.message) ? e.message : e?.code === "EEXIST" ? "CHAIN_REVIEW_SNAPSHOT_EXISTS" : "CHAIN_REVIEW_LOCAL_FAILURE", executionAllowed: false })); process.exitCode = 2; }
}
