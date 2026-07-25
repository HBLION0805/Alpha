/** Static, reviewed official evidence used to bind a live market response. */
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
