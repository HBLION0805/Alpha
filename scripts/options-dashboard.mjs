import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, realpathSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { optionsEvidenceExportStorage as io } from "./options-evidence-export.mjs";
import { runOptionsContextReadinessCommand } from "./options-readiness.mjs";
import { runOptionsCalendarBriefCommand } from "./options-calendar-brief.mjs";
import { runOptionsOutcomeAuditCommand } from "./options-outcome-audit.mjs";
import { exportId, exportClock } from "../src/engines/options-evidence-export/OptionsEvidenceExportEngine.ts";
import { buildDashboardReport, renderDashboard } from "./lib/options-dashboard-render.mjs";

const BASE = "data/runtime/options-dashboard", MAX_REPORT = 8 * 1024 * 1024, MAX_HTML = 8 * 1024 * 1024;
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
export async function runOptionsDashboardCommand(args, { workspaceRoot = process.cwd(), now = () => new Date().toISOString() } = {}) {
  if (args.length === 1 && args[0] === "--help") return { usage: "options:dashboard -- --build <study-id> <new-snapshot-id>", meaning: "Build a new immutable offline dashboard from saved local stores. No source refresh, external hosting, account access or orders.", executionAllowed: false };
  if (args.length !== 3 || args[0] !== "--build") throw Error("OPTIONS_DASHBOARD_ARGUMENTS");
  const studyId = args[1], snapshotId = args[2]; exportId(studyId); exportId(snapshotId);
  const root = realpathSync(workspaceRoot), startedAt = now(); exportClock(startedAt);
  const readiness = await runOptionsContextReadinessCommand(["--report", studyId], { workspaceRoot: root, now });
  const calendar = await runOptionsCalendarBriefCommand(["--report", "--json"], { workspaceRoot: root, now });
  const outcomes = runOptionsOutcomeAuditCommand(["--report"], { workspaceRoot: root, now });
  const report = buildDashboardReport(readiness, calendar, outcomes, now());
  if (startedAt > readiness.assessedAt) throw Error("OPTIONS_DASHBOARD_CLOCK_ORDER");
  const css = readFileSync(resolve(import.meta.dirname, "lib/options-dashboard.css"), "utf8"), html = Buffer.from(renderDashboard(report, css));
  const json = Buffer.from(JSON.stringify(report, null, 2) + "\n");
  if (html.length > MAX_HTML || json.length > MAX_REPORT) throw Error("OPTIONS_DASHBOARD_SIZE_LIMIT");
  const parent = io.directory(root, BASE), directory = resolve(parent, snapshotId);
  // mkdir is exclusive. Existing or incomplete snapshots are never overwritten.
  mkdirSync(directory);
  const base = BASE + "/" + snapshotId;
  for (const [name, bytes] of [["index.html", html], ["report.json", json]]) {
    io.writeExclusive(root, base + "/" + name, bytes);
    if (!io.readBytes(root, base + "/" + name, Math.max(MAX_HTML, MAX_REPORT)).equals(bytes)) throw Error("OPTIONS_DASHBOARD_WRITE_CHANGED");
  }
  const completedAt = now(); exportClock(completedAt); if (completedAt < report.constructedAt) throw Error("OPTIONS_DASHBOARD_CLOCK_ORDER");
  const manifest = { version: "OPTIONS_LOCAL_DASHBOARD_FILES_V1", snapshotId, studyId, startedAt, completedAt, reportArtifactSha256: report.artifactSha256,
    files: [{ name: "index.html", bytes: html.length, sha256: sha(html) }, { name: "report.json", bytes: json.length, sha256: sha(json) }], sourceWrites: 0, networkAccess: false, executionAllowed: false };
  const encoded = Buffer.from(JSON.stringify(manifest, null, 2) + "\n"); io.writeExclusive(root, base + "/manifest.json", encoded);
  if (!io.readBytes(root, base + "/manifest.json", 16384).equals(encoded)) throw Error("OPTIONS_DASHBOARD_WRITE_CHANGED");
  return { status: "LOCAL_DASHBOARD_SAVED", snapshotId, studyId, path: base + "/index.html", manifest,
    blockedStores: { readiness: readiness.blockedStores, calendar: calendar.blockedStores, outcomes: outcomes.blockedStores }, crossReportChecks: report.crossReportChecks,
    hostSchedule: "NOT_INSPECTED", realPriceTestReady: false, sourceWrites: 0, networkAccess: false, executionAllowed: false };
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try { const r = await runOptionsDashboardCommand(process.argv.slice(2), { workspaceRoot: resolve(import.meta.dirname, "..") }); console.log(JSON.stringify(r, null, 2)); if (r.blockedStores && Object.values(r.blockedStores).some(s => s.length)) process.exitCode = 3; }
  catch (error) { console.error(JSON.stringify({ status: "OPTIONS_DASHBOARD_ERROR", code: /^OPTIONS_(?:DASHBOARD|EXPORT|READINESS)_[A-Z_]+$/.test(error?.message) ? error.message : error?.code === "EEXIST" ? "OPTIONS_DASHBOARD_SNAPSHOT_EXISTS" : "OPTIONS_DASHBOARD_LOCAL_FAILURE", executionAllowed: false })); process.exitCode = 2; }
}
