export const KALSHI_BTC_15M_MARKET_FIXTURE_OBSERVED_AT = "2026-07-24T00:45:06.092Z";
export const KALSHI_BTC_15M_MARKET_FIXTURE_RECEIVED_AT = "2026-07-24T13:40:00.000Z";
export const KALSHI_BTC_15M_MARKET_FIXTURE_NORMALIZED_AT = "2026-07-25T01:07:30.000Z";

export {
  kalshiBtcFifteenMinuteSeriesBody,
  robinhoodBtcFifteenMinuteEventBody,
} from "./KalshiEventContractReviewedEvidence";

export function kalshiBtcFifteenMinuteMarketBody(): string {
  return JSON.stringify({
    market: {
      can_close_early: true,
      close_time: "2026-07-24T00:45:00Z",
      created_time: "2026-07-23T00:01:06.45151Z",
      custom_strike: { round_digits: "2" },
      event_ticker: "KXBTC15M-26JUL232045",
      exchange_index: 0,
      expected_expiration_time: "2026-07-24T00:50:00Z",
      expiration_time: "2026-07-31T00:45:00Z",
      expiration_value: "64809.04",
      floor_strike: 64839.26,
      last_price_dollars: "0.0010",
      latest_expiration_time: "2026-07-31T00:45:00Z",
      liquidity_dollars: "0.0000",
      market_type: "binary",
      no_ask_dollars: "1.0000",
      no_bid_dollars: "0.0000",
      no_sub_title: "Target price: TBD",
      notional_value_dollars: "1.0000",
      occurrence_datetime: "2026-07-24T00:50:00Z",
      open_interest_fp: "657094.82",
      open_time: "2026-07-24T00:30:00Z",
      previous_price_dollars: "0.0000",
      previous_yes_ask_dollars: "0.0000",
      previous_yes_bid_dollars: "0.0000",
      price_level_structure: "tapered_deci_cent",
      price_ranges: [
        { end: "0.1000", start: "0.0000", step: "0.0010" },
        { end: "0.9000", start: "0.1000", step: "0.0100" },
        { end: "1.0000", start: "0.9000", step: "0.0010" },
      ],
      result: "no",
      rules_primary: "If the simple average of the sixty seconds of CF Benchmarks' BRTI before 8:45 PM EDT on Jul 23, 2026 is at least the simple average of the sixty seconds of CF Benchmarks' BRTI before 8:30 PM EDT on July 23, 2026, then the market resolves to Yes.",
      rules_secondary: "Not all cryptocurrency price data is the same. While checking a source like Google or Coinbase may help guide your decision, the price used to determine this market is based on CF Benchmarks' corresponding Real Time Index (RTI). At the last minute before expiration, 60 RTI prices are collected. The official and final value is the average of these prices, rounded to the nearest 2 decimal places.",
      settlement_timer_seconds: 1,
      settlement_ts: "2026-07-24T00:45:06.036714Z",
      settlement_value_dollars: "0.0000",
      status: "finalized",
      strike_type: "greater_or_equal",
      ticker: "KXBTC15M-26JUL232045-45",
      title: "BTC price up in next 15 mins?",
      updated_time: "2026-07-24T00:45:06.092723Z",
      volume_24h_fp: "2892084.61",
      volume_fp: "2892084.61",
      yes_ask_dollars: "1.0000",
      yes_ask_size_fp: "0.00",
      yes_bid_dollars: "0.0000",
      yes_bid_size_fp: "0.00",
      yes_sub_title: "Target Price: $64,839.26",
    },
  });
}
