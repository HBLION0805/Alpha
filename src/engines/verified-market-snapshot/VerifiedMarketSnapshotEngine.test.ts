import { deterministicFingerprint } from "../../contracts/DeterministicFingerprint";
import type {
  EvidenceResolution,
  ProviderRequestAttempt,
  VerifiedMarketCalendarSessionEvidence,
} from "../../contracts/VerifiedMarketSnapshot";
import {
  VerifiedMarketCalendarSessionStatus,
  VerifiedMarketDataOrigin,
  VerifiedMarketProviderCapability,
  VerifiedMarketSnapshotIssueCode,
} from "../../contracts/VerifiedMarketSnapshot";
import { buildOfflinePersonalDailyScanFixture } from "../personal-daily-scan/PersonalDailyScanFixture";
import {
  composeVerifiedMarketSnapshot,
  exchangeLocalDate,
  latestCompletedTradingSession,
  validateVerifiedMarketSnapshotCompositionBinding,
  validateVerifiedMarketSnapshotInput,
  verifiedEvidenceResolutionFingerprint,
  verifiedProviderRequestFingerprint,
} from "./VerifiedMarketSnapshotEngine";

type Test = readonly [string, () => void];
const tests: Test[] = [];
function test(name: string, run: Test[1]): void {
  tests.push([name, run]);
}
function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

function calendarEvidence(input: {
  readonly sessionDate: string;
  readonly marketOpen: string;
  readonly marketClose: string;
  readonly status: VerifiedMarketCalendarSessionStatus;
  readonly closureBufferSeconds?: number;
}): VerifiedMarketCalendarSessionEvidence {
  const base = {
    calendarEvidenceId: `calendar-evidence:us-equities:${input.sessionDate}:${input.status}`,
    calendarId: "calendar:us-equities:test",
    sessionId: `session:${input.sessionDate}:regular`,
    sessionDate: input.sessionDate,
    sessionType: "REGULAR" as const,
    timezone: "America/New_York",
    marketOpen: input.marketOpen,
    marketClose: input.marketClose,
    closureBufferSeconds: input.closureBufferSeconds ?? 5,
    status: input.status,
    provenanceReference: `fixture-calendar:us-equities:${input.sessionDate}:${input.status}`,
    dataOrigin: VerifiedMarketDataOrigin.Fixture,
  };
  return {
    ...base,
    calendarEvidenceFingerprint: deterministicFingerprint(base),
  };
}

function requestWith(
  source: ProviderRequestAttempt,
  change: Partial<ProviderRequestAttempt>,
): ProviderRequestAttempt {
  const changed = { ...source, ...change };
  const fingerprintInput = {
    requestAttemptId: changed.requestAttemptId,
    requestId: changed.requestId,
    requestedProvider: changed.requestedProvider,
    capability: changed.capability,
    ...(changed.interval === undefined ? {} : { interval: changed.interval }),
    requestedSymbolScope: changed.requestedSymbolScope,
    mappingRegistryVersion: changed.mappingRegistryVersion,
    requestWindowStart: changed.requestWindowStart,
    requestWindowEnd: changed.requestWindowEnd,
  };
  return {
    ...changed,
    requestFingerprint: verifiedProviderRequestFingerprint(fingerprintInput),
  };
}

function resolutionWith(
  source: EvidenceResolution,
  change: Partial<EvidenceResolution>,
): EvidenceResolution {
  const { resolutionFingerprint: _discarded, ...base } = source;
  const changed = { ...base, ...change };
  return {
    ...changed,
    resolutionFingerprint: verifiedEvidenceResolutionFingerprint(changed),
  };
}

function resolutionAsQuote(source: EvidenceResolution): EvidenceResolution {
  const {
    resolutionFingerprint: _discardedFingerprint,
    interval: _discardedInterval,
    ...base
  } = source;
  const changed = {
    ...base,
    capability: VerifiedMarketProviderCapability.LatestQuote,
  };
  return {
    ...changed,
    resolutionFingerprint: verifiedEvidenceResolutionFingerprint(changed),
  };
}

function withSharedBarAndQuoteEvidenceId(
  source: ReturnType<
    typeof buildOfflinePersonalDailyScanFixture
  >["snapshotInput"],
): ReturnType<typeof buildOfflinePersonalDailyScanFixture>["snapshotInput"] {
  const bar = source.canonicalBarReferences.find((entry) =>
    source.benchmarkInstrumentIds.includes(entry.canonicalInstrumentId),
  )!;
  const quote = source.canonicalQuoteReferences[0]!;
  return {
    ...source,
    canonicalBarReferences: source.canonicalBarReferences.map((entry) =>
      entry.canonicalBarId === bar.canonicalBarId
        ? { ...entry, canonicalBarId: quote.canonicalQuoteId }
        : entry,
    ),
    evidenceResolutions: source.evidenceResolutions.map((entry) =>
      entry.capability === VerifiedMarketProviderCapability.Bars &&
      entry.evidenceId === bar.canonicalBarId
        ? resolutionWith(entry, { evidenceId: quote.canonicalQuoteId })
        : entry,
    ),
  };
}

test("fixture snapshot validates and deterministic replay preserves identity", () => {
  const input = buildOfflinePersonalDailyScanFixture().snapshotInput;
  const left = composeVerifiedMarketSnapshot(input);
  const right = composeVerifiedMarketSnapshot(
    buildOfflinePersonalDailyScanFixture().snapshotInput,
  );
  assert(left.status === "VERIFIED", "snapshot must verify");
  assert(left.snapshotId.startsWith("verified-market-snapshot:"), "derived snapshot ID missing");
  assert(left.providerNativePayloadStored === false, "provider-native payload storage is prohibited");
  assert(JSON.stringify(left) === JSON.stringify(right), "fixture replay must be deterministic");
});

test("future, stale, partial, and missing-provenance observations fail closed", () => {
  const source = buildOfflinePersonalDailyScanFixture().snapshotInput;
  const cases: readonly [string, unknown, VerifiedMarketSnapshotIssueCode][] = [
    ["future", { ...source, canonicalBarReferences: source.canonicalBarReferences.map((entry, index) => index === 0 ? { ...entry, intervalEnd: "2026-07-29T13:59:51.000Z" } : entry) }, VerifiedMarketSnapshotIssueCode.FutureObservation],
    ["stale", { ...source, canonicalQuoteReferences: source.canonicalQuoteReferences.map((entry, index) => index === 0 ? { ...entry, observationTime: "2026-07-28T19:00:00.000Z", status: "CURRENT" } : entry) }, VerifiedMarketSnapshotIssueCode.StaleObservation],
    ["partial", { ...source, canonicalBarReferences: source.canonicalBarReferences.map((entry, index) => index === 0 ? { ...entry, status: "PARTIAL" } : entry) }, VerifiedMarketSnapshotIssueCode.IncompleteBar],
    ["provenance", { ...source, canonicalQuoteReferences: source.canonicalQuoteReferences.map((entry, index) => index === 0 ? { ...entry, provenanceReference: "" } : entry) }, VerifiedMarketSnapshotIssueCode.MissingProvenance],
  ];
  for (const [name, input, code] of cases)
    assert(
      validateVerifiedMarketSnapshotInput(input).issues.some((entry) => entry.code === code),
      `${name} must return ${code}`,
    );
});

test("source-stale finalized Bars remain valid when completed-session binding is exact", () => {
  const source = buildOfflinePersonalDailyScanFixture().snapshotInput;
  const input = {
    ...source,
    canonicalBarReferences: source.canonicalBarReferences.map((entry) => ({
      ...entry,
      freshness: "STALE" as const,
    })),
  };
  assert(
    validateVerifiedMarketSnapshotInput(input).valid,
    "Bar wall-clock freshness must not replace completed-session validity",
  );
});

test("analysis timeframe sets reject reused, reversed, cross-session, extra, and missing Bars", () => {
  const source = buildOfflinePersonalDailyScanFixture().snapshotInput;
  const candidate = source.compositionBinding.candidates[0]!;
  const intraday = candidate.timeframes.find(
    (entry) => entry.interval === "PT5M",
  )!;
  const reused = {
    ...source,
    compositionBinding: {
      ...source.compositionBinding,
      candidates: source.compositionBinding.candidates.map((entry, index) =>
        index === 0
          ? {
              ...entry,
              timeframes: entry.timeframes.map((timeframe) =>
                timeframe.interval === "PT5M"
                  ? {
                      ...timeframe,
                      endBarId: timeframe.startBarId,
                      endBarFingerprint: timeframe.startBarFingerprint,
                    }
                  : timeframe,
              ),
            }
          : entry,
      ),
    },
  };
  const reversed = {
    ...source,
    compositionBinding: {
      ...source.compositionBinding,
      candidates: source.compositionBinding.candidates.map((entry, index) =>
        index === 0
          ? {
              ...entry,
              timeframes: entry.timeframes.map((timeframe) =>
                timeframe.interval === "PT5M"
                  ? {
                      ...timeframe,
                      startBarId: timeframe.endBarId,
                      startBarFingerprint: timeframe.endBarFingerprint,
                      endBarId: timeframe.startBarId,
                      endBarFingerprint: timeframe.startBarFingerprint,
                    }
                  : timeframe,
              ),
            }
          : entry,
      ),
    },
  };
  const crossSession = {
    ...source,
    canonicalBarReferences: source.canonicalBarReferences.map((entry) =>
      entry.canonicalBarId === intraday.startBarId
        ? { ...entry, sessionDate: "2026-07-27" }
        : entry,
    ),
  };
  const analysisBar = source.canonicalBarReferences.find(
    (entry) =>
      entry.canonicalInstrumentId === candidate.analysisInstrumentId &&
      entry.interval === "PT5M",
  )!;
  const extra = {
    ...source,
    canonicalBarReferences: [
      ...source.canonicalBarReferences,
      {
        ...analysisBar,
        canonicalBarId: `${analysisBar.canonicalBarId}:extra`,
        canonicalBarFingerprint: "fnv1a64:0000000000000001",
      },
    ],
  };
  const missing = {
    ...source,
    canonicalBarReferences: source.canonicalBarReferences.filter(
      (entry) => entry.canonicalBarId !== intraday.startBarId,
    ),
  };
  const cases: readonly [
    string,
    unknown,
    VerifiedMarketSnapshotIssueCode,
  ][] = [
    ["reused", reused, VerifiedMarketSnapshotIssueCode.TimeframeBarBindingInvalid],
    ["reversed", reversed, VerifiedMarketSnapshotIssueCode.TimeframeBarBindingInvalid],
    ["cross-session", crossSession, VerifiedMarketSnapshotIssueCode.TimeframeBarBindingInvalid],
    ["extra", extra, VerifiedMarketSnapshotIssueCode.TimeframeBarCountMismatch],
    ["missing", missing, VerifiedMarketSnapshotIssueCode.TimeframeBarCountMismatch],
  ];
  for (const [name, input, expected] of cases)
    assert(
      validateVerifiedMarketSnapshotInput(input).issues.some(
        (entry) => entry.code === expected,
      ),
      `${name} timeframe evidence must return ${expected}`,
    );
});

test("stale observations cannot masquerade as CURRENT and incomplete windows are rejected", () => {
  const source = buildOfflinePersonalDailyScanFixture().snapshotInput;
  const staleCurrent = {
    ...source,
    canonicalQuoteReferences: source.canonicalQuoteReferences.map((entry, index) =>
      index === 0
        ? { ...entry, observationTime: "2026-07-28T19:00:00.000Z", status: "CURRENT" }
        : entry,
    ),
  };
  const incompleteWindow = {
    ...source,
    canonicalBarReferences: source.canonicalBarReferences.map((entry, index) =>
      index === 0
        ? { ...entry, intervalStart: "2026-07-27T13:30:01.000Z" }
        : entry,
    ),
  };
  assert(validateVerifiedMarketSnapshotInput(staleCurrent).issues.some((entry) => entry.code === VerifiedMarketSnapshotIssueCode.StaleObservation), "old quote cannot masquerade as CURRENT");
  assert(validateVerifiedMarketSnapshotInput(incompleteWindow).issues.some((entry) => entry.code === VerifiedMarketSnapshotIssueCode.IncompleteBar), "incomplete Bar window must fail");
});

test("identity conflicts, undeclared fields, and silent provider fallback fail closed", () => {
  const source = buildOfflinePersonalDailyScanFixture().snapshotInput;
  const identity = {
    ...source,
    canonicalQuoteReferences: source.canonicalQuoteReferences.map((entry, index) =>
      index === 0 ? { ...entry, canonicalInstrumentId: "instrument:not-declared" } : entry,
    ),
  };
  const fallback = {
    ...source,
    providerRequestAttempts: source.providerRequestAttempts.map((entry, index) =>
      index === 0 ? { ...entry, actualProvider: "provider:unapproved" } : entry,
    ),
  };
  assert(validateVerifiedMarketSnapshotInput(identity).issues.some((issue) => issue.code === VerifiedMarketSnapshotIssueCode.IdentityMismatch), "identity mismatch must block");
  assert(validateVerifiedMarketSnapshotInput({ ...source, order: "MARKET" }).issues.some((issue) => issue.code === VerifiedMarketSnapshotIssueCode.UndeclaredField), "unknown field must block");
  assert(validateVerifiedMarketSnapshotInput(fallback).issues.some((issue) => issue.code === VerifiedMarketSnapshotIssueCode.SilentProviderFallback), "silent fallback must block");
});

test("coverage and exact composition binding fail closed", () => {
  const fixture = buildOfflinePersonalDailyScanFixture();
  const source = fixture.snapshotInput;
  const analysisId = source.analysisInstrumentIds[0]!;
  const vehicleId = source.tradeVehicleIds[0]!;
  const missingCases: readonly unknown[] = [
    { ...source, canonicalBarReferences: source.canonicalBarReferences.filter((bar) => bar.canonicalInstrumentId !== analysisId) },
    { ...source, canonicalBarReferences: source.canonicalBarReferences.filter((bar) => !(bar.canonicalInstrumentId === analysisId && bar.interval === "PT1H")) },
    { ...source, canonicalQuoteReferences: source.canonicalQuoteReferences.filter((quote) => quote.canonicalInstrumentId !== vehicleId) },
    { ...source, benchmarkInstrumentIds: [...source.benchmarkInstrumentIds, "instrument:00000000000000000000000203"] },
  ];
  for (const input of missingCases)
    assert(
      validateVerifiedMarketSnapshotInput(input).issues.some((entry) =>
        entry.code === VerifiedMarketSnapshotIssueCode.CoverageMissing ||
        entry.code === VerifiedMarketSnapshotIssueCode.CompositionBindingMismatch
      ),
      "missing declared coverage must fail closed",
    );

  const mutated = {
    ...source,
    compositionBinding: {
      ...source.compositionBinding,
      candidates: source.compositionBinding.candidates.map((candidate, index) =>
        index === 0
          ? {
              ...candidate,
              timeframes: candidate.timeframes.map((timeframe, timeframeIndex) =>
                timeframeIndex === 0
                  ? { ...timeframe, endBarFingerprint: "fnv1a64:0000000000000000" }
                  : timeframe,
              ),
            }
          : candidate,
      ),
    },
  };
  assert(validateVerifiedMarketSnapshotInput(mutated).issues.some((entry) => entry.code === VerifiedMarketSnapshotIssueCode.CompositionBindingMismatch), "mutated binding must fail");
  const snapshot = composeVerifiedMarketSnapshot(source);
  assert(!validateVerifiedMarketSnapshotCompositionBinding(snapshot, { ...fixture.compositionRequest, profileVersion: "2.0" }).valid, "Snapshot A must not bind Composition B");
});

test("one transport attempt represents each real batch request, not each evidence item", () => {
  const source = buildOfflinePersonalDailyScanFixture().snapshotInput;
  assert(source.providerRequestAttempts.length === 6, "fixture must preserve five planned batch requests plus one benchmark batch request");
  assert(new Set(source.providerRequestAttempts.map((entry) => entry.requestId)).size === 6, "request IDs must represent real batch requests");
  assert(source.evidenceResolutions.length === 41, "all 34 Bars and 7 Quotes require individual resolutions");
  assert(source.providerRequestAttempts.every((entry) => !Object.hasOwn(entry, "evidenceReferences")), "request attempts cannot embed fake per-evidence attempts");
  const counts = source.providerRequestAttempts.map(
    (attempt) => source.evidenceResolutions.filter(
      (resolution) => resolution.requestAttemptId === attempt.requestAttemptId,
    ).length,
  );
  assert(JSON.stringify(counts) === JSON.stringify([8, 8, 8, 8, 7, 2]), "batch request resolution cardinalities are incorrect");
});

test("each Snapshot evidence binds exactly one successful EvidenceResolution", () => {
  const source = buildOfflinePersonalDailyScanFixture().snapshotInput;
  const typedEvidenceKeys = [
    ...source.canonicalBarReferences.map(
      (entry) =>
        `${VerifiedMarketProviderCapability.Bars}:${entry.canonicalBarId}`,
    ),
    ...source.canonicalQuoteReferences.map(
      (entry) =>
        `${VerifiedMarketProviderCapability.LatestQuote}:${entry.canonicalQuoteId}`,
    ),
  ];
  assert(
    new Set(
      source.evidenceResolutions.map(
        (entry) => `${entry.capability}:${entry.evidenceId}`,
      ),
    ).size === typedEvidenceKeys.length,
    "typed resolution evidence keys must be unique",
  );
  for (const typedKey of typedEvidenceKeys) {
    const matches = source.evidenceResolutions.filter(
      (entry) => `${entry.capability}:${entry.evidenceId}` === typedKey,
    );
    assert(
      matches.length === 1,
      `${typedKey} must have exactly one EvidenceResolution`,
    );
    assert(
      matches[0]!.result === "RESOLVED",
      `${typedKey} resolution must be explicitly successful`,
    );
    const attempt = source.providerRequestAttempts.find((entry) => entry.requestAttemptId === matches[0]!.requestAttemptId);
    assert(
      attempt?.result === "SUCCEEDED",
      `${typedKey} must bind a successful ProviderRequestAttempt`,
    );
    assert(
      matches[0]!.responseSourceReference === attempt.responseSourceReference,
      `${typedKey} response source must bind its real request`,
    );
  }
});

test("Bar and Quote may share a raw ID when both typed resolutions are complete", () => {
  const source = withSharedBarAndQuoteEvidenceId(
    buildOfflinePersonalDailyScanFixture().snapshotInput,
  );
  const sharedId = source.canonicalQuoteReferences[0]!.canonicalQuoteId;
  const matches = source.evidenceResolutions.filter(
    (entry) => entry.evidenceId === sharedId,
  );
  assert(matches.length === 2, "shared raw ID must retain both resolutions");
  assert(
    new Set(matches.map((entry) => entry.capability)).size === 2,
    "shared raw ID must remain distinct by capability",
  );
  assert(
    validateVerifiedMarketSnapshotInput(source).valid,
    "complete typed Bar and Quote bindings must validate",
  );
});

test("typed evidence coverage rejects missing, crossed, duplicate, and ghost resolutions", () => {
  const source = withSharedBarAndQuoteEvidenceId(
    buildOfflinePersonalDailyScanFixture().snapshotInput,
  );
  const sharedId = source.canonicalQuoteReferences[0]!.canonicalQuoteId;
  const barResolution = source.evidenceResolutions.find(
    (entry) =>
      entry.evidenceId === sharedId &&
      entry.capability === VerifiedMarketProviderCapability.Bars,
  )!;
  const cases: readonly [string, unknown, VerifiedMarketSnapshotIssueCode][] = [
    [
      "missing Bar resolution",
      {
        ...source,
        evidenceResolutions: source.evidenceResolutions.filter(
          (entry) =>
            !(
              entry.evidenceId === sharedId &&
              entry.capability === VerifiedMarketProviderCapability.Bars
            ),
        ),
      },
      VerifiedMarketSnapshotIssueCode.EvidenceCoverageMismatch,
    ],
    [
      "missing Quote resolution",
      {
        ...source,
        evidenceResolutions: source.evidenceResolutions.filter(
          (entry) =>
            !(
              entry.evidenceId === sharedId &&
              entry.capability ===
                VerifiedMarketProviderCapability.LatestQuote
            ),
        ),
      },
      VerifiedMarketSnapshotIssueCode.EvidenceCoverageMismatch,
    ],
    [
      "capability and ID crossed",
      {
        ...source,
        evidenceResolutions: source.evidenceResolutions.map((entry) =>
          entry === barResolution
            ? resolutionAsQuote(entry)
            : entry,
        ),
      },
      VerifiedMarketSnapshotIssueCode.InvalidProviderTrace,
    ],
    [
      "duplicate typed evidence resolution",
      {
        ...source,
        evidenceResolutions: [
          ...source.evidenceResolutions,
          resolutionWith(barResolution, {
            resolutionId: `${barResolution.resolutionId}:duplicate`,
          }),
        ],
      },
      VerifiedMarketSnapshotIssueCode.EvidenceCoverageMismatch,
    ],
    [
      "resolution targets nonexistent evidence",
      {
        ...source,
        evidenceResolutions: [
          ...source.evidenceResolutions,
          resolutionWith(barResolution, {
            resolutionId: `${barResolution.resolutionId}:ghost`,
            evidenceId: "bar:ghost",
          }),
        ],
      },
      VerifiedMarketSnapshotIssueCode.InvalidProviderTrace,
    ],
  ];
  for (const [name, input, expected] of cases) {
    const left = validateVerifiedMarketSnapshotInput(input);
    const right = validateVerifiedMarketSnapshotInput(input);
    assert(!left.valid, `${name} must fail closed`);
    assert(
      left.issues.some((entry) => entry.code === expected),
      `${name} must report ${expected}`,
    );
    assert(
      JSON.stringify(left) === JSON.stringify(right),
      `${name} issue ordering must be deterministic`,
    );
    assert(
      left.issues
        .map((entry) => `${entry.code}|${entry.field}|${entry.message}`)
        .join("\n") ===
        [...left.issues]
          .sort((a, b) =>
            `${a.code}|${a.field}|${a.message}`.localeCompare(
              `${b.code}|${b.field}|${b.message}`,
            ),
          )
          .map((entry) => `${entry.code}|${entry.field}|${entry.message}`)
          .join("\n"),
      `${name} issue codes must remain stably sorted`,
    );
  }
});

test("provider attempts reject unknown fields, duplicate order, fallback, and invalid failure semantics", () => {
  const source = buildOfflinePersonalDailyScanFixture().snapshotInput;
  const cases: readonly unknown[] = [
    { ...source, providerRequestAttempts: source.providerRequestAttempts.map((entry, index) => index === 0 ? { ...entry, capability: "UNKNOWN" } : entry) },
    { ...source, providerRequestAttempts: source.providerRequestAttempts.map((entry, index) => index === 0 ? { ...entry, result: "UNKNOWN" } : entry) },
    { ...source, providerRequestAttempts: source.providerRequestAttempts.map((entry, index) => index === 1 ? { ...entry, attemptOrder: 1 } : entry) },
    { ...source, providerRequestAttempts: source.providerRequestAttempts.map((entry, index) => index === 0 ? { ...entry, failureReason: "FORGED" } : entry) },
  ];
  for (const input of cases)
    assert(validateVerifiedMarketSnapshotInput(input).issues.some((entry) => entry.code === VerifiedMarketSnapshotIssueCode.InvalidProviderTrace), "invalid transport attempt must fail closed");
});

test("ghost, duplicate, untraced benchmark, and source-conflict resolutions fail closed", () => {
  const source = buildOfflinePersonalDailyScanFixture().snapshotInput;
  const first = source.evidenceResolutions[0]!;
  const duplicate = resolutionWith(first, {
    resolutionId: `${first.resolutionId}:duplicate`,
  });
  const ghost = resolutionWith(first, {
    resolutionId: `${first.resolutionId}:ghost`,
    evidenceId: "bar:ghost",
    evidenceFingerprint: "fnv1a64:0000000000000000",
  });
  const sourceConflict = resolutionWith(first, {
    responseSourceReference: "fixture-response:conflict",
  });
  const benchmarkId = source.benchmarkInstrumentIds[0]!;
  const benchmarkEvidenceId = source.canonicalBarReferences.find(
    (entry) => entry.canonicalInstrumentId === benchmarkId,
  )!.canonicalBarId;
  const cases: readonly [unknown, VerifiedMarketSnapshotIssueCode][] = [
    [{ ...source, evidenceResolutions: [...source.evidenceResolutions, duplicate] }, VerifiedMarketSnapshotIssueCode.EvidenceCoverageMismatch],
    [{ ...source, evidenceResolutions: source.evidenceResolutions.map((entry, index) => index === 0 ? ghost : entry) }, VerifiedMarketSnapshotIssueCode.InvalidProviderTrace],
    [{ ...source, evidenceResolutions: source.evidenceResolutions.filter((entry) => entry.evidenceId !== benchmarkEvidenceId) }, VerifiedMarketSnapshotIssueCode.EvidenceCoverageMismatch],
    [{ ...source, evidenceResolutions: source.evidenceResolutions.map((entry, index) => index === 0 ? sourceConflict : entry) }, VerifiedMarketSnapshotIssueCode.InvalidProviderTrace],
  ];
  for (const [input, code] of cases)
    assert(validateVerifiedMarketSnapshotInput(input).issues.some((entry) => entry.code === code), `${code} must be reported`);
});

test("request windows must contain the exact evidence windows returned by a batch request", () => {
  const source = buildOfflinePersonalDailyScanFixture().snapshotInput;
  const firstResolution = source.evidenceResolutions[0]!;
  const attemptIndex = source.providerRequestAttempts.findIndex(
    (entry) => entry.requestAttemptId === firstResolution.requestAttemptId,
  );
  assert(attemptIndex >= 0, "linked attempt missing");
  const attempt = source.providerRequestAttempts[attemptIndex]!;
  const requestWindowStart = new Date(Date.parse(firstResolution.evidenceWindowStart) + 1).toISOString();
  const wrongWindowAttempt = requestWith(attempt, { requestWindowStart });
  const wrongWindow = {
    ...source,
    providerRequestAttempts: source.providerRequestAttempts.map((entry, index) =>
      index === attemptIndex ? wrongWindowAttempt : entry,
    ),
  };
  assert(validateVerifiedMarketSnapshotInput(wrongWindow).issues.some((entry) => entry.code === VerifiedMarketSnapshotIssueCode.RequestWindowMismatch), "window mismatch must fail closed");
});

test("latest completed session selects prior session before and during market, then current after closure", () => {
  const monday = calendarEvidence({
    sessionDate: "2026-07-27",
    marketOpen: "2026-07-27T13:30:00.000Z",
    marketClose: "2026-07-27T20:00:00.000Z",
    status: VerifiedMarketCalendarSessionStatus.Completed,
  });
  const tuesdayScheduled = calendarEvidence({
    sessionDate: "2026-07-28",
    marketOpen: "2026-07-28T13:30:00.000Z",
    marketClose: "2026-07-28T20:00:00.000Z",
    status: VerifiedMarketCalendarSessionStatus.Scheduled,
  });
  const tuesdayCompleted = calendarEvidence({
    sessionDate: "2026-07-28",
    marketOpen: "2026-07-28T13:30:00.000Z",
    marketClose: "2026-07-28T20:00:00.000Z",
    status: VerifiedMarketCalendarSessionStatus.Completed,
  });
  assert(latestCompletedTradingSession("2026-07-28T12:00:00.000Z", [monday, tuesdayScheduled])?.sessionDate === "2026-07-27", "premarket must select prior completed session");
  assert(latestCompletedTradingSession("2026-07-28T16:00:00.000Z", [monday, tuesdayScheduled])?.sessionDate === "2026-07-27", "intraday must select prior completed session");
  assert(latestCompletedTradingSession("2026-07-28T20:00:05.000Z", [monday, tuesdayCompleted])?.sessionDate === "2026-07-28", "post-close buffer must select current completed session");
});

test("weekend and market-holiday asOf values select the prior explicit completed session", () => {
  const friday = calendarEvidence({
    sessionDate: "2026-07-31",
    marketOpen: "2026-07-31T13:30:00.000Z",
    marketClose: "2026-07-31T20:00:00.000Z",
    status: VerifiedMarketCalendarSessionStatus.Completed,
  });
  const saturday = calendarEvidence({
    sessionDate: "2026-08-01",
    marketOpen: "2026-08-01T13:30:00.000Z",
    marketClose: "2026-08-01T20:00:00.000Z",
    status: VerifiedMarketCalendarSessionStatus.HolidayClosed,
  });
  const thursday = calendarEvidence({
    sessionDate: "2026-07-02",
    marketOpen: "2026-07-02T13:30:00.000Z",
    marketClose: "2026-07-02T20:00:00.000Z",
    status: VerifiedMarketCalendarSessionStatus.Completed,
  });
  const holiday = calendarEvidence({
    sessionDate: "2026-07-03",
    marketOpen: "2026-07-03T13:30:00.000Z",
    marketClose: "2026-07-03T20:00:00.000Z",
    status: VerifiedMarketCalendarSessionStatus.HolidayClosed,
  });
  assert(latestCompletedTradingSession("2026-08-01T16:00:00.000Z", [friday, saturday])?.sessionDate === "2026-07-31", "weekend must use Friday");
  assert(latestCompletedTradingSession("2026-07-03T16:00:00.000Z", [thursday, holiday])?.sessionDate === "2026-07-02", "market holiday must use prior completed session");
});

test("early-close and DST boundaries use explicit exchange timestamps rather than UTC dates", () => {
  const earlyClose = calendarEvidence({
    sessionDate: "2026-11-27",
    marketOpen: "2026-11-27T14:30:00.000Z",
    marketClose: "2026-11-27T18:00:00.000Z",
    status: VerifiedMarketCalendarSessionStatus.Completed,
  });
  assert(latestCompletedTradingSession("2026-11-27T18:00:05.000Z", [earlyClose])?.sessionDate === "2026-11-27", "early close must honor explicit close plus buffer");

  const preDstFriday = calendarEvidence({
    sessionDate: "2026-03-06",
    marketOpen: "2026-03-06T14:30:00.000Z",
    marketClose: "2026-03-06T21:00:00.000Z",
    status: VerifiedMarketCalendarSessionStatus.Completed,
  });
  const postDstMondayScheduled = calendarEvidence({
    sessionDate: "2026-03-09",
    marketOpen: "2026-03-09T13:30:00.000Z",
    marketClose: "2026-03-09T20:00:00.000Z",
    status: VerifiedMarketCalendarSessionStatus.Scheduled,
  });
  const postDstMondayCompleted = calendarEvidence({
    sessionDate: "2026-03-09",
    marketOpen: "2026-03-09T13:30:00.000Z",
    marketClose: "2026-03-09T20:00:00.000Z",
    status: VerifiedMarketCalendarSessionStatus.Completed,
  });
  assert(latestCompletedTradingSession("2026-03-09T12:00:00.000Z", [preDstFriday, postDstMondayScheduled])?.sessionDate === "2026-03-06", "post-DST premarket must select Friday");
  assert(latestCompletedTradingSession("2026-03-09T20:00:05.000Z", [preDstFriday, postDstMondayCompleted])?.sessionDate === "2026-03-09", "post-DST close must select Monday");
  assert(exchangeLocalDate("2026-03-09T02:00:00.000Z", "America/New_York") === "2026-03-08", "exchange date must not be inferred from UTC date");
});

test("snapshot validation rejects unclosed, wrong-status, missing-current-date, and wrong-session evidence", () => {
  const source = buildOfflinePersonalDailyScanFixture().snapshotInput;
  const current = source.sessionCalendarEvidence.find((entry) => entry.sessionDate === "2026-07-28")!;
  const scheduled = calendarEvidence({
    sessionDate: current.sessionDate,
    marketOpen: current.marketOpen,
    marketClose: current.marketClose,
    status: VerifiedMarketCalendarSessionStatus.Scheduled,
    closureBufferSeconds: current.closureBufferSeconds,
  });
  const cases: readonly unknown[] = [
    { ...source, asOf: "2026-07-28T20:00:03.000Z" },
    { ...source, sessionCalendarEvidence: source.sessionCalendarEvidence.map((entry) => entry.sessionDate === current.sessionDate ? scheduled : entry) },
    { ...source, sessionCalendarEvidence: source.sessionCalendarEvidence.filter((entry) => entry.sessionDate !== "2026-07-28") },
    { ...source, session: { ...source.session, sessionId: "session:2026-07-27:regular", sessionDate: "2026-07-27" } },
  ];
  for (const input of cases)
    assert(validateVerifiedMarketSnapshotInput(input).issues.some((entry) => entry.code === VerifiedMarketSnapshotIssueCode.InvalidSessionEvidence), "invalid completed-session claim must fail closed");
});

test("VIX remains independent unavailable evidence and missing benchmark blocks", () => {
  const fixture = buildOfflinePersonalDailyScanFixture();
  assert(fixture.snapshotInput.benchmarkInstrumentIds.length === 2, "QQQ and SMH must remain benchmark evidence");
  assert(fixture.benchmarkEvidenceStatus === "AVAILABLE", "fixture benchmark evidence must be available");
  assert(fixture.volatilityEvidenceStatus === "UNAVAILABLE", "VIX cannot be fabricated");
  const blocked = composeVerifiedMarketSnapshot({
    ...fixture.snapshotInput,
    requiredEvidenceStatus: { ...fixture.snapshotInput.requiredEvidenceStatus, benchmarks: "MISSING" },
    blockingReasons: ["BENCHMARK_REQUIRED_MISSING"],
  });
  assert(blocked.status === "BLOCKED", "missing required benchmark must block");
});

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
console.log(`Verified Market Snapshot: ${passed}/${tests.length} tests passed.`);
