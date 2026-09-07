import { resolve } from "node:path";
import { reportBtcContext } from "../src/engines/options-btc-context/BtcSpotContextEngine.ts";
import { retrieveBtcContext, withBtcContextJournal } from "./lib/options-btc-context-io.mjs";

const root = resolve(import.meta.dirname, "..");
try {
  const args = process.argv.slice(2);
  if (args.length > 1 || args.length === 1 && !["--refresh", "--report", "--help"].includes(args[0])) throw Error("BTC_CONTEXT_ARGUMENTS");
  const mode = args[0] ?? "--report";
  if (mode === "--help") {
    console.log("Alpha IBIT public BTC context: --refresh, --report, --help.");
    console.log("--refresh performs one anonymous Coinbase Exchange BTC-USD level 1 GET and saves its actual observation. --report reads local history.");
    console.log("Single venue, separate source and receipt clocks. No IBIT conversion, continuous coverage, forecasts, accounts or orders.");
  } else {
    const result = await withBtcContextJournal(root, async store => {
      const retrieval = mode === "--refresh" ? await retrieveBtcContext() : null;
      const receipt = retrieval ? store.append(retrieval.input) : null;
      const report = reportBtcContext([...store.inputs, ...(retrieval ? [retrieval.input] : [])], new Date().toISOString());
      return { mode, journalPath: store.path, receipt, report };
    });
    console.log(JSON.stringify(result, null, 2));
    if (mode === "--refresh" && result.report.latestRetrieval?.status === "FAILED") process.exitCode = 3;
  }
} catch (error) {
  const code = /^BTC_CONTEXT_[A-Z_]+$/.test(error?.message) ? error.message : error?.code === "EEXIST" ? "BTC_CONTEXT_WRITER_LOCKED" : "BTC_CONTEXT_LOCAL_FAILURE";
  console.error(JSON.stringify({ status: "BTC_CONTEXT_ERROR", code, executionAllowed: false }));
  process.exitCode = 2;
}
