/** Source-format evidence only: none of these fields grants execution authority. */
export interface OptionsMarketImportMetadata {
  readonly datasetId: string;
  readonly origin: "SYNTHETIC_FIXTURE" | "OWNER_PROVIDED_FILE";
  readonly source: "CBOE_DATASHOP_OPTION_QUOTES";
  readonly usageDeclaration: "SYNTHETIC_TEST_ONLY" | "OWNER_ATTESTED_LOCAL_USE" | "UNKNOWN";
  readonly intervalMinutes: number;
  readonly delivery: "HISTORICAL_FILE" | "INTRADAY_15_MIN_DELAYED";
}

/** Missing prices/sizes are unknown, and source-model IV zero is unavailable. */
export interface CboeOptionQuoteRow {
  readonly underlyingSymbol: "GLD" | "IBIT";
  readonly root: string;
  readonly optionType: "CALL" | "PUT";
  readonly expirationDate: string;
  readonly strikeCents: number;
  readonly contractKey: string;
  readonly quoteDatetimeEt: string;
  readonly snapshotAt: string;
  readonly bidCents: number | null;
  readonly askCents: number | null;
  readonly bidSizeContracts: number | null;
  readonly askSizeContracts: number | null;
  readonly underlyingBidCents: number | null;
  readonly underlyingAskCents: number | null;
  readonly impliedVolatility: string | null;
  readonly delta: string | null;
  readonly gamma: string | null;
  readonly theta: string | null;
  readonly vega: string | null;
  readonly rho: string | null;
  readonly openInterest: number | null;
}
