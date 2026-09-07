import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { buildOptionsOperatorBrief } from "../src/engines/options-readiness/OptionsOperatorBrief.ts";
import { readinessClock, readinessStudyId } from "../src/engines/options-readiness/OptionsReadinessEngine.ts";
import { runOptionsContextReadinessCommand } from "./options-readiness.mjs";
import { withReleaseCalendarJournal } from "./lib/options-release-calendar-io.mjs";
import { optionsEvidenceExportStorage as io } from "./options-evidence-export.mjs";

export async function runOptionsBriefCommand(args, { workspaceRoot = process.cwd(), now = () => new Date().toISOString() } = {}) {
  if (args.length === 1 && args[0] === "--help") return { usage: "options:brief -- --report <study-id> [--json]", meaning: "Read local test, review and source context as plain text or bound JSON. No network, source appends, host inspection or trades.", executionAllowed: false };
  if (![2, 3].includes(args.length) || args[0] !== "--report" || args.length === 3 && args[2] !== "--json") throw Error("OPTIONS_BRIEF_ARGUMENTS");
  readinessStudyId(args[1]);
  const root = realpathSync(workspaceRoot), core = await runOptionsContextReadinessCommand(["--report", args[1]], { workspaceRoot: root, now });
  const checkedAt = now(); readinessClock(checkedAt);
  let calendar;
  try {
    io.readBytes(root, "data/runtime/options-release-calendar/retrievals.ndjson", 32 * 1024 * 1024);
    calendar = await withReleaseCalendarJournal(root, s => ({ state: "AVAILABLE", checkedAt, inputs: s.inputs, errorCode: null }), checkedAt);
  } catch (error) {
    const missing = error?.code === "ENOENT";
    const errorCode = missing ? "STORE_MISSING" : error?.code === "EEXIST" ? "STORE_BUSY" : /^OPTIONS_EXPORT_(?:UNSAFE_|PATH_ESCAPE|FILE_CHANGED)/.test(error?.message) ? "STORE_UNSAFE" : "RECOVERY_FAILED";
    calendar = { state: missing ? "MISSING" : "BLOCKED", checkedAt, inputs: null, errorCode };
  }
  return buildOptionsOperatorBrief(core, calendar, now());
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try { const args = process.argv.slice(2), result = await runOptionsBriefCommand(args, { workspaceRoot: resolve(import.meta.dirname, "..") });
    console.log(args.includes("--json") || args[0] === "--help" ? JSON.stringify(result, null, 2) : result.text.trimEnd());
    if (result.blockedStores?.length) process.exitCode = 3;
  } catch (error) {
    console.error(JSON.stringify({ status: "OPTIONS_BRIEF_ERROR", code: /^OPTIONS_(?:BRIEF|READINESS)_[A-Z_]+$/.test(error?.message) ? error.message : "OPTIONS_BRIEF_LOCAL_FAILURE", executionAllowed: false })); process.exitCode = 2;
  }
}
