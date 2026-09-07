import { resolve } from "node:path";
import { reportFomcCalendar } from "../src/engines/options-fomc-calendar/FomcCalendarEngine.ts";
import { retrieveFomcCalendar, withFomcCalendarJournal } from "./lib/options-fomc-calendar-io.mjs";

const root = resolve(import.meta.dirname, "..");
try {
  const args = process.argv.slice(2);
  if (args.length > 1 || args.length === 1 && !["--refresh", "--report", "--help"].includes(args[0])) throw Error("FOMC_CALENDAR_ARGUMENTS");
  const mode = args[0] ?? "--report";
  if (mode === "--help") {
    console.log("Alpha GLD/IBIT FOMC meeting calendar: --refresh, --report, --help.");
    console.log("--refresh performs one anonymous Federal Reserve calendar GET and saves the observed schedule. --report reads local history.");
    console.log("Date-only meeting intervals and actual receipt clocks. Intraday release times and meeting confirmation remain unknown. No forecasts, accounts or orders.");
  } else {
    const result = await withFomcCalendarJournal(root, async store => {
      const retrieval = mode === "--refresh" ? await retrieveFomcCalendar() : null;
      const receipt = retrieval ? store.append(retrieval.input) : null;
      const report = reportFomcCalendar([...store.inputs, ...(retrieval ? [retrieval.input] : [])], new Date().toISOString());
      return { mode, journalPath: store.path, receipt, report };
    });
    console.log(JSON.stringify(result, null, 2));
    if (mode === "--refresh" && result.report.latestRetrieval?.status === "FAILED") process.exitCode = 3;
  }
} catch (error) {
  const code = /^FOMC_CALENDAR_[A-Z_]+$/.test(error?.message) ? error.message : error?.code === "EEXIST" ? "FOMC_CALENDAR_WRITER_LOCKED" : "FOMC_CALENDAR_LOCAL_FAILURE";
  console.error(JSON.stringify({ status: "FOMC_CALENDAR_CONTEXT_ERROR", code, executionAllowed: false }));
  process.exitCode = 2;
}
