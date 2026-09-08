import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readdirSync, realpathSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { freezeOptionsActivityStudy, evaluateOptionsActivityStudy, ACTIVITY_STUDY_POLICY } from "../src/engines/options-robinhood-data/OptionsActivityStudy.ts";
import { parseChainSurveyJson } from "../src/engines/options-robinhood-data/RobinhoodChainSurvey.ts";
import { readinessClock } from "../src/engines/options-readiness/OptionsReadinessEngine.ts";
import { paperFingerprint } from "../src/engines/options-paper/OptionsPaperTradingEngine.ts";
import { exportId } from "../src/engines/options-evidence-export/OptionsEvidenceExportEngine.ts";
import { optionsEvidenceExportStorage as io } from "./options-evidence-export.mjs";
import { runOptionsChainReviewCommand } from "./options-chain-review.mjs";

const BASE = "data/runtime/options-activity-studies", CHAIN = "data/runtime/options-chain-survey", MAX = 32 * 1024 * 1024;
const fail = code => { throw Error("ACTIVITY_STORE_" + code); };
const json = v => Buffer.from(JSON.stringify(v, null, 2) + "\n");
const hash = b => createHash("sha256").update(b).digest("hex");
const text = b => new TextDecoder("utf-8", { fatal: true }).decode(b);
const parse = b => parseChainSurveyJson(text(b));
const read = (root, path) => io.readBytes(root, path, MAX);
function exactEntries(root, path, expected) {
  const full = resolve(root, path), s = lstatSync(full);
  if (!s.isDirectory() || s.isSymbolicLink()) fail("UNSAFE_DIRECTORY");
  const entries = readdirSync(full, { withFileTypes: true });
  if (entries.some(e => e.isSymbolicLink()) || entries.map(e => e.name).sort().join("|") !== [...expected].sort().join("|")) fail("ENTRIES");
}
function clock(now) { const at = now(); readinessClock(at); return at; }
function loadStudy(root, studyId, now) {
  exportId(studyId); const base = BASE + "/" + studyId;
  const bytes = read(root, base + "/payload.json"), p = parse(bytes), receiptBytes = read(root, base + "/receipt.json"), r = parse(receiptBytes);
  const study = freezeOptionsActivityStudy(p.baselineSourceText, p.study.baselineAssessedAt, p.study.registeredAt);
  exportId(p.baselineBoardId); readinessClock(r.savedAt);
  const payload = { version: "OPTIONS_ACTIVITY_STUDY_PAYLOAD_V1", studyId, baselineBoardId: p.baselineBoardId, baselineSourceText: p.baselineSourceText, study };
  const receipt = { version: "OPTIONS_ACTIVITY_STUDY_RECEIPT_V1", studyId, payloadSha256: hash(bytes), studyFingerprint: study.studyFingerprint,
    registeredAt: study.registeredAt, savedAt: r.savedAt, prospectiveAtSave: true };
  if (!json(payload).equals(bytes) || !json(receipt).equals(receiptBytes)) fail("STUDY_RECOMPUTATION");
  if (r.savedAt < study.registeredAt || r.savedAt >= ACTIVITY_STUDY_POLICY.registrationDeadline || clock(now) < r.savedAt) fail("STUDY_SAVE_CLOCK");
  exactEntries(root, base, existsSync(resolve(root, base, "reports")) ? ["payload.json", "receipt.json", "reports"] : ["payload.json", "receipt.json"]);
  return { payload, receipt, study, base };
}
function render(report, studyId) {
  const rows = report.cases.map(c => {
    const o = c.outcomes.find(o => o.primary && o.costScenario === "ILLUSTRATIVE_BASE");
    return `| ${c.candidate.symbol} | ${c.candidate.expiry} | ${c.candidate.type} ${c.candidate.strike} | ${c.control ? c.control.strike : "Unmatched"} | ${o.candidate.netReferenceChangeUsd ?? "Unknown"} | ${o.candidate.affordableUnder50Usd ?? "Unknown"} | ${o.pairedDifferenceBps ?? "Unknown"} | ${o.candidate.reason ?? o.candidate.result} |`;
  });
  return `# Option activity follow-up: ${studyId}\n\nRecorded ${report.assessedAt}. ${report.status}.\n\n` +
    `${report.counts.candidates} frozen candidates; ${report.counts.matched} matched controls; ${report.counts.observedSessions}/7 session boards; ${report.counts.primaryEvaluableCandidates} evaluable primary candidates.\n\n` +
    "Primary: September 8 entry Ask to September 9 exit Bid, one hypothetical long contract. The table uses illustrative base costs ($0.50 fee plus $0.01/share allowance per side). Fees and execution are unverified. September 18 expiries are a separate comparison cohort in the complete report.\n\n" +
    "Positive references are candidate observations, not a validated edge or permission to trade. Daily quotes cannot verify intraday stops/targets or causes. Many contracts share the same shocks. Missing and unaffordable cases remain visible.\n\n" +
    "[Complete outcomes, all horizons, cost scenarios and candidate lessons](report.json)\n\n" +
    "| ETF | Expiry | Candidate | Control strike | Net reference USD | Within $50 | Paired difference bps | Outcome or gap |\n| --- | --- | --- | --- | --- | --- | --- | --- |\n" + rows.join("\n") + "\n";
}
function phase(at) { return ACTIVITY_STUDY_POLICY.sessions.filter(d => at >= d + "T22:00:00.000Z"); }
function reportId(study, metadata, at) { return "state-" + paperFingerprint({ studyFingerprint: study.studyFingerprint, snapshots: metadata, elapsedSessionWindows: phase(at) }).slice(7); }
function verifyReport(root, studyId, id, now) {
  exportId(id); const loaded = loadStudy(root, studyId, now), base = loaded.base + "/reports/" + id;
  const envelopeBytes = read(root, base + "/inputs.json"), envelope = parse(envelopeBytes);
  readinessClock(envelope.assessedAt);
  if (envelope.version !== "OPTIONS_ACTIVITY_REPORT_INPUTS_V1" || envelope.studyId !== studyId || envelope.studyFingerprint !== loaded.study.studyFingerprint || !Array.isArray(envelope.snapshots) || envelope.snapshots.length > 7 || envelope.assessedAt < loaded.receipt.savedAt || clock(now) < envelope.assessedAt) fail("REPORT_ENVELOPE");
  if (!json(envelope).equals(envelopeBytes) || Object.keys(envelope).sort().join() !== ["version", "studyId", "studyFingerprint", "assessedAt", "snapshots"].sort().join()) fail("REPORT_ENCODING");
  const inputs = envelope.snapshots.map(s => {
    if (!ACTIVITY_STUDY_POLICY.sessions.includes(s.sessionDate) || Object.keys(s).sort().join() !== ["sessionDate", "assessedAt", "sourceSha256"].sort().join()) fail("SNAPSHOT_METADATA");
    const bytes = read(root, base + "/close-" + s.sessionDate.replaceAll("-", "") + ".json");
    if (hash(bytes) !== s.sourceSha256) fail("SNAPSHOT_HASH");
    return { sessionDate: s.sessionDate, assessedAt: s.assessedAt, sourceText: text(bytes) };
  });
  if (id !== reportId(loaded.study, envelope.snapshots, envelope.assessedAt)) fail("REPORT_ID");
  exactEntries(root, base, ["inputs.json", "report.json", "review.md", ...envelope.snapshots.map(s => "close-" + s.sessionDate.replaceAll("-", "") + ".json")]);
  const report = evaluateOptionsActivityStudy(loaded.payload.baselineSourceText, loaded.study.baselineAssessedAt, loaded.study.registeredAt, inputs, envelope.assessedAt);
  if (!json(report).equals(read(root, base + "/report.json")) || !Buffer.from(render(report, studyId)).equals(read(root, base + "/review.md"))) fail("REPORT_RECOMPUTATION");
  return { status: "ACTIVITY_REPORT_RECOMPUTED", studyId, reportId: id, path: base + "/review.md", assessedAt: report.assessedAt,
    reportFingerprint: report.reportFingerprint, counts: report.counts, candidateLessons: report.candidateLessons.length, validatedEdge: false, executionAllowed: false };
}
export function runOptionsActivityStudyCommand(args, { workspaceRoot = process.cwd(), now = () => new Date().toISOString() } = {}) {
  if (args.length === 1 && args[0] === "--help") return { usage: ["options:activity-study -- --register <verified-baseline-board-id> <new-study-id>", "options:activity-study -- --verify <study-id>", "options:activity-study -- --update <study-id>", "options:activity-study -- --verify-report <study-id> <report-id>"], sourceRefresh: false, executionAllowed: false };
  const root = realpathSync(workspaceRoot);
  if (args.length === 3 && args[0] === "--verify-report") return verifyReport(root, args[1], args[2], now);
  if (args.length === 3 && args[0] === "--register") {
    const [boardId, studyId] = args.slice(1); exportId(boardId); exportId(studyId);
    const board = runOptionsChainReviewCommand(["--verify", boardId], { workspaceRoot: root, now });
    const source = text(read(root, CHAIN + "/" + boardId + "/capture.json")), registeredAt = clock(now);
    const study = freezeOptionsActivityStudy(source, board.createdAt, registeredAt), base = BASE + "/" + studyId;
    const payload = { version: "OPTIONS_ACTIVITY_STUDY_PAYLOAD_V1", studyId, baselineBoardId: boardId, baselineSourceText: source, study }, bytes = json(payload);
    if (bytes.length > MAX) fail("PAYLOAD_SIZE");
    io.directory(root, BASE); mkdirSync(resolve(root, base)); io.writeExclusive(root, base + "/payload.json", bytes);
    const savedAt = clock(now); if (savedAt < registeredAt || savedAt >= ACTIVITY_STUDY_POLICY.registrationDeadline) fail("PROSPECTIVE_SAVE_DEADLINE");
    const receipt = { version: "OPTIONS_ACTIVITY_STUDY_RECEIPT_V1", studyId, payloadSha256: hash(bytes), studyFingerprint: study.studyFingerprint,
      registeredAt, savedAt, prospectiveAtSave: true };
    io.writeExclusive(root, base + "/receipt.json", json(receipt));
    loadStudy(root, studyId, now);
    return { status: "ACTIVITY_STUDY_REGISTERED", studyId, registeredAt, savedAt, studyFingerprint: study.studyFingerprint, counts: study.counts, executionAllowed: false };
  }
  if (args.length === 2 && ["--verify", "--update"].includes(args[0])) {
    const studyId = args[1], loaded = loadStudy(root, studyId, now);
    if (args[0] === "--verify") return { status: "ACTIVITY_STUDY_RECOMPUTED", studyId, studyFingerprint: loaded.study.studyFingerprint, counts: loaded.study.counts, savedAt: loaded.receipt.savedAt, prospectiveAtSave: true, executionAllowed: false };
    const inputs = [];
    for (const date of ACTIVITY_STUDY_POLICY.sessions) {
      const id = "close-" + date.replaceAll("-", ""), path = CHAIN + "/" + id;
      if (!existsSync(resolve(root, path))) continue;
      const board = runOptionsChainReviewCommand(["--verify", id], { workspaceRoot: root, now });
      inputs.push({ sessionDate: date, sourceText: text(read(root, path + "/capture.json")), assessedAt: board.createdAt });
    }
    const assessedAt = clock(now), report = evaluateOptionsActivityStudy(loaded.payload.baselineSourceText, loaded.study.baselineAssessedAt, loaded.study.registeredAt, inputs, assessedAt);
    const metadata = inputs.map(s => ({ sessionDate: s.sessionDate, assessedAt: s.assessedAt, sourceSha256: hash(Buffer.from(s.sourceText)) }));
    const id = reportId(loaded.study, metadata, assessedAt), base = loaded.base + "/reports/" + id;
    if (existsSync(resolve(root, base))) return { ...verifyReport(root, studyId, id, now), status: "ACTIVITY_INPUT_STATE_UNCHANGED" };
    const envelope = { version: "OPTIONS_ACTIVITY_REPORT_INPUTS_V1", studyId, studyFingerprint: loaded.study.studyFingerprint, assessedAt, snapshots: metadata };
    const files = [["inputs.json", json(envelope)], ["report.json", json(report)], ["review.md", Buffer.from(render(report, studyId))],
      ...inputs.map(s => ["close-" + s.sessionDate.replaceAll("-", "") + ".json", Buffer.from(s.sourceText)])];
    if (files.some(([, bytes]) => bytes.length > MAX)) fail("REPORT_SIZE");
    io.directory(root, loaded.base + "/reports"); mkdirSync(resolve(root, base));
    for (const [name, bytes] of files) io.writeExclusive(root, base + "/" + name, bytes);
    return { ...verifyReport(root, studyId, id, now), status: "ACTIVITY_REPORT_SAVED" };
  }
  fail("ARGUMENTS");
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { console.log(JSON.stringify(runOptionsActivityStudyCommand(process.argv.slice(2)), null, 2)); }
  catch (error) { console.error(/^(ACTIVITY_|CHAIN_|OPTIONS_EXPORT_|READINESS_)[A-Z_]+$/.test(error.message) ? error.message : "ACTIVITY_STORE_OPERATION_FAILED"); process.exitCode = 1; }
}
