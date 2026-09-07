import { resolve } from "node:path";
import { reportReleaseCalendar } from "../src/engines/options-release-calendar/BlsReleaseCalendarEngine.ts";
import { retrieveReleaseCalendar, withReleaseCalendarJournal } from "./lib/options-release-calendar-io.mjs";

const root = resolve(import.meta.dirname, "..");
try {
  const args = process.argv.slice(2);
  if (args.length > 1 || args.length === 1 && !["--refresh", "--report", "--help"].includes(args[0])) throw Error("RELEASE_CALENDAR_ARGUMENTS");
  const mode = args[0] ?? "--report";
  if (mode === "--help") {
    console.log("Alpha GLD/IBIT BLS release calendar: --refresh, --report, --help.");
    console.log("--refresh performs one anonymous BLS calendar GET and saves the observed schedule. --report reads local history.");
    console.log("Scheduled releases only, with Eastern/UTC and actual receipt clocks. No released values, complete event coverage, forecasts, accounts or orders.");
  } else {
    const result = await withReleaseCalendarJournal(root, async store => {
      const retrieval = mode === "--refresh" ? await retrieveReleaseCalendar() : null;
      const receipt = retrieval ? store.append(retrieval.input) : null;
      const report = reportReleaseCalendar([...store.inputs, ...(retrieval ? [retrieval.input] : [])], new Date().toISOString());
      return { mode, journalPath: store.path, receipt, report };
    });
    console.log(JSON.stringify(result, null, 2));
    if (mode === "--refresh" && result.report.latestRetrieval?.status === "FAILED") process.exitCode = 3;
  }
} catch (error) {
  const code = /^RELEASE_CALENDAR_[A-Z_]+$/.test(error?.message) ? error.message : error?.code === "EEXIST" ? "RELEASE_CALENDAR_WRITER_LOCKED" : "RELEASE_CALENDAR_LOCAL_FAILURE";
  console.error(JSON.stringify({ status: "RELEASE_CALENDAR_CONTEXT_ERROR", code, executionAllowed: false }));
  process.exitCode = 2;
}
