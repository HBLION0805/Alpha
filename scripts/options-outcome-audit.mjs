import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { auditOptionsOutcomes } from "../src/engines/options-readiness/OptionsOutcomeAudit.ts";
import { readinessClock } from "../src/engines/options-readiness/OptionsReadinessEngine.ts";
import { optionsEvidenceExportStorage as io } from "./options-evidence-export.mjs";
import { withOptionsPaperRepository } from "../src/repositories/LocalOptionsPaperRepository.ts";
import { withOptionsHistoricalReplayRepository } from "../src/repositories/LocalOptionsHistoricalReplayRepository.ts";

export function runOptionsOutcomeAuditCommand(args, { workspaceRoot = process.cwd(), now = () => new Date().toISOString() } = {}) {
  if (args.length === 1 && args[0] === "--help") return { usage: "options:outcome-audit -- --report", meaning: "Read and recompute saved local outcomes; no HTTP, writes to journals, strategy changes or trades.", executionAllowed: false };
  if (args.length !== 1 || args[0] !== "--report") throw Error("OUTCOME_AUDIT_ARGUMENTS");
  const { histories, constructedAt } = loadOptionsOutcomeHistories({ workspaceRoot, now });
  return auditOptionsOutcomes(histories, constructedAt);
}

/** Shared recovery sequence for read-only consumers; no new repository writer. */
export function loadOptionsOutcomeHistories({ workspaceRoot = process.cwd(), now = () => new Date().toISOString() } = {}) {
  const root = realpathSync(workspaceRoot), histories = {}, start = now(); readinessClock(start); let previous = start;
  const sources = {
    paper: { file: "options-paper/sessions.ndjson", read: () => withOptionsPaperRepository(root, r => r.readReport().trades.map(t => r.readScenario(t.tradeId))) },
    historical: { file: "options-historical-replay/runs.ndjson", read: () => withOptionsHistoricalReplayRepository(root, r => r.readReport().runs.map(t => r.readRun(t.config.runId))) },
  };
  for (const [id, source] of Object.entries(sources)) {
    const checkedAt = now(); readinessClock(checkedAt); if (checkedAt < previous) throw Error("OUTCOME_AUDIT_CLOCK_ORDER"); previous = checkedAt;
    try {
      const path = "data/runtime/" + source.file, before = io.readBytes(root, path, 16 * 1024 * 1024), payload = source.read();
      if (!before.equals(io.readBytes(root, path, 16 * 1024 * 1024))) throw Error("OPTIONS_EXPORT_FILE_CHANGED");
      histories[id] = { state: "AVAILABLE", checkedAt, payload, errorCode: null };
    } catch (error) {
      const missing = error?.code === "ENOENT", errorCode = missing ? "STORE_MISSING" : error?.code === "EEXIST" ? "STORE_BUSY" : /^OPTIONS_EXPORT_(?:UNSAFE_|PATH_ESCAPE|FILE_CHANGED)/.test(error?.message) ? "STORE_UNSAFE" : "RECOVERY_FAILED";
      histories[id] = { state: missing ? "MISSING" : "BLOCKED", checkedAt, payload: null, errorCode };
    }
  }
  return { histories, constructedAt: now() };
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try { const report = runOptionsOutcomeAuditCommand(process.argv.slice(2), { workspaceRoot: resolve(import.meta.dirname, "..") }); console.log(JSON.stringify(report, null, 2)); if (report.blockedStores?.length) process.exitCode = 3; }
  catch (error) { console.error(JSON.stringify({ status: "OUTCOME_AUDIT_ERROR", code: /^(OUTCOME_AUDIT_[A-Z_]+|OPTIONS_READINESS_CLOCK)$/.test(error?.message) ? error.message : "OUTCOME_AUDIT_LOCAL_FAILURE", executionAllowed: false })); process.exitCode = 2; }
}
