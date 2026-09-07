import { resolve } from "node:path";
import { reportTreasuryHistory } from "../src/engines/options-treasury/TreasuryRealYieldEngine.ts";
import { retrieveTreasury, withTreasuryJournal } from "./lib/options-treasury-io.mjs";

const root = resolve(import.meta.dirname, "..");
try {
  const args = process.argv.slice(2);
  if (args.length > 1 || args.length === 1 && !["--refresh", "--report", "--help"].includes(args[0])) throw Error("TREASURY_ARGUMENTS");
  const mode = args[0] ?? "--report";
  if (mode === "--help") {
    console.log("Alpha GLD/IBIT Treasury context: --refresh, --report, --help.");
    console.log("--refresh performs one anonymous current-month Treasury GET and saves daily indicative real yields. --report reads local history.");
    console.log("Five tenors, exact source and retrieval clocks. No intraday quotes, forecasts, accounts or orders.");
  } else {
    const result = await withTreasuryJournal(root, async store => {
      const retrieval = mode === "--refresh" ? await retrieveTreasury() : null;
      const receipt = retrieval ? store.append(retrieval.input) : null;
      const report = reportTreasuryHistory([...store.inputs, ...(retrieval ? [retrieval.input] : [])], new Date().toISOString());
      return { mode, journalPath: store.path, receipt, report };
    });
    console.log(JSON.stringify(result, null, 2));
    if (mode === "--refresh" && result.report.latestRetrieval?.status === "FAILED") process.exitCode = 3;
  }
} catch (error) {
  const code = /^TREASURY_[A-Z_]+$/.test(error?.message) ? error.message : error?.code === "EEXIST" ? "TREASURY_WRITER_LOCKED" : "TREASURY_LOCAL_FAILURE";
  console.error(JSON.stringify({ status: "TREASURY_CONTEXT_ERROR", code, executionAllowed: false }));
  process.exitCode = 2;
}
