import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { loadOptionsOutcomeHistories } from "./options-outcome-audit.mjs";
import { parseOptionsSampleJson } from "./options-sample-partition.mjs";
import { optionsEvidenceExportStorage as io } from "./options-evidence-export.mjs";
import { exportId } from "../src/engines/options-evidence-export/OptionsEvidenceExportEngine.ts";
import { inventoryOptionsSamples } from "../src/engines/options-sample-partition/OptionsSampleInventory.ts";
import { readinessClock, readinessFingerprint } from "../src/engines/options-readiness/OptionsReadinessEngine.ts";

const BASE = "data/runtime/options-sample-partition", MAX_BYTES = 64 * 1024 * 1024;
function fail(code) { throw Error("SAMPLE_INVENTORY_" + code); }
function brief(report) {
  return ["Alpha existing options sample inventory", "Constructed: " + report.constructedAt,
    "Current cases: " + report.totalCases + "; closed reviews: " + report.closedReviews + "; complete partition inputs: 0.",
    ...report.components.map(c => c.sourceSystem + ": " + c.state + "; " + c.caseCount + " cases; " + c.closedReviewCount + " closed reviews; " + (c.errorCode ?? "source recovery passed")),
    "Repeated exact quote paths: " + report.repeatedQuotePaths.length + "; shared New York decision dates: " + report.sharedDecisionDates.length + ".",
    "Feature-window and knowledge clocks remain missing. No split, independent sample count, calibrated win rate or order is produced.", ""].join("\n");
}
function artifact(histories, constructedAt, recordedAt, artifactId) {
  readinessClock(constructedAt); readinessClock(recordedAt);
  if (recordedAt < constructedAt) fail("RECORDING_CLOCK");
  const inventory = inventoryOptionsSamples(histories, constructedAt);
  const body = { version: "OPTIONS_SAMPLE_INVENTORY_ARTIFACT_V1", artifactId, constructedAt, recordedAt, histories, inventory, brief: brief(inventory),
    existingJournalAppends: 0, executionAllowed: false };
  return { ...body, artifactSha256: readinessFingerprint(body) };
}
function verify(root, id, now) {
  exportId(id);
  const bytes = io.readBytes(root, BASE + "/" + id + ".json", MAX_BYTES), saved = parseOptionsSampleJson(bytes);
  if (!saved || saved.version !== "OPTIONS_SAMPLE_INVENTORY_ARTIFACT_V1" || saved.artifactId !== id) fail("ARTIFACT_ID_OR_VERSION");
  const recomputed = artifact(saved.histories, saved.constructedAt, saved.recordedAt, id);
  if (!bytes.equals(Buffer.from(JSON.stringify(recomputed, null, 2) + "\n"))) fail("ARTIFACT_REPLAY_MISMATCH");
  const checkedAt = now(); readinessClock(checkedAt); if (checkedAt < saved.recordedAt) fail("RECORDING_CLOCK");
  return { status: "SAMPLE_INVENTORY_ARTIFACT_RECOMPUTED", artifactId: id, recordedAt: saved.recordedAt, checkedAt,
    artifactSha256: recomputed.artifactSha256, totalCases: recomputed.inventory.totalCases, closedReviews: recomputed.inventory.closedReviews,
    completePartitionInputCount: 0, blockedStores: recomputed.inventory.blockedStores, missingStores: recomputed.inventory.missingStores,
    brief: recomputed.brief, existingJournalAppends: 0, executionAllowed: false };
}
export function runOptionsSampleInventoryCommand(args, { workspaceRoot = process.cwd(), now = () => new Date().toISOString() } = {}) {
  if (args.length === 1 && args[0] === "--help") return { usage: ["options:sample-inventory -- --report [--save <new-id>]", "options:sample-inventory -- --verify <saved-id>"],
    meaning: "Recover all existing paper/research cases and identify missing sampling evidence. No source refresh, split selection, account or order action.", executionAllowed: false };
  if (args.length === 2 && args[0] === "--verify") return verify(realpathSync(workspaceRoot), args[1], now);
  if (args[0] !== "--report" || ![1, 3].includes(args.length) || args.length === 3 && args[1] !== "--save") fail("ARGUMENTS");
  const id = args.length === 3 ? args[2] : null; if (id !== null) exportId(id);
  const root = realpathSync(workspaceRoot), { histories, constructedAt } = loadOptionsOutcomeHistories({ workspaceRoot: root, now });
  if (id === null) return inventoryOptionsSamples(histories, constructedAt);
  const saved = artifact(histories, constructedAt, now(), id), bytes = Buffer.from(JSON.stringify(saved, null, 2) + "\n");
  if (bytes.length > MAX_BYTES) fail("ARTIFACT_SIZE");
  io.directory(root, BASE); io.writeExclusive(root, BASE + "/" + id + ".json", bytes);
  return { ...verify(root, id, now), status: "SAMPLE_INVENTORY_ARTIFACT_SAVED_AND_RECOMPUTED", path: BASE + "/" + id + ".json" };
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try { const report = runOptionsSampleInventoryCommand(process.argv.slice(2), { workspaceRoot: resolve(import.meta.dirname, "..") }); console.log(JSON.stringify(report, null, 2)); if (report.blockedStores?.length) process.exitCode = 3; }
  catch (error) { console.error(JSON.stringify({ status: "SAMPLE_INVENTORY_ERROR", code: /^(?:SAMPLE_(?:INVENTORY|PARTITION)_[A-Z_]+|OUTCOME_AUDIT_[A-Z_]+|OPTIONS_(?:READINESS_CLOCK|EXPORT_[A-Z_]+))$/.test(error?.message) ? error.message : error?.code === "EEXIST" ? "SAMPLE_INVENTORY_ARTIFACT_EXISTS" : "SAMPLE_INVENTORY_LOCAL_FAILURE", executionAllowed: false })); process.exitCode = 2; }
}
