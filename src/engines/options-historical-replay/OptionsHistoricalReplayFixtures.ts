import type { OptionsHistoricalReplayCase, OptionsHistoricalReplayConfig } from "../../contracts/OptionsHistoricalReplay";
import { createOptionsMarketEvidence } from "../options-market-evidence/OptionsMarketEvidenceEngine";

const HEADERS = ["underlying_symbol", "quote_datetime", "root", "expiration", "strike", "option_type", "open", "high", "low", "close", "trade_volume", "bid_size", "bid", "ask_size", "ask", "underlying_bid", "underlying_ask", "implied_volatility", "delta"];
const BASE_ROW: Readonly<Record<string, string>> = { underlying_symbol: "GLD", root: "GLD", quote_datetime: "2026-09-04 10:00:00", expiration: "2026-09-25", strike: "480", option_type: "C",
  open: "0.20", high: "0.40", low: "0.01", close: "0.20", trade_volume: "3", bid_size: "2", bid: "0.19", ask_size: "2", ask: "0.20",
  underlying_bid: "470", underlying_ask: "470.01", implied_volatility: "0.3", delta: "0.2" };

/** Test-only builders retain their synthetic label; they never synthesize an actual market source. */
export function historicalReplayFixture(
  runId = "historical-target",
  rowChanges: readonly Record<string, string>[] = [{}, { quote_datetime: "2026-09-04 10:01:00" },
    { quote_datetime: "2026-09-04 10:02:00", bid: "0.30", ask: "0.31" }, { quote_datetime: "2026-09-04 10:03:00", bid: "0.31", ask: "0.32" }],
): OptionsHistoricalReplayCase {
  const csv = [HEADERS.join(","), ...rowChanges.map((changes) => {
    const row = { ...BASE_ROW, ...changes };
    return HEADERS.map((header) => row[header] ?? "").join(",");
  })].join("\n") + "\n";
  const evidence = createOptionsMarketEvidence(csv, { datasetId: `dataset:${runId}`, origin: "SYNTHETIC_FIXTURE", source: "CBOE_DATASHOP_OPTION_QUOTES",
    usageDeclaration: "SYNTHETIC_TEST_ONLY", intervalMinutes: 1, delivery: "HISTORICAL_FILE" }, "2026-09-05T22:00:00.000Z");
  const config: OptionsHistoricalReplayConfig = {
    schemaVersion: "1.0", runId, datasetId: evidence.metadata.datasetId, contractKey: "GLD:2026-09-25:CALL:48000",
    plan: { strategyVersion: "sampled-research-v1", setupKey: "synthetic-process-case", decisionAt: "2026-09-04T14:00:00.000Z",
      entryDeadlineAt: "2026-09-04T14:02:00.000Z", timeExitAt: "2026-09-04T14:05:00.000Z", entryLimitPerShareCents: 20, quantity: 1,
      stopLossBps: 2000, rewardMultipleMilliR: 2000, maxEntrySpreadPerShareCents: 2,
      thesis: { direction: "BULLISH", magnitude: "Illustrative process-test move only", horizon: "Intraday research case", volatility: "Synthetic model input, not a forecast",
        path: "Scripted sampled snapshots", invalidation: "The frozen all-in cash risk or time exit triggers a later modeled exit", monthlyContext: "Unverified narrative placeholder",
        dailySetup: "No validated trading signal", intradayTrigger: "Retrospective synthetic declaration" } },
    assumptions: {
      contractTerms: { multiplier: 100, deliverable: "STANDARD_100_SHARES_USD", exerciseStyle: "AMERICAN", minimumPriceTickCents: 1, reference: "Synthetic standard-contract assumption for process tests only" },
      session: { sessionDate: "2026-09-04", marketOpen: "2026-09-04T13:30:00.000Z", marketClose: "2026-09-04T20:00:00.000Z", reference: "Synthetic regular-session assumption; not an independently verified calendar" },
      costs: { entryFeeCents: 10, exitFeeCents: 10, exitSlippagePerShareCents: 0, reference: "Synthetic fee and zero-slippage assumptions, not current broker pricing" },
      liquidityModel: "ASSUME_RECORDED_SIZE_AVAILABLE", acknowledgeCounterfactual: true,
    },
  };
  return { config, evidence, recordedAt: "2026-09-05T22:00:01.000Z" };
}

export function fixtureHistoricalReplayCases(): readonly OptionsHistoricalReplayCase[] {
  const target = historicalReplayFixture();
  const stopGap = historicalReplayFixture("historical-stop-gap", [{}, { quote_datetime: "2026-09-04 10:01:00" },
    { quote_datetime: "2026-09-04 10:02:00", bid: "0.16", ask: "0.17" }, { quote_datetime: "2026-09-04 10:04:00", bid: "0.10", ask: "0.11" }]);
  const reversal = historicalReplayFixture("historical-target-reversal", [{}, { quote_datetime: "2026-09-04 10:01:00" },
    { quote_datetime: "2026-09-04 10:02:00", bid: "0.30", ask: "0.31" }, { quote_datetime: "2026-09-04 10:03:00", bid: "0.15", ask: "0.16" }]);
  const pending = historicalReplayFixture("historical-time-pending", [{}, { quote_datetime: "2026-09-04 10:01:00" },
    { quote_datetime: "2026-09-04 10:05:00", bid: "", ask: "", bid_size: "", ask_size: "" },
    { quote_datetime: "2026-09-04 10:06:00", bid: "", ask: "", bid_size: "", ask_size: "" }]);
  const expensiveBase = historicalReplayFixture("historical-expensive", [{ bid: "0.49", ask: "0.50" }, { quote_datetime: "2026-09-04 10:01:00", bid: "0.49", ask: "0.50" }]);
  const expensive = { ...expensiveBase, config: { ...expensiveBase.config, plan: { ...expensiveBase.config.plan, entryLimitPerShareCents: 50 } } };
  const missingBase = historicalReplayFixture("historical-missing-data");
  const missing = { ...missingBase, evidence: null };
  const ibitBase = historicalReplayFixture("historical-ibit-put-time-exit", [
    { underlying_symbol: "IBIT", root: "IBIT", strike: "60", option_type: "P", delta: "-0.2", underlying_bid: "61", underlying_ask: "61.01" },
    { underlying_symbol: "IBIT", root: "IBIT", strike: "60", option_type: "P", delta: "-0.2", underlying_bid: "61", underlying_ask: "61.01", quote_datetime: "2026-09-04 10:01:00" },
    { underlying_symbol: "IBIT", root: "IBIT", strike: "60", option_type: "P", delta: "-0.2", underlying_bid: "61", underlying_ask: "61.01", quote_datetime: "2026-09-04 10:05:00" },
    { underlying_symbol: "IBIT", root: "IBIT", strike: "60", option_type: "P", delta: "-0.2", underlying_bid: "61", underlying_ask: "61.01", quote_datetime: "2026-09-04 10:06:00", bid: "0.21", ask: "0.22" },
  ]);
  const ibit = { ...ibitBase, config: { ...ibitBase.config, contractKey: "IBIT:2026-09-25:PUT:6000", plan: { ...ibitBase.config.plan,
    thesis: { ...ibitBase.config.plan.thesis, direction: "BEARISH" as const } } } };
  return [target, stopGap, reversal, pending, expensive, missing, ibit];
}
