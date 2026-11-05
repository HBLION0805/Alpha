/** Free macro & market series. FRED keyless CSV (fredgraph.csv) + Yahoo via adapters/yahoo.ts (yahoo-finance2), incl. BTC-USD. */
export type Provider = "fred" | "yahoo";

export interface SeriesDef {
  id: string; // our id
  provider: Provider;
  ref: string; // provider symbol
  label: string;
  unit: "pct" | "price" | "index" | "bp_pct"; // pct: value is a percent level (yields); price/index: use % changes
  frequency: "daily" | "weekly";
}

export const SERIES: SeriesDef[] = [
  { id: "UST2Y", provider: "fred", ref: "DGS2", label: "2Y Treasury yield", unit: "pct", frequency: "daily" },
  { id: "UST10Y", provider: "fred", ref: "DGS10", label: "10Y Treasury yield", unit: "pct", frequency: "daily" },
  { id: "REAL10Y", provider: "fred", ref: "DFII10", label: "10Y real yield (TIPS)", unit: "pct", frequency: "daily" },
  { id: "BE5Y", provider: "fred", ref: "T5YIE", label: "5Y breakeven inflation", unit: "pct", frequency: "daily" },
  { id: "BE10Y", provider: "fred", ref: "T10YIE", label: "10Y breakeven inflation", unit: "pct", frequency: "daily" },
  { id: "FEDFUNDS", provider: "fred", ref: "DFF", label: "Effective Fed funds", unit: "pct", frequency: "daily" },
  { id: "HYOAS", provider: "fred", ref: "BAMLH0A0HYM2", label: "US high-yield OAS", unit: "pct", frequency: "daily" },
  { id: "NFCI", provider: "fred", ref: "NFCI", label: "Chicago Fed NFCI", unit: "index", frequency: "weekly" },
  { id: "USD_BROAD", provider: "fred", ref: "DTWEXBGS", label: "Broad trade-weighted USD", unit: "index", frequency: "daily" },
  { id: "VIX_FRED", provider: "fred", ref: "VIXCLS", label: "VIX close (FRED)", unit: "index", frequency: "daily" },
  // market prices (more timely; FRED lags 1 business day)
  { id: "SPY", provider: "yahoo", ref: "SPY", label: "SPY", unit: "price", frequency: "daily" },
  { id: "GLD", provider: "yahoo", ref: "GLD", label: "GLD", unit: "price", frequency: "daily" },
  { id: "GOLD", provider: "yahoo", ref: "GC=F", label: "Gold futures", unit: "price", frequency: "daily" },
  { id: "VIX", provider: "yahoo", ref: "^VIX", label: "VIX", unit: "index", frequency: "daily" },
  { id: "DXY", provider: "yahoo", ref: "DX-Y.NYB", label: "DXY", unit: "index", frequency: "daily" },
  { id: "UST10Y_MKT", provider: "yahoo", ref: "^TNX", label: "10Y yield (CBOE TNX)", unit: "pct", frequency: "daily" },
  { id: "ZT", provider: "yahoo", ref: "ZT=F", label: "2Y T-note futures (price, inverse of yield)", unit: "price", frequency: "daily" },
  { id: "BTC", provider: "yahoo", ref: "BTC-USD", label: "Bitcoin (Yahoo BTC-USD, UTC days)", unit: "price", frequency: "daily" },
];

/** Intraday series used for news-reaction confirmation. */
export const INTRADAY = ["SPY", "GOLD", "DXY", "ZT", "BTC", "UST10Y_MKT"] as const;
