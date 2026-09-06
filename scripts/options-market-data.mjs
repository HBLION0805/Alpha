import { lstatSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { buildOptionsMarketEvidenceReport, createOptionsMarketEvidence } from "../src/engines/options-market-evidence/OptionsMarketEvidenceEngine.ts";
import { withOptionsMarketEvidenceRepository } from "../src/repositories/LocalOptionsMarketEvidenceRepository.ts";

const catalog = {
  reviewedOn: "2026-09-06", instruments: ["GLD", "IBIT"], executionAllowed: false,
  selectedAdapter: "CBOE_DATASHOP_OPTION_QUOTES_LOCAL_CSV",
  reviewedBaselineDataAccess: "OWNER_HAS_ROBINHOOD_ONLY_NO_AUTHORIZED_API_OR_FILE_PROVIDED",
  sources: [
    { source: "Cboe DataShop Option Quotes", status: "LOCAL_FILE_ADAPTER_IMPLEMENTED_DATA_NOT_PROVIDED", url: "https://datashop.cboe.com/option-quote-intervals", notes: "Licensed interval NBBO files. Delivery, sampling, size timestamp and contract metadata limitations remain explicit. Format does not authenticate the publisher." },
    { source: "Cboe delayed dashboard", status: "AUTOMATED_EXTRACTION_PROHIBITED_NO_ADAPTER", url: "https://www.cboe.com/delayed_quotes/gld/quote_table", notes: "Do not scrape or download dashboard data automatically." },
    { source: "Nasdaq Smart Options", status: "CREDENTIALS_AND_DATA_RIGHTS_REQUIRED_NO_ADAPTER", url: "https://data.nasdaq.com/databases/NSO/documentation", notes: "Website display pages are not an authorized data API." },
    { source: "Alpaca options", status: "CREDENTIALS_AND_FEED_ENTITLEMENT_REQUIRED_NO_ADAPTER", url: "https://docs.alpaca.markets/us/docs/historical-option-data", notes: "Indicative quotes are modified derivatives, not actual OPRA quotes." },
    { source: "Tradier options", status: "ACCOUNT_TOKEN_AND_DATA_RIGHTS_REQUIRED_NO_ADAPTER", url: "https://docs.tradier.com/docs/market-data", notes: "Production and sandbox have different delay and analytics availability." },
  ],
};
const usage = "--catalog | --demo | --import <local CSV> --metadata <local JSON> | --report | --help";
function readUtf8File(path, maxBytes) {
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > maxBytes) throw new Error("MARKET_INVALID_OR_OVERSIZED_INPUT_FILE");
  // Fatal decoding prevents replacement characters from changing the hashed source silently.
  const bytes = readFileSync(path);
  if (bytes.byteLength > maxBytes) throw new Error("MARKET_INVALID_OR_OVERSIZED_INPUT_FILE");
  return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
}
function demo(now) {
  const header = "underlying_symbol,quote_datetime,root,expiration,strike,option_type,open,high,low,close,trade_volume,bid_size,bid,ask_size,ask,underlying_bid,underlying_ask,implied_volatility,delta";
  // Invented examples: these numbers were not downloaded or observed in a market.
  const csv = [header,
    "GLD,2026-09-04 10:00:00,GLD,2026-10-16,400,C,0,0,0,0,0,2,0.19,3,0.20,390.00,390.01,0,0.12",
    "GLD,2026-09-04 10:01:00,GLD,2026-10-16,400,C,0,0,0,0,0,2,0.21,3,0.23,390.10,390.11,0.24,0.14",
    "IBIT,2026-09-04 10:00:00,IBIT,2026-10-16,60,P,0,0,0,0,0,,0.18,,0.22,61.00,61.01,,",
    "GLD,2026-09-04 10:00:00,GLD1,2026-10-16,400,C,0,0,0,0,0,1,0.10,1,0.30,390.00,390.01,,",
  ].join("\n") + "\n";
  return buildOptionsMarketEvidenceReport([createOptionsMarketEvidence(csv, {
    datasetId: "synthetic-market-data-demo-v1", origin: "SYNTHETIC_FIXTURE", source: "CBOE_DATASHOP_OPTION_QUOTES",
    usageDeclaration: "SYNTHETIC_TEST_ONLY", intervalMinutes: 1, delivery: "INTRADAY_15_MIN_DELAYED",
  }, now())]);
}

/** No network, credentials, brokerage calls or option-fill simulation. */
export function runOptionsMarketDataCommand(args, { workspaceRoot = process.cwd(), now = () => new Date().toISOString() } = {}) {
  if (args.length === 1 && args[0] === "--help") return { command: "options:market-data", usage, executionAllowed: false };
  if (args.length === 1 && args[0] === "--catalog") return structuredClone(catalog);
  if (args.length === 1 && args[0] === "--demo") return demo(now);
  if (args.length === 1 && args[0] === "--report") return withOptionsMarketEvidenceRepository(workspaceRoot, (repository) => repository.readReport());
  if (args.length === 4 && args[0] === "--import" && args[2] === "--metadata" && !args[1].startsWith("--") && !args[3].startsWith("--")) {
    const csv = readUtf8File(resolve(workspaceRoot, args[1]), 4 * 1024 * 1024);
    const metadata = JSON.parse(readUtf8File(resolve(workspaceRoot, args[3]), 16 * 1024).replace(/^\uFEFF/, ""));
    const evidence = createOptionsMarketEvidence(csv, metadata, now());
    return withOptionsMarketEvidenceRepository(workspaceRoot, (repository) => repository.append(evidence));
  }
  throw new Error(`MARKET_UNSUPPORTED_COMMAND: ${usage}`);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try { console.log(JSON.stringify(runOptionsMarketDataCommand(process.argv.slice(2)), null, 2)); }
  catch (error) {
    console.error(JSON.stringify({ status: "BLOCKED", executionAllowed: false, error: error instanceof Error ? error.message : "MARKET_COMMAND_FAILED" }));
    process.exitCode = 2;
  }
}
