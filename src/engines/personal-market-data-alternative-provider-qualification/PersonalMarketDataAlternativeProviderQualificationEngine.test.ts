import { BarInterval } from "../../contracts/CanonicalBar";
import {
  PersonalMarketDataResolutionCandidateId,
  PersonalMarketDataResolutionDisposition,
  PersonalMarketDataResolutionGate,
  type PersonalMarketDataResolutionCandidate,
} from "../../contracts/PersonalMarketDataAlternativeProviderQualification";
import {
  PERSONAL_MARKET_DATA_LEGACY_TWELVE_SYMBOLS,
} from "../personal-market-data-provider-coverage/PersonalMarketDataProviderCoverageEngine";
import {
  PersonalMarketDataAlternativeProviderQualificationError,
  createMulsAssetNotFoundEvidence,
  createPersonalMarketDataAlternativeProviderQualificationPlan,
} from "./PersonalMarketDataAlternativeProviderQualificationEngine";

type Test = readonly [string, () => void];
const tests: Test[] = [];
function test(name: string, run: () => void): void { tests.push([name, run]); }
function assert(value: unknown, message = "Expected truthy value."): asserts value {
  if (!value) throw new Error(message);
}
function equal(actual: unknown, expected: unknown, message = "Values differ."): void {
  if (actual !== expected) throw new Error(`${message} Expected ${String(expected)}, received ${String(actual)}.`);
}
function deepEqual(actual: unknown, expected: unknown, message = "Values differ."): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(message);
}
function expectQualificationError(run: () => void): void {
  try {
    run();
    throw new Error("Expected qualification failure.");
  } catch (error) {
    assert(error instanceof PersonalMarketDataAlternativeProviderQualificationError, "Expected typed failure.");
  }
}

test("records the exact sanitized Owner-authorized ASSET_NOT_FOUND evidence", () => {
  const evidence = createMulsAssetNotFoundEvidence();
  equal(evidence.symbol, "MULS");
  equal(evidence.httpStatus, 404);
  equal(evidence.safeCode, "ASSET_NOT_FOUND");
  equal(evidence.attemptedNetworkRequests, 1);
  equal(evidence.completedNetworkRequests, 1);
  equal(evidence.retries, 0);
  equal(evidence.persistenceWrites, 0);
  equal(evidence.accountAccess, false);
  equal(evidence.orderAccess, false);
  equal(evidence.rawPayloadRetained, false);
  equal(evidence.issuerMappingRetained, true);
});

test("evidence contains no raw payload credential price or quantity", () => {
  const serialized = JSON.stringify(createMulsAssetNotFoundEvidence());
  for (const forbidden of ["apiKey", "secret", "rawBody", "price", "quantity", "position", "balance"]) {
    equal(serialized.includes(forbidden), false);
  }
});

test("rejects changed missing or authority-beating evidence", () => {
  const evidence = createMulsAssetNotFoundEvidence();
  const mutations: unknown[] = [
    { ...evidence, httpStatus: 200 },
    { ...evidence, symbol: "MULL" },
    { ...evidence, attemptedNetworkRequests: 2 },
    { ...evidence, retries: 1 },
    { ...evidence, rawPayloadRetained: true },
    { ...evidence, tradingAuthority: true },
    undefined,
  ];
  for (const mutation of mutations) {
    expectQualificationError(() => createPersonalMarketDataAlternativeProviderQualificationPlan(mutation));
  }
});

test("preserves the exact twelve symbols and four required intervals", () => {
  const plan = subjectPlan();
  deepEqual(plan.requiredSymbols, PERSONAL_MARKET_DATA_LEGACY_TWELVE_SYMBOLS);
  deepEqual(plan.requiredIntervals, [
    BarInterval.OneDay,
    BarInterval.OneHour,
    BarInterval.FifteenMinutes,
    BarInterval.FiveMinutes,
  ]);
  equal(plan.requiredSymbols.includes("MULS"), true);
  equal(plan.exactSymbolSetMayBeReduced, false);
});

test("rejects Alpaca Basic as the current complete path", () => {
  const candidate = candidateById(PersonalMarketDataResolutionCandidateId.AlpacaBasicIex);
  equal(candidate.disposition, PersonalMarketDataResolutionDisposition.Rejected);
  equal(candidate.monthlyCostUsd, 0);
  equal(candidate.selected, false);
  deepEqual(candidate.requiredGates, [
    PersonalMarketDataResolutionGate.ExactAssetCoverageProof,
    PersonalMarketDataResolutionGate.ExactLiveSmoke,
  ]);
});

test("prioritizes Twelve Data only for network-free qualification research", () => {
  const subject = subjectPlan();
  const candidate = candidateById(PersonalMarketDataResolutionCandidateId.TwelveDataBasic);
  equal(candidate.priority, 1);
  equal(candidate.disposition, PersonalMarketDataResolutionDisposition.QualificationRequired);
  equal(candidate.monthlyCostUsd, 0);
  assert(candidate.requiredGates.includes(PersonalMarketDataResolutionGate.ExactSymbolReferenceEvidence));
  assert(candidate.requiredGates.includes(PersonalMarketDataResolutionGate.DailyBarAdapter));
  assert(candidate.requiredGates.includes(PersonalMarketDataResolutionGate.TwoSidedQuoteContract));
  assert(candidate.requiredGates.includes(PersonalMarketDataResolutionGate.OwnerNetworkApproval));
  equal(subject.recommendedNextTask, "RESEARCH_TWELVE_DATA_MULS_AND_QUOTE_CAPABILITIES_NETWORK_FREE");
});

test("defers Alpaca SIP until cost and exact asset coverage are approved", () => {
  const candidate = candidateById(PersonalMarketDataResolutionCandidateId.AlpacaSip);
  equal(candidate.disposition, PersonalMarketDataResolutionDisposition.Deferred);
  equal(candidate.monthlyCostUsd, 99);
  assert(candidate.requiredGates.includes(PersonalMarketDataResolutionGate.OwnerCostApproval));
  assert(candidate.requiredGates.includes(PersonalMarketDataResolutionGate.ExactAssetCoverageProof));
  assert(candidate.requiredGates.includes(PersonalMarketDataResolutionGate.SipAdapterReview));
});

test("keeps multi-provider composition behind architecture review", () => {
  const candidate = candidateById(PersonalMarketDataResolutionCandidateId.MultiProviderComposition);
  equal(candidate.disposition, PersonalMarketDataResolutionDisposition.ArchitectureRequired);
  equal(candidate.monthlyCostUsd, null);
  assert(candidate.requiredGates.includes(PersonalMarketDataResolutionGate.MultiProviderArchitectureReview));
  assert(candidate.requiredGates.includes(PersonalMarketDataResolutionGate.CrossProviderFreshnessPolicy));
  assert(candidate.requiredGates.includes(PersonalMarketDataResolutionGate.ConflictPolicy));
});

test("selects no provider and grants no downstream authority", () => {
  const subject = subjectPlan();
  equal(subject.selection, "NO_PROVIDER_SELECTED");
  equal(subject.networkAuthorized, false);
  equal(subject.subscriptionPurchaseAuthorized, false);
  equal(subject.collectionAuthorized, false);
  equal(subject.recommendationAuthority, false);
  equal(subject.tradingAuthority, false);
  assert(subject.candidates.every((candidate) => candidate.selected === false));
});

test("plan is deterministic and deeply immutable", () => {
  const first = subjectPlan();
  const second = subjectPlan();
  deepEqual(first, second);
  equal(Object.isFrozen(first), true);
  equal(Object.isFrozen(first.requiredSymbols), true);
  equal(Object.isFrozen(first.candidates), true);
  equal(Object.isFrozen(first.candidates[0]?.requiredGates), true);
  equal(Object.isFrozen(first.candidates[0]?.reasons), true);
});

function subjectPlan() {
  return createPersonalMarketDataAlternativeProviderQualificationPlan(
    createMulsAssetNotFoundEvidence(),
  );
}

function candidateById(id: PersonalMarketDataResolutionCandidateId): PersonalMarketDataResolutionCandidate {
  const candidate = subjectPlan().candidates.find((entry) => entry.candidateId === id);
  assert(candidate !== undefined, `Candidate ${id} is missing.`);
  return candidate;
}

let passed = 0;
for (const [name, run] of tests) {
  try {
    run();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}
console.log(`Personal market-data alternative-provider qualification tests: ${passed}/${tests.length} passed.`);
