/** Local research identity only; a valid contract is not a broker listing confirmation. */
export interface OptionContract {
  readonly contractId: string;
  readonly symbol: "GLD" | "IBIT";
  readonly optionType: "CALL" | "PUT";
  readonly strikePriceCents: number;
  readonly expiryDate: string;
  readonly multiplier: 100;
  readonly minimumPriceTickCents: number;
  readonly deliverable: "STANDARD_100_SHARES_USD";
  readonly exerciseStyle: "AMERICAN";
}

/** Prices are integer USD cents per share; sizes are whole option contracts. */
export interface OptionQuote {
  readonly quoteId: string;
  readonly contractId: string;
  /** Canonical UTC timestamp with milliseconds. */
  readonly observedAt: string;
  readonly receivedAt: string;
  readonly bidPerShareCents: number;
  readonly askPerShareCents: number;
  readonly bidSizeContracts: number;
  readonly askSizeContracts: number;
  readonly underlyingPriceCents: number;
  /** synthetic: or import: namespace; neither is a verified/live source. */
  readonly sourceId: string;
  readonly origin: "SYNTHETIC_FIXTURE" | "UNVERIFIED_IMPORT";
  readonly session: "REGULAR" | "CLOSED";
  readonly ivBps: number | null;
  readonly deltaBps: number | null;
}

/** Eligibility is for local simulation only, never executable-liquidity evidence. */
export interface OptionQuoteQualification {
  readonly eligible: boolean;
  readonly reasons: readonly string[];
}
