import { closeSync, fstatSync, lstatSync, openSync, readSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { estimateRobinhoodOptionFees } from "../src/engines/options-broker-reference/OptionsBrokerFeeEngine.ts";

const reference = {
  schemaVersion: "1.0", reviewedOn: "2026-09-06", feeResearchDate: "2026-09-04", symbols: ["GLD", "IBIT"],
  classification: "DATED_PUBLIC_REFERENCE_NOT_ACCOUNT_OR_EXECUTION_VERIFICATION",
  sources: [
    { topic: "US fee schedule, footer version 20260831", url: "https://cdn.robinhood.com/assets/robinhood/legal/RHF%20Fee%20Schedule.pdf" },
    { topic: "Broker day trading transition", url: "https://robinhood.com/us/en/support/articles/pattern-day-trading/" },
    { topic: "Stop market option orders", url: "https://robinhood.com/us/en/support/articles/stop-market-order-options/" },
    { topic: "Stop limit option orders", url: "https://robinhood.com/us/en/support/articles/stop-limit-order-options/" },
    { topic: "Account differences", url: "https://robinhood.com/us/en/support/articles/robinhood-accounts/" },
    { topic: "T+1 settlement", url: "https://robinhood.com/us/en/support/articles/T1-settlements/" },
    { topic: "Broker holiday calendar", url: "https://robinhood.com/us/en/support/articles/stock-market-holidays/" },
    { topic: "Standard ETF contract terms and exceptions", url: "https://www.theocc.com/clearance-and-settlement/clearing/etf-options" },
    { topic: "IBIT late close effective 2025-11-10", url: "https://www.nasdaqtrader.com/MicroNews.aspx?id=2025-52" },
    { topic: "Scheduled option product hours", url: "https://www.nasdaqtrader.com/Trader.aspx?id=optionshours" },
    { topic: "Dated GLD/IBIT penny quote reference", url: "https://cdn.cboe.com/resources/us/options/market-statistics/penny-tick-type/bzx/bzx_options_rpt_penny_tick_type_20260904.csv" },
    { topic: "Official Trading MCP capabilities", url: "https://robinhood.com/us/en/support/articles/trading-with-your-agent/" },
    { topic: "Trading MCP connection and account scope", url: "https://robinhood.com/us/en/support/articles/agentic-trading-overview/" },
  ],
  researchSession: { date: "2026-09-04", scheduledOpen: "2026-09-04T13:30:00.000Z", scheduledClose: "2026-09-04T20:15:00.000Z",
    meaning: "Scheduled regular GLD/IBIT option hours; actual series exceptions, halts and Robinhood eligibility are not verified." },
  settlementExample: { tradeDate: "2026-09-04", scheduledSettlementDate: "2026-09-08",
    meaning: "Derived T+1 with Labor Day excluded; no account cash is credited by this reference." },
  findings: [
    "Standard ETF contracts generally deliver 100 shares and permit American exercise; a symbol or root alone does not prove a particular contract is unadjusted.",
    "The dated penny reference lists GLD and IBIT as Pennies to 3.00: quote increments are one cent below $3 and five cents at or above $3. Execution increments can differ.",
    "Robinhood reports replacing its PDT restrictions on June 4, 2026. The old $25,000 rule must not be presumed current for this broker.",
    "Account type, Level 2 approval and actual settled funds remain unknown. A $2,000 borrowing requirement is not a blanket ban on fully cash-funded trades.",
    "Public stop-limit examples use an ask/trade trigger, which differs from the research model's bid liquidation trigger. Stop-market trigger-feed details and native OCO/bracket support are not verified.",
    "Current stop-market rules specify sell-to-close and new orders from 09:45 ET. The market-order page has a conflicting 09:35 label; historical UI rollout and series-specific broker hours remain unverified.",
    "Public fee estimates do not replace actual confirmations. The existing research engine uses frozen fee assumptions; this command never changes them or proves a fill.",
  ],
  accountType: "UNKNOWN", optionsApproval: "UNKNOWN", settledCash: "UNKNOWN", brokerAccountVerified: false,
  robinhoodDataAlternative: { status: "OFFICIAL_TRADING_MCP_DOCUMENTED_NOT_CONNECTED", historicals: "OPTION_OHLC_BARS_DOCUMENTED_HISTORICAL_BID_ASK_AND_SIZES_UNVERIFIED", currentQuotes: "DOCUMENTED_SCHEMA_AND_ENTITLEMENT_UNVERIFIED", authorization: "NEW_AUTHENTICATED_CONNECTION_REQUIRED_NOT_GRANTED", accountReadScope: "OFFICIAL_DOCUMENTATION_DESCRIBES_ALL_ROBINHOOD_ACCOUNTS", ordersAllowedByThisSystem: false },
  executionAllowed: false, marketValidated: false, winProbability: null,
};
export function runOptionsBrokerReferenceCommand(args, { workspaceRoot = process.cwd() } = {}) {
  if (args.length === 1 && args[0] === "--help") return { command: "options:broker-reference", usage: "--reference | --fees <local JSON> | --help", executionAllowed: false };
  if (args.length === 1 && args[0] === "--reference") return structuredClone(reference);
  if (args.length === 2 && args[0] === "--fees" && !args[1].startsWith("--")) {
    const path = resolve(workspaceRoot, args[1]), stat = lstatSync(path);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 16 * 1024) throw new Error("BROKER_REFERENCE_INVALID_OR_OVERSIZED_FILE");
    const same = (value) => value.isFile() && !value.isSymbolicLink() && value.dev === stat.dev && value.ino === stat.ino
      && value.size === stat.size && value.mtimeMs === stat.mtimeMs && value.ctimeMs === stat.ctimeMs;
    const fd = openSync(path, "r");
    try {
      if (!same(fstatSync(fd)) || !same(lstatSync(path))) throw new Error("BROKER_REFERENCE_INPUT_CHANGED");
      const bytes = Buffer.alloc(16 * 1024 + 1);
      let length = 0;
      while (length < bytes.length) {
        const count = readSync(fd, bytes, length, bytes.length - length, null);
        if (count === 0) break;
        length += count;
      }
      if (length > 16 * 1024) throw new Error("BROKER_REFERENCE_INVALID_OR_OVERSIZED_FILE");
      if (length !== stat.size || !same(fstatSync(fd)) || !same(lstatSync(path))) throw new Error("BROKER_REFERENCE_INPUT_CHANGED");
      return estimateRobinhoodOptionFees(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, length))));
    } finally { closeSync(fd); }
  }
  throw new Error("BROKER_REFERENCE_UNSUPPORTED_COMMAND");
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try { console.log(JSON.stringify(runOptionsBrokerReferenceCommand(process.argv.slice(2)), null, 2)); }
  catch (error) { console.error(JSON.stringify({ status: "BLOCKED", executionAllowed: false, error: error instanceof Error ? error.message : "BROKER_REFERENCE_COMMAND_FAILED" })); process.exitCode = 2; }
}
