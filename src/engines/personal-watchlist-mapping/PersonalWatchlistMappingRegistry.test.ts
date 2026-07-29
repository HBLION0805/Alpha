import {
  PersonalCandidateExposure,
  PersonalCandidateMappingStatus,
} from "../../contracts/PersonalCandidateScan";
import {
  PersonalWatchlistMappingIssueCode,
  PersonalWatchlistOwnerStatus,
  PersonalWatchlistResearchStatus,
  type PersonalWatchlistMapping,
} from "../../contracts/PersonalWatchlistMapping";
import {
  PersonalWatchlistMappingValidationError,
  activatePersonalWatchlistMapping,
  approvePersonalWatchlistMappingRegistry,
  createPersonalWatchlistMapping,
  createPersonalWatchlistMappingRegistry,
  createResearchVerifiedPersonalWatchlistCatalog,
  validatePersonalWatchlistMapping,
} from "./PersonalWatchlistMappingRegistry";

type Test = { readonly name: string; readonly run: () => void };
const tests: Test[] = [];
const test = (name: string, run: () => void): void => { tests.push({ name, run }); };
interface TestAssert {
  equal(actual: unknown, expected: unknown): void;
  deepEqual(actual: unknown, expected: unknown): void;
  ok(value: unknown): asserts value;
  throws(run: () => unknown, predicate: (error: unknown) => boolean): void;
}
const assert: TestAssert = {
  equal(actual: unknown, expected: unknown): void {
    if (actual !== expected) throw new Error(`Expected ${String(expected)}, received ${String(actual)}.`);
  },
  deepEqual(actual: unknown, expected: unknown): void {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}.`);
    }
  },
  ok(value: unknown): asserts value {
    if (!value) throw new Error("Expected value to be truthy.");
  },
  throws(run: () => unknown, predicate: (error: unknown) => boolean): void {
    try {
      run();
    } catch (error: unknown) {
      if (predicate(error)) return;
      throw error;
    }
    throw new Error("Expected function to throw.");
  },
};

test("catalog contains the four approved research themes and seven current vehicles", () => {
  const catalog = createResearchVerifiedPersonalWatchlistCatalog();
  assert.equal(catalog.registryId, "personal-watchlist:mvp-2026-07");
  assert.equal(catalog.version, "1.1");
  assert.equal(catalog.createdAt, "2026-07-29T15:30:00.000Z");
  assert.equal(catalog.mappings.length, 7);
  assert.deepEqual(
    [...new Set(catalog.mappings.map((mapping) => mapping.analysisInstrument.displaySymbol))].sort(),
    ["MU", "SKHY", "SPCX", "TSLA"],
  );
  assert.deepEqual(
    catalog.mappings.map((mapping) => mapping.tradeVehicle.displaySymbol).sort(),
    ["MULL", "SKDD", "SKUU", "SPCH", "SSPC", "TSLL", "TSLQ"],
  );
});

test("Owner-withdrawn MULS is absent while the MU bullish path remains", () => {
  const catalog = createResearchVerifiedPersonalWatchlistCatalog();
  assert.equal(catalog.mappings.some((mapping) => mapping.tradeVehicle.displaySymbol === "MULS"), false);
  assert.equal(catalog.mappings.some((mapping) => mapping.tradeVehicle.displaySymbol === "MULL"), true);
});

test("catalog preserves exact bullish and bearish daily targets", () => {
  const catalog = createResearchVerifiedPersonalWatchlistCatalog();
  for (const mapping of catalog.mappings) {
    assert.equal(
      mapping.dailyTargetBasisPoints,
      mapping.exposure === PersonalCandidateExposure.Bullish ? 20_000 : -20_000,
    );
  }
});

test("issuer and regulatory research does not silently become Owner approval", () => {
  const catalog = createResearchVerifiedPersonalWatchlistCatalog();
  assert.ok(catalog.mappings.every((mapping) => mapping.researchStatus === PersonalWatchlistResearchStatus.AuthorityVerified));
  assert.ok(catalog.mappings.every((mapping) => mapping.ownerDecision.status === PersonalWatchlistOwnerStatus.Pending));
  assert.ok(catalog.mappings.every((mapping) => !activatePersonalWatchlistMapping(mapping).active));
});

test("an exact approved mapping activates as a reviewed candidate mapping", () => {
  const proposal = createResearchVerifiedPersonalWatchlistCatalog().mappings.find(
    (mapping) => mapping.tradeVehicle.displaySymbol === "TSLQ",
  );
  assert.ok(proposal);
  const approved = createPersonalWatchlistMapping({
    ...proposal,
    ownerDecision: {
      status: PersonalWatchlistOwnerStatus.Approved,
      decidedBy: "owner:personal",
      decidedAt: "2026-07-26T17:00:00.000Z",
      decisionReference: "decision:mvp-t3-mappings",
    },
  });
  const activation = activatePersonalWatchlistMapping(approved);
  assert.equal(activation.active, true);
  assert.equal(activation.mapping?.status, PersonalCandidateMappingStatus.Reviewed);
  assert.equal(activation.mapping?.exposure, PersonalCandidateExposure.Bearish);
  assert.deepEqual(activation.mapping?.evidenceReferences, ["issuer:tradr:tslq"]);
});

test("pending research cannot activate even with an Owner decision", () => {
  const proposal = createResearchVerifiedPersonalWatchlistCatalog().mappings[0]!;
  const pendingResearch = createPersonalWatchlistMapping({
    ...proposal,
    researchStatus: PersonalWatchlistResearchStatus.EvidencePending,
    authorityEvidence: [],
    ownerDecision: {
      status: PersonalWatchlistOwnerStatus.Approved,
      decidedBy: "owner:personal",
      decidedAt: "2026-07-26T17:00:00.000Z",
      decisionReference: "decision:mvp-t3-mappings",
    },
  });
  const activation = activatePersonalWatchlistMapping(pendingResearch);
  assert.equal(activation.active, false);
  assert.ok(activation.blockers.some((entry) => entry.code === PersonalWatchlistMappingIssueCode.EvidenceMissing));
});

test("unknown authority-beating fields fail closed", () => {
  const proposal = createResearchVerifiedPersonalWatchlistCatalog().mappings[0]!;
  const validation = validatePersonalWatchlistMapping({ ...proposal, brokerOrderType: "MARKET" });
  assert.equal(validation.valid, false);
  assert.ok(validation.issues.some((entry) => entry.code === PersonalWatchlistMappingIssueCode.UndeclaredField));
});

test("verified research requires authority evidence", () => {
  const proposal = createResearchVerifiedPersonalWatchlistCatalog().mappings[0]!;
  const validation = validatePersonalWatchlistMapping({ ...proposal, authorityEvidence: [] });
  assert.ok(validation.issues.some((entry) => entry.code === PersonalWatchlistMappingIssueCode.EvidenceMissing));
});

test("bullish exposure cannot carry a negative target", () => {
  const proposal = createResearchVerifiedPersonalWatchlistCatalog().mappings[0]!;
  const validation = validatePersonalWatchlistMapping({ ...proposal, dailyTargetBasisPoints: -20_000 });
  assert.ok(validation.issues.some((entry) => entry.code === PersonalWatchlistMappingIssueCode.InvalidDailyTarget));
});

test("mapping rejects the same instrument on both sides", () => {
  const proposal = createResearchVerifiedPersonalWatchlistCatalog().mappings[0]!;
  const validation = validatePersonalWatchlistMapping({ ...proposal, tradeVehicle: proposal.analysisInstrument });
  assert.ok(validation.issues.some((entry) => entry.code === PersonalWatchlistMappingIssueCode.SameInstrument));
});

test("registry rejects duplicate mapping identifiers", () => {
  const proposal = createResearchVerifiedPersonalWatchlistCatalog().mappings[0]!;
  assert.throws(
    () => createPersonalWatchlistMappingRegistry({
      registryId: "registry:duplicate",
      version: "1.0",
      createdAt: "2026-07-26T17:00:00.000Z",
      mappings: [proposal, { ...proposal }],
    }),
    (error: unknown) => error instanceof PersonalWatchlistMappingValidationError
      && error.issues.some((entry) => entry.code === PersonalWatchlistMappingIssueCode.DuplicateMapping),
  );
});

test("registry rejects a vehicle reused across themes", () => {
  const catalog = createResearchVerifiedPersonalWatchlistCatalog();
  const first = catalog.mappings[0]!;
  const second: PersonalWatchlistMapping = {
    ...catalog.mappings[2]!,
    tradeVehicle: first.tradeVehicle,
  };
  assert.throws(
    () => createPersonalWatchlistMappingRegistry({
      registryId: "registry:duplicate-vehicle",
      version: "1.0",
      createdAt: "2026-07-26T17:00:00.000Z",
      mappings: [first, second],
    }),
    (error: unknown) => error instanceof PersonalWatchlistMappingValidationError
      && error.issues.some((entry) => entry.code === PersonalWatchlistMappingIssueCode.DuplicateVehicle),
  );
});

test("catalog and nested mappings are immutable", () => {
  const catalog = createResearchVerifiedPersonalWatchlistCatalog();
  assert.equal(Object.isFrozen(catalog), true);
  assert.equal(Object.isFrozen(catalog.mappings), true);
  assert.equal(Object.isFrozen(catalog.mappings[0]?.authorityEvidence), true);
});

test("Owner can approve only the exact complete mapping set", () => {
  const catalog = createResearchVerifiedPersonalWatchlistCatalog();
  const approved = approvePersonalWatchlistMappingRegistry(catalog, {
    mappingIds: catalog.mappings.map((mapping) => mapping.mappingId),
    decidedBy: "owner:personal",
    decidedAt: "2026-07-26T17:00:00.000Z",
    decisionReference: "decision:mvp-t3a-approved",
  });
  assert.ok(approved.mappings.every((mapping) => activatePersonalWatchlistMapping(mapping).active));
});

test("partial Owner mapping approval fails closed", () => {
  const catalog = createResearchVerifiedPersonalWatchlistCatalog();
  assert.throws(
    () => approvePersonalWatchlistMappingRegistry(catalog, {
      mappingIds: catalog.mappings.slice(1).map((mapping) => mapping.mappingId),
      decidedBy: "owner:personal",
      decidedAt: "2026-07-26T17:00:00.000Z",
      decisionReference: "decision:mvp-t3a-approved",
    }),
    (error: unknown) => error instanceof PersonalWatchlistMappingValidationError
      && error.issues.some((entry) => entry.code === PersonalWatchlistMappingIssueCode.InvalidOwnerDecision),
  );
});

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
console.log(`${passed}/${tests.length} personal watchlist mapping tests passed.`);
