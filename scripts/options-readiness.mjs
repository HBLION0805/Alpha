import { existsSync, lstatSync, realpathSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { buildOptionsReadiness, readinessClock, readinessFingerprint, readinessStudyId, READINESS_COMPONENTS } from "../src/engines/options-readiness/OptionsReadinessEngine.ts";
import { withOptionsPaperRepository } from "../src/repositories/LocalOptionsPaperRepository.ts";
import { withOptionsHistoricalReplayRepository } from "../src/repositories/LocalOptionsHistoricalReplayRepository.ts";
import { withOptionsMarketEvidenceRepository } from "../src/repositories/LocalOptionsMarketEvidenceRepository.ts";
import { buildOptionsDriverReport } from "../src/engines/options-drivers/OptionsDriverMonitorEngine.ts";
import { reportTreasuryHistory } from "../src/engines/options-treasury/TreasuryRealYieldEngine.ts";
import { withDriverJournal } from "./lib/options-driver-io.mjs";
import { withTreasuryJournal } from "./lib/options-treasury-io.mjs";
import { runRobinhoodCloseoutCommand } from "./options-robinhood-closeout.mjs";

const unavailable = (state, checkedAt, errorCode) => ({ state, checkedAt, reportSha256: null, summary: null, errorCode });
function checkStore(root, path, maxBytes) {
  const parts = relative(root, path).split(sep);
  if (isAbsolute(relative(root, path)) || parts.includes("..")) throw Error("READINESS_STORE_UNSAFE");
  let current = root;
  for (const [index, part] of parts.entries()) {
    current = resolve(current, part);
    if (!existsSync(current)) return false;
    const stat = lstatSync(current);
    const parent = index < parts.length - 1;
    if (stat.isSymbolicLink() || (parent ? !stat.isDirectory() : !stat.isFile() || stat.nlink !== 1 || stat.size > maxBytes)) throw Error("READINESS_STORE_UNSAFE");
    const real = relative(root, realpathSync(current));
    if (isAbsolute(real) || real === ".." || real.startsWith(".." + sep)) throw Error("READINESS_STORE_UNSAFE");
  }
  return true;
}
/** Project only recovered report facts. Provider text and simulated account balances are excluded. */
export function summarizeReadinessComponent(id, report, studyId, checkedAt) {
  if (!report || report.executionAllowed !== false) throw Error("READINESS_SOURCE_AUTHORITY");
  let summary;
  if (id === "collection") {
    if (report.status !== "NO_REPLAY" || report.winProbability !== null || report.studyId !== studyId || report.assessedAt !== checkedAt) throw Error("READINESS_COLLECTION_BOUNDARY");
    summary = { studyId, stage: report.stage, windowStartAt: report.windowStartAt, windowEndAt: report.windowEndAt,
      declaredSlots: report.declaredSlotCount, elapsedSlots: report.elapsedSlotCount, completeUsableSlots: report.completedCoverage.completeUsableSlots,
      automaticAttempts: report.totals.automaticAttempts, sourceFailures: report.totals.sourceFailureAttempts, savedFrames: report.totals.savedFrames,
      usableObservations: report.totals.diagnosticUsableObservations, operationalLessons: report.operationalLessons.length,
      quoteQualityLessons: report.observationReview.candidateLessons.length, blockerCodes: [...report.observationReview.blockers].sort() };
  } else if (id === "paper") {
    if (report.mode !== "LOCAL_SIMULATION_ONLY" || report.marketValidated !== false || report.probability !== null || report.trades.some(t => !["GLD", "IBIT"].includes(t.symbol))) throw Error("READINESS_PAPER_BOUNDARY");
    const closed = report.trades.filter(t => t.status === "CLOSED"), reviews = new Map(report.reviews.map(r => [r.input.tradeId, r.fingerprint]));
    summary = { origin: report.origin, tradeCount: report.trades.length, closedTradeCount: closed.length, reviewCount: report.reviews.length,
      missingReviewCount: closed.filter(t => !t.review || reviews.get(t.tradeId) !== t.review.fingerprint).length,
      openPositionCount: report.account.openPositionCount, pendingOrderCount: report.account.pendingOrderCount,
      candidateLessonCount: report.mistakeNotebook.entries.length, notebookFingerprint: report.mistakeNotebook.fingerprint };
  } else if (id === "historical") {
    if (report.marketValidated !== false || report.winProbability !== null || report.accountAggregation !== "INDEPENDENT_1000_USD_RUNS_NO_SHARED_COMPOUNDING" || report.runs.some(r => r.result.symbol !== null && !["GLD", "IBIT"].includes(r.result.symbol))) throw Error("READINESS_HISTORICAL_BOUNDARY");
    summary = { runCount: report.runCount, closedTradeCount: report.closedTradeCount, reviewedRunCount: report.runs.filter(r => r.review).length,
      candidateLessonCount: report.mistakeNotebook.entries.length, syntheticRuns: report.sourceCounts.SYNTHETIC_FIXTURE,
      importedRuns: report.sourceCounts.OWNER_PROVIDED_FILE, missingDataRuns: report.sourceCounts.MISSING_DATA };
  } else if (id === "imports") {
    if (report.realPriceReplayReady !== false || report.winProbability !== null || report.asOf !== checkedAt) throw Error("READINESS_IMPORT_BOUNDARY");
    summary = { datasetCount: report.datasetCount, rowCount: report.rowCount, syntheticDatasets: report.origins.SYNTHETIC_FIXTURE,
      ownerProvidedDatasets: report.origins.OWNER_PROVIDED_FILE, decision: report.decision };
  } else if (id === "headlines") {
    if (report.probability !== null || report.asOf !== checkedAt || report.tradeUniverse.join() !== "GLD,IBIT") throw Error("READINESS_HEADLINE_BOUNDARY");
    summary = { observationsInHistory: report.observationsInHistory,
      sources: report.sources.map(s => ({ id: s.id, status: s.health.status, observedAt: s.health.observedAt, refreshOverdue: s.refreshOverdue })) };
  } else if (id === "treasury") {
    if (report.winProbability !== null || report.assessedAt !== checkedAt || report.relevantAssets.join() !== "GLD,IBIT") throw Error("READINESS_TREASURY_BOUNDARY");
    summary = { retrievalCount: report.retrievalCount, status: report.latestRetrieval?.status ?? "NOT_REFRESHED", receivedAt: report.latestRetrieval?.receivedAt ?? null,
      sourceDate: report.currentRow?.sourceDate ?? null, ratesBps: report.currentRow ? { ...report.currentRow.ratesBps } : null,
      dateLagDays: report.currentDateLagDays, missingTenors: [...report.missingTenors], versionCount: report.versions.length };
  } else throw Error("READINESS_COMPONENT_SCOPE");
  const item = { state: "AVAILABLE", checkedAt, reportSha256: readinessFingerprint(report), summary, errorCode: null };
  const validation = Object.fromEntries(READINESS_COMPONENTS.map(key => [key, key === id ? item : unavailable("MISSING", checkedAt, "STORE_MISSING")]));
  buildOptionsReadiness(studyId, validation, checkedAt);
  return item;
}

export async function runOptionsReadinessCommand(args, { workspaceRoot = process.cwd(), now = () => new Date().toISOString() } = {}) {
  if (args.length === 1 && args[0] === "--help") return { usage: "options:readiness -- --report <study-id>", networkAccess: false, executionAllowed: false,
    meaning: "Read existing local stores and candidate notebooks. No source refresh, saved trade, quote collection, account access or scheduling." };
  if (args.length !== 2 || args[0] !== "--report") throw Error("OPTIONS_READINESS_ARGUMENTS");
  const studyId = args[1]; readinessStudyId(studyId);
  const root = realpathSync(workspaceRoot), evidence = {};
  const sources = {
    collection: { path: `options-robinhood-data/studies/${studyId}/plan.json`, max: 524288, read: at => runRobinhoodCloseoutCommand(["--report", studyId], { workspaceRoot: root, now: () => at }) },
    paper: { path: "options-paper/sessions.ndjson", max: 16 * 1024 * 1024, read: () => withOptionsPaperRepository(root, r => r.readReport()) },
    historical: { path: "options-historical-replay/runs.ndjson", max: 16 * 1024 * 1024, read: () => withOptionsHistoricalReplayRepository(root, r => r.readReport()) },
    imports: { path: "options-market-evidence/imports.ndjson", max: 16 * 1024 * 1024, read: at => withOptionsMarketEvidenceRepository(root, r => r.readReport(at)) },
    headlines: { path: "options-driver-monitor/refreshes.ndjson", max: 16 * 1024 * 1024, read: at => withDriverJournal(root, s => buildOptionsDriverReport(s.observations, s.health, at)) },
    treasury: { path: "options-treasury-rates/retrievals.ndjson", max: 32 * 1024 * 1024, read: at => withTreasuryJournal(root, s => reportTreasuryHistory(s.inputs, at), at) },
  };
  for (const id of READINESS_COMPONENTS) {
    const checkedAt = now(); readinessClock(checkedAt);
    const source = sources[id], path = resolve(root, "data/runtime", source.path);
    try {
      evidence[id] = !checkStore(root, path, source.max) ? unavailable("MISSING", checkedAt, "STORE_MISSING") :
        summarizeReadinessComponent(id, await source.read(checkedAt), studyId, checkedAt);
    } catch (error) {
      const code = error?.code === "EEXIST" ? "STORE_BUSY" : error?.message === "READINESS_STORE_UNSAFE" ? "STORE_UNSAFE" : "RECOVERY_FAILED";
      evidence[id] = unavailable("BLOCKED", checkedAt, code);
    }
  }
  return buildOptionsReadiness(studyId, evidence, now());
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const report = await runOptionsReadinessCommand(process.argv.slice(2), { workspaceRoot: resolve(import.meta.dirname, "..") });
    console.log(JSON.stringify(report, null, 2));
    if (report.blockedStores?.length) process.exitCode = 3;
  } catch (error) {
    console.error(JSON.stringify({ status: "OPTIONS_READINESS_ERROR", code: /^OPTIONS_READINESS_[A-Z_]+$/.test(error?.message) ? error.message : "OPTIONS_READINESS_LOCAL_FAILURE", executionAllowed: false }));
    process.exitCode = 2;
  }
}
