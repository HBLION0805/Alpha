import {
  PersonalMarketDataZeroCostCandidateDisposition,
  PersonalMarketDataZeroCostCandidateId,
} from "../../contracts/PersonalMarketDataZeroCostProviderScreening";
import {
  createPersonalMarketDataProviderQualificationClosure,
  createTwelveDataMulsNotFoundEvidence,
} from "../personal-market-data-provider-qualification-closure/PersonalMarketDataProviderQualificationClosureEngine";
import {
  PersonalMarketDataZeroCostProviderScreeningError,
  createPersonalMarketDataZeroCostProviderScreening,
} from "./PersonalMarketDataZeroCostProviderScreeningEngine";

type Test = { readonly name: string; readonly run: () => void };
const tests: Test[] = [];
const test = (name: string, run: () => void): void => {
  tests.push({ name, run });
};
const assert: (condition: boolean, message: string) => asserts condition =
(condition, message) => {
  if (!condition) throw new Error(message);
};
const equal = (actual: unknown, expected: unknown): void => {
  assert(Object.is(actual, expected),
    `Expected ${String(expected)}, received ${String(actual)}.`);
};
const deepEqual = (actual: unknown, expected: unknown): void => {
  equal(JSON.stringify(actual), JSON.stringify(expected));
};

test("binds the exact C11 closure and rejects authority changes", () => {
  const closure = c11Closure();
  for (const changed of [
    { ...closure, networkAuthorized: true },
    { ...closure, completeProviderSelection: "TRADIER_BROKERAGE" },
    undefined,
  ]) {
    let rejected = false;
    try {
      createPersonalMarketDataZeroCostProviderScreening(changed);
    } catch (error) {
      rejected = error instanceof PersonalMarketDataZeroCostProviderScreeningError;
    }
    equal(rejected, true);
  }
});

test("screens five zero-cost candidates against the exact requirement", () => {
  const result = subject();
  equal(result.candidates.length, 5);
  equal(result.requiredSymbolCount, 12);
  equal(result.requiredSymbolsIncludeMuls, true);
  assert(result.candidates.every((candidate) =>
    candidate.monthlyDataCostUsd === 0
    && candidate.exactTwelveSymbolCoverage === "UNVERIFIED"),
  "Candidate cost or coverage status changed.");
});

test("prioritizes Tradier only for architecture review", () => {
  const tradier = candidate(PersonalMarketDataZeroCostCandidateId.TradierBrokerage);
  equal(tradier.disposition,
    PersonalMarketDataZeroCostCandidateDisposition.ArchitectureReviewRequired);
  equal(tradier.brokerageAccountRequired, true);
  equal(tradier.credentialMayReachAccountOrTradingSurface, true);
  equal(tradier.currentTwoSidedQuote, "DOCUMENTED");
  equal(tradier.quoteSizes, "DOCUMENTED_WITH_UNIT");
  equal(tradier.requestBudget, "120_PER_MINUTE");
  equal(subject().prioritizedCandidate,
    PersonalMarketDataZeroCostCandidateId.TradierBrokerage);
});

test("does not claim native hourly Tradier bars", () => {
  equal(
    candidate(PersonalMarketDataZeroCostCandidateId.TradierBrokerage)
      .completedPt1hBars,
    "REQUIRES_REVIEWED_AGGREGATION",
  );
});

test("rejects Massive Basic because required Quotes are absent", () => {
  const massive = candidate(PersonalMarketDataZeroCostCandidateId.MassiveBasic);
  equal(massive.disposition,
    PersonalMarketDataZeroCostCandidateDisposition.RejectedForExactRequirement);
  equal(massive.currentTwoSidedQuote, "BLOCKED");
  equal(massive.requestBudget, "5_PER_MINUTE");
});

test("rejects Finnhub Free because bid ask and sizes are premium", () => {
  const finnhub = candidate(PersonalMarketDataZeroCostCandidateId.FinnhubFree);
  equal(finnhub.currentTwoSidedQuote, "BLOCKED");
  equal(finnhub.quoteSizes, "BLOCKED");
  equal(finnhub.requestBudget, "60_PER_MINUTE");
});

test("rejects Alpha Vantage Free for freshness and budget", () => {
  const alphaVantage =
    candidate(PersonalMarketDataZeroCostCandidateId.AlphaVantageFree);
  equal(alphaVantage.completedPt5mBars, "BLOCKED");
  equal(alphaVantage.currentTwoSidedQuote, "BLOCKED");
  equal(alphaVantage.requestBudget, "25_PER_DAY");
});

test("rejects FMP Basic because it is end of day only", () => {
  const fmp = candidate(PersonalMarketDataZeroCostCandidateId.FmpBasic);
  equal(fmp.completedP1dBars, "DOCUMENTED");
  equal(fmp.completedPt5mBars, "BLOCKED");
  equal(fmp.requestBudget, "250_PER_DAY");
});

test("selects no provider and grants no new authority", () => {
  const result = subject();
  equal(result.completeProviderSelection, "NO_COMPLETE_PROVIDER_SELECTED");
  equal(result.networkAuthorized, false);
  equal(result.credentialUseAuthorized, false);
  equal(result.brokerageAccountOpeningAuthorized, false);
  equal(result.subscriptionPurchaseAuthorized, false);
  equal(result.collectionAuthorized, false);
  equal(result.recommendationAuthority, false);
  equal(result.tradingAuthority, false);
  assert(result.candidates.every((entry) => entry.selected === false),
    "A candidate was selected.");
});

test("is deterministic, immutable, and points to design only", () => {
  const first = subject();
  const second = subject();
  deepEqual(first, second);
  equal(first.nextTask,
    "DESIGN_TRADIER_READ_ONLY_CREDENTIAL_AND_EXACT_SYMBOL_DIAGNOSTIC");
  equal(Object.isFrozen(first), true);
  equal(Object.isFrozen(first.authorities), true);
  equal(Object.isFrozen(first.candidates), true);
  equal(Object.isFrozen(first.candidates[0]?.blockers), true);
});

function c11Closure() {
  return createPersonalMarketDataProviderQualificationClosure(
    createTwelveDataMulsNotFoundEvidence(),
  );
}

function subject() {
  return createPersonalMarketDataZeroCostProviderScreening(c11Closure());
}

function candidate(candidateId: PersonalMarketDataZeroCostCandidateId) {
  const value = subject().candidates.find(
    (entry) => entry.candidateId === candidateId,
  );
  assert(value !== undefined, `Missing candidate ${candidateId}.`);
  return value;
}

let passed = 0;
for (const entry of tests) {
  try {
    entry.run();
    passed += 1;
    console.log(`PASS ${entry.name}`);
  } catch (error) {
    console.error(`FAIL ${entry.name}`);
    throw error;
  }
}
console.log(
  `Personal zero-cost provider screening tests: ${passed}/${tests.length} passed.`,
);
