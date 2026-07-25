export const KALSHI_BTC_15M_MARKET_FIXTURE_OBSERVED_AT = "2026-07-24T00:45:06.092Z";
export const KALSHI_BTC_15M_MARKET_FIXTURE_RECEIVED_AT = "2026-07-24T13:40:00.000Z";
export const KALSHI_BTC_15M_MARKET_FIXTURE_NORMALIZED_AT = "2026-07-25T01:07:30.000Z";

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

export function kalshiBtcFifteenMinuteSeriesBody(): string {
  return JSON.stringify({
    series: {
      additional_prohibitions: [
        "Persons who are employed by any of the Source Agencies are not permitted to trade on the Contract.",
        "Persons who hold any material, non-public information on the Underlying are not permitted to trade on the Contract.",
      ],
      category: "Crypto",
      contract_terms_url: "https://assets.kalshi.com/contract_terms/CRYPTO15M.pdf",
      contract_url: "https://assets.kalshi.com/regulatory/product-certifications/CRYPTO15M.pdf",
      fee_multiplier: 1,
      fee_type: "quadratic",
      frequency: "fifteen_min",
      last_updated_ts: "2026-07-01T18:05:04.527379Z",
      product_metadata: {
        important_info: {
          id: "CRYPTO15M-bulk-2026-04-20",
          markdown: "**Important information:** The price used to determine this market is based on CF Benchmarks' corresponding Real Time Index (RTI). At the last minute before expiration, 60 RTI prices are collected. The official and final value is the average of these prices.",
          message: "",
          title: "",
        },
      },
      settlement_sources: [{ name: "CF Benchmarks", url: "https://www.cfbenchmarks.com/" }],
      tags: ["BTC", "15 min"],
      ticker: "KXBTC15M",
      title: "Bitcoin price up down",
    },
  });
}

export function robinhoodBtcFifteenMinuteEventBody(): string {
  return JSON.stringify({
    event: {
      analytics_event_contract_id: "7e129ce2-a081-4cbc-b1b9-c6808ca3ea38",
      contract_label: "$64,839.26 or above",
      contract_question: "Will the price of Bitcoin be at or above the $64,839.26 target price in the 15-minute window?",
      deep_link_contract_id: "882673e4-25e6-45b3-8d6a-4ff87ff21708",
      display_title: "BTC 15 min · 8:30–8:45 PM EDT",
      page_slug: "btc-15-min-64-83926-target-jul-23-2026",
      page_title: "July 23, 2026: BTC 15 min · 8:30–8:45 PM EDT Prediction Market",
      page_url: "https://robinhood.com/us/en/prediction-markets/crypto/events/btc-15-min-64-83926-target-jul-23-2026/",
      retrieved_at: "2026-07-25T01:04:45.000Z",
      rules_primary: "If the simple average of the sixty seconds of CF Benchmarks' BRTI before 8:45 PM EDT on Jul 23, 2026 is at least the simple average of the sixty seconds of CF Benchmarks' BRTI before 8:30 PM EDT on July 23, 2026, then the market resolves to Yes.",
      rules_secondary: "Not all cryptocurrency price data is the same. While checking a source like Google or Coinbase may help guide your decision, the price used to determine this market is based on CF Benchmarks' corresponding Real Time Index (RTI). At the last minute before expiration, 60 RTI prices are collected. The official and final value is the average of these prices, rounded to the nearest 2 decimal places.",
      terms_provider_host: "assets.kalshi.com",
      terms_sha256: "418c225a3c45c7ddef028f12a4755652c456658f54ec27c5d365d5489ce5e874",
      terms_url: "https://assets.kalshi.com/contract_terms/CRYPTO15M.pdf",
    },
  });
}
