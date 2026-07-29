import {
  PersonalMarketDataProviderLaneDisposition,
  PersonalMarketDataProviderLaneId,
} from "../../contracts/PersonalMarketDataProviderQualificationClosure";
import {
  PersonalMarketDataProviderQualificationClosureError,
  createPersonalMarketDataProviderQualificationClosure,
  createTwelveDataMulsNotFoundEvidence,
} from "./PersonalMarketDataProviderQualificationClosureEngine";

type Test = { readonly name: string; readonly run: () => void };
const tests: Test[] = [];
const test = (name: string, run: () => void): void => {
  tests.push({ name, run });
};
const assert: (condition: boolean, message: string) => asserts condition =
(condition, message) => {
  if (!condition) throw new Error(message);
};
const equal = (actual: unknown, expected: unknown, field = "value"): void => {
  assert(Object.is(actual, expected),
    `${field}: expected ${String(expected)}, received ${String(actual)}.`);
};
const deepEqual = (actual: unknown, expected: unknown): void => {
  equal(JSON.stringify(actual), JSON.stringify(expected));
};

test("records the exact bounded Twelve Data failure without raw narrative", () => {
  const evidence = createTwelveDataMulsNotFoundEvidence();
  equal(evidence.requestFingerprint,
    "twelve-data-muls-reference:d531fea31082c867");
  equal(evidence.httpStatus, 400);
  equal(evidence.classification, "SYMBOL_NOT_FOUND");
  equal(evidence.attemptedNetworkRequests, 1);
  equal(evidence.completedNetworkRequests, 1);
  equal(evidence.creditsConsumedMaximum, 1);
  equal(evidence.retries, 0);
  equal(evidence.persistenceWrites, 0);
  equal(evidence.rawPayloadRetained, false);
  equal("message" in evidence, false);
});

test("rejects altered or authority-bearing evidence", () => {
  const evidence = createTwelveDataMulsNotFoundEvidence();
  const mutations: unknown[] = [
    { ...evidence, symbol: "MULL" },
    { ...evidence, httpStatus: 200 },
    { ...evidence, classification: "REFERENCE_CONFIRMED" },
    { ...evidence, retries: 1 },
    { ...evidence, persistenceWrites: 1 },
    { ...evidence, credentialRedacted: false },
    { ...evidence, tradingAuthority: true },
    undefined,
  ];
  for (const mutation of mutations) {
    let rejected = false;
    try {
      createPersonalMarketDataProviderQualificationClosure(mutation);
    } catch (error) {
      rejected =
        error instanceof PersonalMarketDataProviderQualificationClosureError;
    }
    equal(rejected, true);
  }
});

test("closes Alpaca Basic IEX as a complete-provider lane", () => {
  const lane = laneById(PersonalMarketDataProviderLaneId.AlpacaBasicIex);
  equal(lane.disposition,
    PersonalMarketDataProviderLaneDisposition.RejectedAsCompleteProvider);
  equal(lane.permittedRole, "NO_COMPLETE_PROVIDER_ROLE");
  equal(lane.selected, false);
});

test("closes Twelve Data as complete but preserves narrow Bars research", () => {
  const lane = laneById(PersonalMarketDataProviderLaneId.TwelveDataBasic);
  equal(lane.disposition,
    PersonalMarketDataProviderLaneDisposition.RejectedAsCompleteProvider);
  equal(lane.permittedRole, "BARS_RESEARCH_CANDIDATE_ONLY");
  assert(lane.evidenceIds.includes(
    createTwelveDataMulsNotFoundEvidence().evidenceId,
  ), "Twelve Data evidence is missing.");
});

test("keeps Alpaca SIP deferred and unselected", () => {
  const lane = laneById(PersonalMarketDataProviderLaneId.AlpacaSip);
  equal(lane.disposition,
    PersonalMarketDataProviderLaneDisposition.DeferredPendingCostAndCoverage);
  equal(lane.permittedRole,
    "PAID_CANDIDATE_REQUIRING_EXACT_COVERAGE_PROOF");
  equal(lane.selected, false);
});

test("selects no complete provider and preserves the exact requirement", () => {
  const closure = subject();
  equal(closure.requiredSymbolCount, 12);
  equal(closure.requiredSymbol, "MULS");
  equal(closure.completeProviderSelection, "NO_COMPLETE_PROVIDER_SELECTED");
  equal(closure.twelveDataExactMulsReference, "FAILED");
  equal(closure.exactSymbolSetMayBeReduced, false);
});

test("keeps multi-provider composition behind architecture review", () => {
  equal(subject().multiProviderComposition, "ARCHITECTURE_REVIEW_REQUIRED");
});

test("grants no network, cost, collection, recommendation, or trading authority", () => {
  const closure = subject();
  equal(closure.networkAuthorized, false);
  equal(closure.credentialUseAuthorized, false);
  equal(closure.subscriptionPurchaseAuthorized, false);
  equal(closure.collectionAuthorized, false);
  equal(closure.recommendationAuthority, false);
  equal(closure.tradingAuthority, false);
});

test("points only to network-free next-provider research", () => {
  equal(
    subject().recommendedNextTask,
    "RESEARCH_NEXT_ZERO_COST_COMPLETE_PROVIDER_CANDIDATES",
  );
});

test("is deterministic and deeply immutable", () => {
  const first = subject();
  const second = subject();
  deepEqual(first, second);
  equal(Object.isFrozen(first), true);
  equal(Object.isFrozen(first.providerLanes), true);
  equal(Object.isFrozen(first.providerLanes[0]?.reasons), true);
  equal(Object.isFrozen(createTwelveDataMulsNotFoundEvidence()), true);
});

function subject() {
  return createPersonalMarketDataProviderQualificationClosure(
    createTwelveDataMulsNotFoundEvidence(),
  );
}

function laneById(providerId: PersonalMarketDataProviderLaneId) {
  const lane = subject().providerLanes.find(
    (candidate) => candidate.providerId === providerId,
  );
  assert(lane !== undefined, `Missing provider lane ${providerId}.`);
  return lane;
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
  `Personal provider qualification closure tests: ${passed}/${tests.length} passed.`,
);
