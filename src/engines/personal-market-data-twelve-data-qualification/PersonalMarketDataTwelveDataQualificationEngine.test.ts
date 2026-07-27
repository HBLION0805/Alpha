import { BarInterval } from "../../contracts/CanonicalBar";
import {
  PersonalMarketDataTwelveDataCapability,
  PersonalMarketDataTwelveDataCapabilityStatus,
} from "../../contracts/PersonalMarketDataTwelveDataQualification";
import {
  createMulsAssetNotFoundEvidence,
  createPersonalMarketDataAlternativeProviderQualificationPlan,
} from "../personal-market-data-alternative-provider-qualification/PersonalMarketDataAlternativeProviderQualificationEngine";
import {
  PersonalMarketDataTwelveDataQualificationError,
  createPersonalMarketDataTwelveDataQualification,
} from "./PersonalMarketDataTwelveDataQualificationEngine";

type Test = { readonly name: string; readonly run: () => void };
const tests: Test[] = [];
const test = (name: string, run: () => void): void => { tests.push({ name, run }); };
const assert = (condition: boolean, message: string): void => {
  if (!condition) throw new Error(message);
};
const equal = (actual: unknown, expected: unknown): void => {
  assert(Object.is(actual, expected), `Expected ${String(expected)}, received ${String(actual)}.`);
};
const deepEqual = (actual: unknown, expected: unknown): void => {
  equal(JSON.stringify(actual), JSON.stringify(expected));
};

const c5Plan = () => createPersonalMarketDataAlternativeProviderQualificationPlan(
  createMulsAssetNotFoundEvidence(),
);
const qualification = () => createPersonalMarketDataTwelveDataQualification(c5Plan());
const finding = (capability: PersonalMarketDataTwelveDataCapability) => {
  const result = qualification().findings.find((entry) => entry.capability === capability);
  if (result === undefined) throw new Error(`Missing finding ${capability}.`);
  return result;
};

test("binds the exact reviewed C5 plan", () => {
  const changed = { ...c5Plan(), networkAuthorized: true };
  let rejected = false;
  try {
    createPersonalMarketDataTwelveDataQualification(changed);
  } catch (error) {
    rejected = error instanceof PersonalMarketDataTwelveDataQualificationError;
  }
  equal(rejected, true);
});

test("preserves all 12 symbols and four intervals", () => {
  const result = qualification();
  equal(result.requiredSymbols.length, 12);
  equal(result.requiredSymbols.includes("MULS"), true);
  deepEqual(result.requiredIntervals, [
    BarInterval.OneDay,
    BarInterval.OneHour,
    BarInterval.FifteenMinutes,
    BarInterval.FiveMinutes,
  ]);
});

test("keeps exact MULS reference coverage unverified", () => {
  equal(
    finding(PersonalMarketDataTwelveDataCapability.ExactMulsReference).status,
    PersonalMarketDataTwelveDataCapabilityStatus.Unverified,
  );
});

test("recognizes only the narrow intraday Bars implementation", () => {
  equal(
    finding(PersonalMarketDataTwelveDataCapability.IntradayBars).status,
    PersonalMarketDataTwelveDataCapabilityStatus.NarrowImplementationOnly,
  );
});

test("blocks P1D until the daily and EOD policy exists", () => {
  equal(
    finding(PersonalMarketDataTwelveDataCapability.DailyBar).status,
    PersonalMarketDataTwelveDataCapabilityStatus.Blocked,
  );
});

test("does not invent two-sided quote or size semantics", () => {
  equal(
    finding(PersonalMarketDataTwelveDataCapability.TwoSidedQuote).status,
    PersonalMarketDataTwelveDataCapabilityStatus.Unverified,
  );
  equal(
    finding(PersonalMarketDataTwelveDataCapability.QuoteSizes).status,
    PersonalMarketDataTwelveDataCapabilityStatus.Unverified,
  );
});

test("retains the live Bar volume-unit blocker", () => {
  equal(
    finding(PersonalMarketDataTwelveDataCapability.BarVolumeUnits).status,
    PersonalMarketDataTwelveDataCapabilityStatus.Blocked,
  );
});

test("computes one Bar-only coverage snapshot as 48 credits and at least six minutes", () => {
  const budget = qualification().budget;
  equal(budget.barOnlyCoverageSnapshotCredits, 48);
  equal(budget.minimumMinutesPerBarOnlyCoverageSnapshot, 6);
  equal(budget.maximumBarOnlyCoverageSnapshotsPerDay, 16);
  equal(budget.barOnlyCoverageSnapshotFitsOneMinute, false);
});

test("proves the minimal five-minute decision cadence exceeds the free daily budget", () => {
  const budget = qualification().budget;
  equal(budget.regularSessionFiveMinuteCycles, 78);
  equal(budget.fiveMinuteBarCreditsPerCycle, 12);
  equal(budget.minimumBarOnlyDailyCadenceCredits, 972);
  equal(budget.minimumBarOnlyDailyCreditDeficit, 172);
  equal(budget.barOnlyFiveMinuteCadenceFitsFreeDay, false);
});

test("selects no complete provider role and grants no authority", () => {
  const result = qualification();
  equal(result.result, "NOT_QUALIFIED_AS_COMPLETE_PROVIDER");
  equal(result.permittedRole, "BARS_RESEARCH_CANDIDATE_ONLY");
  equal(result.networkAuthorized, false);
  equal(result.credentialUseAuthorized, false);
  equal(result.collectionAuthorized, false);
  equal(result.recommendationAuthority, false);
  equal(result.tradingAuthority, false);
});

test("is deterministic and deeply immutable", () => {
  const left = qualification();
  const right = qualification();
  deepEqual(left, right);
  equal(Object.isFrozen(left), true);
  equal(Object.isFrozen(left.findings), true);
  equal(Object.isFrozen(left.findings[0]?.reasons), true);
  equal(Object.isFrozen(left.budget), true);
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
console.log(`Personal Twelve Data qualification tests: ${passed}/${tests.length} passed.`);
