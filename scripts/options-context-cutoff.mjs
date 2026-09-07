import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { reconstructOptionsContext, CONTEXT_CUTOFF_SOURCES } from "../src/engines/options-readiness/OptionsContextCutoff.ts";
import { reconstructOptionsContextV2, CONTEXT_CUTOFF_SOURCES_V2 } from "../src/engines/options-readiness/OptionsContextCutoffV2.ts";
import { readinessClock } from "../src/engines/options-readiness/OptionsReadinessEngine.ts";
import { optionsEvidenceExportStorage as io } from "./options-evidence-export.mjs";
import { withDriverJournal } from "./lib/options-driver-io.mjs";
import { withTreasuryJournal } from "./lib/options-treasury-io.mjs";
import { withBtcContextJournal } from "./lib/options-btc-context-io.mjs";
import { withReleaseCalendarJournal } from "./lib/options-release-calendar-io.mjs";
import { withFomcCalendarJournal } from "./lib/options-fomc-calendar-io.mjs";

export async function runOptionsContextCutoffCommand(args, { workspaceRoot = process.cwd(), now = () => new Date().toISOString() } = {}) {
  if (args.length === 1 && args[0] === "--help") return { usage: "options:context-cutoff -- --at <canonical-UTC-time> | --at-v2 <canonical-UTC-time>", meaning: "Reconstruct context from local journal receipt/discovery times. V1 has four components; opt-in v2 adds FOMC date calendars. No network, source writes, trade replay or claim that a historical decision used this data.", executionAllowed: false };
  if (args.length !== 2 || !["--at", "--at-v2"].includes(args[0])) throw Error("CONTEXT_CUTOFF_ARGUMENTS");
  const v2 = args[0] === "--at-v2";
  const cutoff = args[1], startedAt = now(); readinessClock(cutoff); readinessClock(startedAt);
  if (cutoff > startedAt) throw Error("CONTEXT_CUTOFF_FUTURE_CUTOFF");
  const root = realpathSync(workspaceRoot), histories = {};
  const sources = {
    headlines: { file: "options-driver-monitor/refreshes.ndjson", maximum: 16 * 1024 * 1024, read: () => withDriverJournal(root, s => ({ observations: s.observations, health: s.health })) },
    treasury: { file: "options-treasury-rates/retrievals.ndjson", maximum: 32 * 1024 * 1024, read: at => withTreasuryJournal(root, s => s.inputs, at) },
    btc: { file: "options-btc-context/retrievals.ndjson", maximum: 16 * 1024 * 1024, read: at => withBtcContextJournal(root, s => s.inputs, at) },
    blsCalendar: { file: "options-release-calendar/retrievals.ndjson", maximum: 32 * 1024 * 1024, read: at => withReleaseCalendarJournal(root, s => s.inputs, at) },
    fomcCalendar: { file: "options-fomc-calendar/retrievals.ndjson", maximum: 32 * 1024 * 1024, read: at => withFomcCalendarJournal(root, s => s.inputs, at) },
  };
  for (const id of v2 ? CONTEXT_CUTOFF_SOURCES_V2 : CONTEXT_CUTOFF_SOURCES) {
    const checkedAt = now(); readinessClock(checkedAt); const source = sources[id];
    if (checkedAt < startedAt) throw Error("CONTEXT_CUTOFF_CHECK_CLOCK_ORDER");
    try {
      const before = io.readBytes(root, "data/runtime/" + source.file, source.maximum);
      const payload = await source.read(checkedAt);
      const after = io.readBytes(root, "data/runtime/" + source.file, source.maximum);
      if (!before.equals(after)) throw Error("OPTIONS_EXPORT_FILE_CHANGED");
      histories[id] = { state: "AVAILABLE", checkedAt, payload, errorCode: null };
    } catch (error) {
      const missing = error?.code === "ENOENT";
      const errorCode = missing ? "STORE_MISSING" : error?.code === "EEXIST" ? "STORE_BUSY" : /^OPTIONS_EXPORT_(?:UNSAFE_|PATH_ESCAPE|FILE_CHANGED)/.test(error?.message) ? "STORE_UNSAFE" : "RECOVERY_FAILED";
      histories[id] = { state: missing ? "MISSING" : "BLOCKED", checkedAt, payload: null, errorCode };
    }
  }
  return (v2 ? reconstructOptionsContextV2 : reconstructOptionsContext)(histories, cutoff, now());
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try { const report = await runOptionsContextCutoffCommand(process.argv.slice(2), { workspaceRoot: resolve(import.meta.dirname, "..") }); console.log(JSON.stringify(report, null, 2)); if (report.blockedStores?.length) process.exitCode = 3; }
  catch (error) { console.error(JSON.stringify({ status: "CONTEXT_CUTOFF_ERROR", code: /^(?:CONTEXT_CUTOFF_[A-Z_]+|OPTIONS_READINESS_CLOCK)$/.test(error?.message) ? error.message : "CONTEXT_CUTOFF_LOCAL_FAILURE", executionAllowed: false })); process.exitCode = 2; }
}
