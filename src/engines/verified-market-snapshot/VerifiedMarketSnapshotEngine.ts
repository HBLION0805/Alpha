import { createHash } from "node:crypto";
import { BarInterval } from "../../contracts/CanonicalBar";
import {
  canonicalizeDeterministicValue,
  deterministicFingerprint,
} from "../../contracts/DeterministicFingerprint";
import type { PersonalMarketDataCompositionRequest } from "../../contracts/PersonalMarketDataComposition";
import {
  VERIFIED_MARKET_SNAPSHOT_SCHEMA_VERSION,
  VerifiedMarketDataOrigin,
  VerifiedMarketCalendarSessionStatus,
  VerifiedMarketEvidenceResolutionResult,
  VerifiedMarketEvidenceStatus,
  VerifiedMarketProviderAttemptResult,
  VerifiedMarketProviderCapability,
  VerifiedMarketSnapshotIssueCode,
  VerifiedMarketSnapshotStatus,
  type CanonicalBarReference,
  type CanonicalQuoteReference,
  type EvidenceResolution,
  type ProviderRequestAttempt,
  type VerifiedMarketCalendarSessionEvidence,
  type VerifiedMarketFreshnessQualityPolicy,
  type VerifiedMarketSnapshot,
  type VerifiedMarketSnapshotCompositionBinding,
  type VerifiedMarketSnapshotInput,
  type VerifiedMarketSnapshotIssue,
  type VerifiedMarketSnapshotValidationResult,
} from "../../contracts/VerifiedMarketSnapshot";

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9:._/-]{2,159}$/u;
const FINGERPRINT = /^fnv1a64:[a-f0-9]{16}$/u;
const SHA256_FINGERPRINT = /^sha256:[a-f0-9]{64}$/u;
const REQUIRED_INTERVALS = [
  BarInterval.OneDay,
  BarInterval.OneHour,
  BarInterval.FifteenMinutes,
  BarInterval.FiveMinutes,
] as const;

export class VerifiedMarketSnapshotValidationError extends Error {
  public constructor(
    public readonly issues: readonly VerifiedMarketSnapshotIssue[],
  ) {
    super("Verified Market Snapshot validation failed.");
    this.name = "VerifiedMarketSnapshotValidationError";
  }
}

export function composeVerifiedMarketSnapshot(
  raw: unknown,
): VerifiedMarketSnapshot {
  const validation = validateVerifiedMarketSnapshotInput(raw);
  if (!validation.valid)
    throw new VerifiedMarketSnapshotValidationError(validation.issues);
  const input = raw as VerifiedMarketSnapshotInput;
  const immutableInput = canonicalizeDeterministicValue(input);
  const snapshotFingerprint = deterministicFingerprint(input);
  return freeze({
    ...input,
    snapshotId: `verified-market-snapshot:${deterministicFingerprint({ asOf: input.asOf, immutableInput }).slice(-16)}`,
    status:
      input.blockingReasons.length === 0
        ? VerifiedMarketSnapshotStatus.Verified
        : VerifiedMarketSnapshotStatus.Blocked,
    snapshotFingerprint,
    deterministic: true as const,
    readOnly: true as const,
    providerNativePayloadStored: false as const,
  });
}

/** Enforces exact Snapshot A -> Composition A evidence identity after both objects are materialized. */
export function validateVerifiedMarketSnapshotCompositionBinding(
  snapshot: VerifiedMarketSnapshot,
  composition: PersonalMarketDataCompositionRequest,
): VerifiedMarketSnapshotValidationResult {
  const expected = compositionBindingFromRequest(composition);
  const issues: VerifiedMarketSnapshotIssue[] = [];
  if (
    canonicalizeDeterministicValue(snapshot.compositionBinding) !==
    canonicalizeDeterministicValue(expected)
  ) {
    issues.push(
      issue(
        VerifiedMarketSnapshotIssueCode.CompositionBindingMismatch,
        "compositionBinding",
        "Snapshot evidence is not the exact Composition evidence set.",
      ),
    );
  }
  return freezeValidation(issues);
}

export function compositionBindingFromRequest(
  request: PersonalMarketDataCompositionRequest,
): VerifiedMarketSnapshotCompositionBinding {
  return freeze({
    mappingRegistryId: request.mappingRegistry.registryId,
    mappingRegistryVersion: request.mappingRegistry.version,
    mappingRegistryFingerprint: verifiedMappingRegistryFingerprint({
      mappingRegistryId: request.mappingRegistry.registryId,
      mappingRegistryVersion: request.mappingRegistry.version,
    }),
    profileId: request.profileId,
    profileVersion: request.profileVersion,
    candidates: request.candidates
      .map((candidate) => ({
        candidateId: candidate.candidateId,
        analysisInstrumentId: candidate.mapping.analysisInstrument.instrumentId,
        tradeVehicleId: candidate.mapping.tradeVehicle.instrumentId,
        timeframes: [...candidate.timeframes]
          .sort((a, b) => a.interval.localeCompare(b.interval))
          .map((timeframe) => ({
            interval: timeframe.interval,
            startBarId: timeframe.start.barId,
            startBarFingerprint: timeframe.start.fingerprint,
            endBarId: timeframe.end.barId,
            endBarFingerprint: timeframe.end.fingerprint,
          })),
        quoteId: candidate.quote.quoteId,
        quoteFingerprint: candidate.quote.fingerprint,
      }))
      .sort((a, b) => a.candidateId.localeCompare(b.candidateId)),
  });
}

export function verifiedMappingRegistryFingerprint(input: {
  readonly mappingRegistryId: string;
  readonly mappingRegistryVersion: string;
  readonly contentEntries?: readonly {
    readonly entryId: string;
    readonly content: unknown;
  }[];
}): string {
  const descriptor = input.contentEntries === undefined
    ? input
    : {
        mappingRegistryId: input.mappingRegistryId,
        mappingRegistryVersion: input.mappingRegistryVersion,
        contentEntries: [...input.contentEntries]
          .map((entry) => ({ entryId: entry.entryId, content: entry.content }))
          .sort((left, right) => left.entryId.localeCompare(right.entryId)),
      };
  return `sha256:${createHash("sha256")
    .update(canonicalizeDeterministicValue(descriptor), "utf8")
    .digest("hex")}`;
}

export function verifiedProviderSymbolMappingFingerprint(input: {
  readonly canonicalInstrumentId: string;
  readonly providerSymbol: string;
  readonly providerSymbolMappingVersion: string;
}): string {
  return deterministicFingerprint(input);
}

export function verifiedProviderRequestFingerprint(input: {
  readonly requestAttemptId: string;
  readonly requestId: string;
  readonly requestedProvider: string;
  readonly capability: VerifiedMarketProviderCapability;
  readonly interval?: BarInterval;
  readonly requestedSymbolScope: readonly string[];
  readonly mappingRegistryId: string;
  readonly mappingRegistryVersion: string;
  readonly mappingRegistryFingerprint: string;
  readonly requestWindowStart: string;
  readonly requestWindowEnd: string;
}): string {
  return deterministicFingerprint(input);
}

export function verifiedEvidenceResolutionFingerprint(
  input: Omit<EvidenceResolution, "resolutionFingerprint">,
): string {
  return deterministicFingerprint(input);
}

/** Selects from explicit exchange-calendar evidence; it never infers a session from the UTC date. */
export function latestCompletedTradingSession(
  asOf: string,
  exchangeCalendar: readonly VerifiedMarketCalendarSessionEvidence[],
): VerifiedMarketCalendarSessionEvidence | undefined {
  if (!timestamp(asOf)) return undefined;
  return [...exchangeCalendar]
    .filter(
      (entry) =>
        entry.status === VerifiedMarketCalendarSessionStatus.Completed &&
        timestamp(entry.marketClose) &&
        Date.parse(entry.marketClose) +
          entry.closureBufferSeconds * 1_000 <=
          Date.parse(asOf),
    )
    .sort((left, right) => right.marketClose.localeCompare(left.marketClose))[0];
}

export function exchangeLocalDate(asOf: string, timezone: string): string {
  if (!timestamp(asOf)) return "";
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date(asOf));
    const value = Object.fromEntries(
      parts.map((part) => [part.type, part.value]),
    );
    return `${value.year}-${value.month}-${value.day}`;
  } catch {
    return "";
  }
}

export function validateVerifiedMarketSnapshotInput(
  raw: unknown,
): VerifiedMarketSnapshotValidationResult {
  const issues: VerifiedMarketSnapshotIssue[] = [];
  if (!record(raw))
    return freezeValidation([
      issue(
        VerifiedMarketSnapshotIssueCode.InvalidRecord,
        "$",
        "Snapshot input must be an object.",
      ),
    ]);
  allowOnly(
    raw,
    [
      "schemaVersion",
      "asOf",
      "session",
      "sessionCalendarEvidence",
      "analysisInstrumentIds",
      "tradeVehicleIds",
      "benchmarkInstrumentIds",
      "canonicalBarReferences",
      "canonicalQuoteReferences",
      "providerRequestAttempts",
      "evidenceResolutions",
      "freshnessQualityPolicy",
      "compositionBinding",
      "requiredEvidenceStatus",
      "volatilityEvidenceStatus",
      "blockingReasons",
    ],
    "$",
    issues,
  );
  if (
    raw.schemaVersion !== VERIFIED_MARKET_SNAPSHOT_SCHEMA_VERSION ||
    !timestamp(raw.asOf)
  )
    return freezeValidation([
      issue(
        VerifiedMarketSnapshotIssueCode.InvalidRecord,
        "$",
        "Schema version or as-of time is invalid.",
      ),
      ...issues,
    ]);
  const policy = validatePolicy(raw.freshnessQualityPolicy, issues);
  const calendarEvidence = validateSessionCalendarEvidence(
    raw.sessionCalendarEvidence,
    raw.asOf,
    issues,
  );
  if (
    policy !== undefined &&
    [...calendarEvidence.values()].some(
      (entry) =>
        entry.status !== VerifiedMarketCalendarSessionStatus.HolidayClosed &&
        entry.closureBufferSeconds !== policy.closureBufferSeconds,
    )
  )
    issues.push(
      issue(
        VerifiedMarketSnapshotIssueCode.InvalidSessionEvidence,
        "sessionCalendarEvidence",
        "Session closure buffer must match the reviewed freshness policy.",
      ),
    );
  const selectedSession = validateSession(
    raw.session,
    raw.asOf,
    calendarEvidence,
    issues,
  );
  const analysis = identifiers(
    raw.analysisInstrumentIds,
    "analysisInstrumentIds",
    issues,
  );
  const vehicles = identifiers(raw.tradeVehicleIds, "tradeVehicleIds", issues);
  const benchmarks = identifiers(
    raw.benchmarkInstrumentIds,
    "benchmarkInstrumentIds",
    issues,
  );
  const declared = new Set([...analysis, ...vehicles, ...benchmarks]);
  if (declared.size !== analysis.length + vehicles.length + benchmarks.length)
    issues.push(
      issue(
        VerifiedMarketSnapshotIssueCode.IdentityMismatch,
        "instrumentIds",
        "Analysis, vehicle, and benchmark identities must not overlap.",
      ),
    );
  const bars = validateBars(
    raw.canonicalBarReferences,
    raw.asOf,
    declared,
    policy,
    calendarEvidence,
    issues,
  );
  const quotes = validateQuotes(
    raw.canonicalQuoteReferences,
    raw.asOf,
    declared,
    policy,
    issues,
  );
  validateAnalysisTimeframeBarSets(
    analysis,
    bars,
    selectedSession,
    calendarEvidence,
    issues,
  );
  const binding = validateBinding(
    raw.compositionBinding,
    analysis,
    vehicles,
    bars,
    quotes,
    selectedSession,
    calendarEvidence,
    issues,
  );
  validateBenchmarkCoverage(benchmarks, bars, issues);
  validateProviderTrace(
    raw.providerRequestAttempts,
    raw.evidenceResolutions,
    raw.asOf,
    bars,
    quotes,
    binding?.mappingRegistryId,
    binding?.mappingRegistryVersion,
    binding?.mappingRegistryFingerprint,
    issues,
  );
  validateRequiredEvidence(raw.requiredEvidenceStatus, issues);
  if (
    !Object.values(VerifiedMarketEvidenceStatus).includes(
      raw.volatilityEvidenceStatus as VerifiedMarketEvidenceStatus,
    )
  )
    issues.push(
      issue(
        VerifiedMarketSnapshotIssueCode.InvalidRecord,
        "volatilityEvidenceStatus",
        "Volatility evidence status is invalid.",
      ),
    );
  if (
    !Array.isArray(raw.blockingReasons) ||
    new Set(raw.blockingReasons).size !== raw.blockingReasons.length ||
    raw.blockingReasons.some(
      (value) => typeof value !== "string" || !IDENTIFIER.test(value),
    )
  )
    issues.push(
      issue(
        VerifiedMarketSnapshotIssueCode.InvalidRecord,
        "blockingReasons",
        "Blocking reasons must be unique declared identifiers.",
      ),
    );
  const required = raw.requiredEvidenceStatus as Record<string, unknown>;
  if (
    record(required) &&
    Object.values(required).some(
      (value) => value !== VerifiedMarketEvidenceStatus.Available,
    ) &&
    (!Array.isArray(raw.blockingReasons) || raw.blockingReasons.length === 0)
  )
    issues.push(
      issue(
        VerifiedMarketSnapshotIssueCode.MissingRequiredEvidence,
        "blockingReasons",
        "Unavailable required evidence must have an explicit blocker.",
      ),
    );
  void binding;
  return freezeValidation(issues);
}

function validateSession(
  value: unknown,
  asOf: string,
  calendarEvidence: ReadonlyMap<string, VerifiedMarketCalendarSessionEvidence>,
  issues: VerifiedMarketSnapshotIssue[],
): VerifiedMarketCalendarSessionEvidence | undefined {
  if (!record(value)) {
    issues.push(
      issue(
        VerifiedMarketSnapshotIssueCode.InvalidRecord,
        "session",
        "Session identity is required.",
      ),
    );
    return undefined;
  }
  allowOnly(
    value,
    ["calendarId", "sessionId", "sessionDate", "sessionType", "timezone"],
    "session",
    issues,
  );
  if (
    ![value.calendarId, value.sessionId, value.timezone].every(
      (item) => typeof item === "string" && IDENTIFIER.test(item),
    ) ||
    typeof value.sessionDate !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/u.test(value.sessionDate) ||
    !["REGULAR", "EXTENDED"].includes(String(value.sessionType))
  )
    issues.push(
      issue(
        VerifiedMarketSnapshotIssueCode.InvalidRecord,
        "session",
        "Session identity is invalid.",
      ),
    );
  const sessionDate =
    typeof value.sessionDate === "string" ? value.sessionDate : "";
  const idDate =
    typeof value.sessionId === "string"
      ? /^session:(\d{4}-\d{2}-\d{2}):/u.exec(value.sessionId)?.[1]
      : undefined;
  const timezone = typeof value.timezone === "string" ? value.timezone : "";
  const localAsOfDate = exchangeLocalDate(asOf, timezone);
  const exchangeCalendar = [...calendarEvidence.values()].filter(
    (entry) =>
      entry.calendarId === value.calendarId &&
      entry.sessionType === value.sessionType &&
      entry.timezone === value.timezone,
  );
  const currentDateEvidence = exchangeCalendar.find(
    (entry) => entry.sessionDate === localAsOfDate,
  );
  const latest = latestCompletedTradingSession(
    asOf,
    exchangeCalendar,
  );
  const invalid =
    idDate !== sessionDate ||
    exchangeCalendar.length !== calendarEvidence.size ||
    currentDateEvidence === undefined ||
    latest === undefined ||
    latest.sessionDate !== sessionDate ||
    latest.calendarId !== value.calendarId ||
    latest.sessionId !== value.sessionId ||
    latest.sessionType !== value.sessionType ||
    latest.timezone !== value.timezone;
  if (invalid)
    issues.push(
      issue(
        VerifiedMarketSnapshotIssueCode.InvalidSessionEvidence,
        "session",
        "Snapshot session must bind exact evidence for a completed trading session.",
      ),
    );
  return invalid ? undefined : latest;
}

/** Reuse calendar validation without fabricating quote or request evidence. */
export function validateVerifiedMarketCalendarEvidence(
  value: unknown,
  asOf: string,
): VerifiedMarketSnapshotValidationResult {
  const issues: VerifiedMarketSnapshotIssue[] = [];
  if (!timestamp(asOf)) {
    issues.push(issue(VerifiedMarketSnapshotIssueCode.InvalidSessionEvidence,
      "asOf", "A canonical as-of timestamp is required."));
  } else {
    validateSessionCalendarEvidence(value, asOf, issues);
  }
  return Object.freeze({ valid: issues.length === 0, issues: Object.freeze(issues) });
}

function validateSessionCalendarEvidence(
  value: unknown,
  asOf: string,
  issues: VerifiedMarketSnapshotIssue[],
): ReadonlyMap<string, VerifiedMarketCalendarSessionEvidence> {
  if (!Array.isArray(value) || value.length === 0) {
    issues.push(
      issue(
        VerifiedMarketSnapshotIssueCode.InvalidSessionEvidence,
        "sessionCalendarEvidence",
        "Explicit calendar/session evidence is required.",
      ),
    );
    return new Map();
  }
  const byDate = new Map<string, VerifiedMarketCalendarSessionEvidence>();
  value.forEach((entry, index) => {
    const field = `sessionCalendarEvidence[${index}]`;
    if (!record(entry)) {
      issues.push(
        issue(
          VerifiedMarketSnapshotIssueCode.InvalidSessionEvidence,
          field,
          "Calendar/session evidence must be an object.",
        ),
      );
      return;
    }
    allowOnly(
      entry,
      [
        "calendarEvidenceId",
        "calendarEvidenceFingerprint",
        "calendarId",
        "sessionId",
        "sessionDate",
        "sessionType",
        "timezone",
        "marketOpen",
        "marketClose",
        "closureBufferSeconds",
        "status",
        "provenanceReference",
        "dataOrigin",
      ],
      field,
      issues,
    );
    const sessionDate =
      typeof entry.sessionDate === "string" ? entry.sessionDate : "";
    const identityValid =
      [
        entry.calendarEvidenceId,
        entry.calendarId,
        entry.sessionId,
        entry.timezone,
        entry.provenanceReference,
      ].every(
        (item) => typeof item === "string" && IDENTIFIER.test(item),
      ) &&
      /^\d{4}-\d{2}-\d{2}$/u.test(sessionDate) &&
      ["REGULAR", "EXTENDED"].includes(String(entry.sessionType)) &&
      timestamp(entry.marketOpen) &&
      timestamp(entry.marketClose) &&
      Date.parse(String(entry.marketOpen)) <
        Date.parse(String(entry.marketClose)) &&
      Number.isSafeInteger(entry.closureBufferSeconds) &&
      Number(entry.closureBufferSeconds) >= 0 &&
      Number(entry.closureBufferSeconds) <= 300 &&
      Object.values(VerifiedMarketCalendarSessionStatus).includes(
        entry.status as VerifiedMarketCalendarSessionStatus,
      ) &&
      Object.values(VerifiedMarketDataOrigin).includes(
        entry.dataOrigin as VerifiedMarketDataOrigin,
      );
    const fingerprintInput = {
      calendarEvidenceId: entry.calendarEvidenceId,
      calendarId: entry.calendarId,
      sessionId: entry.sessionId,
      sessionDate: entry.sessionDate,
      sessionType: entry.sessionType,
      timezone: entry.timezone,
      marketOpen: entry.marketOpen,
      marketClose: entry.marketClose,
      closureBufferSeconds: entry.closureBufferSeconds,
      status: entry.status,
      provenanceReference: entry.provenanceReference,
      dataOrigin: entry.dataOrigin,
    };
    if (
      !identityValid ||
      entry.calendarEvidenceFingerprint !==
        deterministicFingerprint(fingerprintInput) ||
      String(entry.sessionId) !== `session:${sessionDate}:regular` ||
      String(entry.marketOpen).slice(0, 10) !== sessionDate ||
      String(entry.marketClose).slice(0, 10) !== sessionDate ||
      byDate.has(sessionDate)
    ) {
      issues.push(
        issue(
          VerifiedMarketSnapshotIssueCode.InvalidSessionEvidence,
          field,
          "Calendar/session identity, fingerprint, chronology, or uniqueness is invalid.",
        ),
      );
      return;
    }
    const closureComplete =
      Date.parse(String(entry.marketClose)) +
        Number(entry.closureBufferSeconds) * 1_000 <=
      Date.parse(asOf);
    if (
      (entry.status === VerifiedMarketCalendarSessionStatus.Completed &&
        !closureComplete) ||
      (entry.status === VerifiedMarketCalendarSessionStatus.Scheduled &&
        closureComplete)
    ) {
      issues.push(
        issue(
          VerifiedMarketSnapshotIssueCode.InvalidSessionEvidence,
          field,
          "Calendar status must match the as-of closure boundary.",
        ),
      );
      return;
    }
    if (
      entry.status !== VerifiedMarketCalendarSessionStatus.HolidayClosed &&
      [0, 6].includes(
        new Date(`${sessionDate}T12:00:00.000Z`).getUTCDay(),
      )
    ) {
      issues.push(
        issue(
          VerifiedMarketSnapshotIssueCode.InvalidSessionEvidence,
          field,
          "Weekend dates cannot be completed trading sessions.",
        ),
      );
      return;
    }
    byDate.set(
      sessionDate,
      entry as unknown as VerifiedMarketCalendarSessionEvidence,
    );
  });
  return byDate;
}
function identifiers(
  value: unknown,
  field: string,
  issues: VerifiedMarketSnapshotIssue[],
): string[] {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    new Set(value).size !== value.length ||
    value.some((item) => typeof item !== "string" || !IDENTIFIER.test(item))
  ) {
    issues.push(
      issue(
        VerifiedMarketSnapshotIssueCode.InvalidIdentifier,
        field,
        "Instrument IDs must be unique declared identifiers.",
      ),
    );
    return [];
  }
  return [...value] as string[];
}
function validateBars(
  value: unknown,
  asOf: string,
  declared: ReadonlySet<string>,
  policy: VerifiedMarketFreshnessQualityPolicy | undefined,
  calendarEvidence: ReadonlyMap<string, VerifiedMarketCalendarSessionEvidence>,
  issues: VerifiedMarketSnapshotIssue[],
): CanonicalBarReference[] {
  if (!Array.isArray(value) || value.length === 0) {
    issues.push(
      issue(
        VerifiedMarketSnapshotIssueCode.InvalidRecord,
        "canonicalBarReferences",
        "Canonical Bar references are required.",
      ),
    );
    return [];
  }
  const ids = new Set<string>();
  return value.flatMap((entry, index) => {
    const field = `canonicalBarReferences[${index}]`;
    if (!record(entry)) {
      issues.push(
        issue(
          VerifiedMarketSnapshotIssueCode.InvalidRecord,
          field,
          "Bar reference is invalid.",
        ),
      );
      return [];
    }
    allowOnly(
      entry,
      [
        "canonicalBarId",
        "canonicalBarFingerprint",
        "canonicalInstrumentId",
        "interval",
        "intervalStart",
        "intervalEnd",
        "observationTime",
        "sessionDate",
        "status",
        "freshness",
        "provenanceReference",
      ],
      field,
      issues,
    );
    if (
      typeof entry.provenanceReference !== "string" ||
      !IDENTIFIER.test(entry.provenanceReference)
    )
      issues.push(
        issue(
          VerifiedMarketSnapshotIssueCode.MissingProvenance,
          field,
          "Bar provenance is required.",
        ),
      );
    if (
      ![entry.canonicalBarId, entry.canonicalInstrumentId].every(
        (item) => typeof item === "string" && IDENTIFIER.test(item),
      ) ||
      typeof entry.canonicalBarFingerprint !== "string" ||
      !FINGERPRINT.test(entry.canonicalBarFingerprint) ||
      !timestamp(entry.intervalStart) ||
      !timestamp(entry.intervalEnd) ||
      !timestamp(entry.observationTime) ||
      typeof entry.sessionDate !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/u.test(entry.sessionDate) ||
      !REQUIRED_INTERVALS.includes(
        entry.interval as (typeof REQUIRED_INTERVALS)[number],
      ) ||
      !["CURRENT", "STALE"].includes(String(entry.freshness))
    )
      issues.push(
        issue(
          VerifiedMarketSnapshotIssueCode.InvalidRecord,
          field,
          "Bar identity, interval, fingerprint, or time is invalid.",
        ),
      );
    if (!declared.has(String(entry.canonicalInstrumentId)))
      issues.push(
        issue(
          VerifiedMarketSnapshotIssueCode.IdentityMismatch,
          field,
          "Bar instrument is outside the declared snapshot scope.",
        ),
      );
    if (entry.status !== "FINAL")
      issues.push(
        issue(
          VerifiedMarketSnapshotIssueCode.IncompleteBar,
          field,
          "Only completed FINAL Bars are accepted.",
        ),
      );
    const interval = entry.interval as BarInterval;
    const start = timestamp(entry.intervalStart)
      ? Date.parse(entry.intervalStart)
      : Number.NaN;
    const end = timestamp(entry.intervalEnd)
      ? Date.parse(entry.intervalEnd)
      : Number.NaN;
    const observation = timestamp(entry.observationTime)
      ? Date.parse(entry.observationTime)
      : Number.NaN;
    const snapshotTime = Date.parse(asOf);
    const session =
      typeof entry.sessionDate === "string"
        ? calendarEvidence.get(entry.sessionDate)
        : undefined;
    const duration =
      interval === BarInterval.OneHour
        ? 3_600_000
        : interval === BarInterval.FifteenMinutes
          ? 900_000
          : interval === BarInterval.FiveMinutes
            ? 300_000
            : undefined;
    const completedWindow =
      session !== undefined &&
      session.status === VerifiedMarketCalendarSessionStatus.Completed &&
      start >= Date.parse(session.marketOpen) &&
      end <= Date.parse(session.marketClose) &&
      observation >= end &&
      (duration === undefined
        ? start === Date.parse(session.marketOpen) &&
          end === Date.parse(session.marketClose)
        : end - start === duration) &&
      end + session.closureBufferSeconds * 1_000 <= snapshotTime;
    if (!completedWindow)
      issues.push(
        issue(
          VerifiedMarketSnapshotIssueCode.IncompleteBar,
          field,
          "Bar must bind a completed interval inside explicit trading-session evidence.",
        ),
      );
    if (
      timestamp(entry.intervalEnd) &&
      Date.parse(entry.intervalEnd) > Date.parse(asOf)
    )
      issues.push(
        issue(
          VerifiedMarketSnapshotIssueCode.FutureObservation,
          field,
          "Future Bar observations are blocked.",
        ),
      );
    if (
      timestamp(entry.observationTime) &&
      Date.parse(entry.observationTime) > Date.parse(asOf)
    )
      issues.push(
        issue(
          VerifiedMarketSnapshotIssueCode.FutureObservation,
          field,
          "Future Bar observation times are blocked.",
        ),
      );
    if (
      typeof entry.canonicalBarId === "string" &&
      ids.has(entry.canonicalBarId)
    )
      issues.push(
        issue(
          VerifiedMarketSnapshotIssueCode.IdentityMismatch,
          field,
          "Canonical Bar identity is duplicated.",
        ),
      );
    ids.add(String(entry.canonicalBarId));
    return [entry as unknown as CanonicalBarReference];
  });
}

function validateAnalysisTimeframeBarSets(
  analysis: readonly string[],
  bars: readonly CanonicalBarReference[],
  selectedSession: VerifiedMarketCalendarSessionEvidence | undefined,
  calendarEvidence: ReadonlyMap<string, VerifiedMarketCalendarSessionEvidence>,
  issues: VerifiedMarketSnapshotIssue[],
): void {
  if (selectedSession === undefined) return;
  const completedSessions = [...calendarEvidence.values()]
    .filter(
      (entry) =>
        entry.status === VerifiedMarketCalendarSessionStatus.Completed &&
        entry.calendarId === selectedSession.calendarId &&
        entry.sessionType === selectedSession.sessionType &&
        entry.timezone === selectedSession.timezone &&
        entry.marketClose <= selectedSession.marketClose,
    )
    .sort((left, right) => left.marketClose.localeCompare(right.marketClose));
  const selectedIndex = completedSessions.findIndex(
    (entry) => entry.sessionId === selectedSession.sessionId,
  );
  const priorSession =
    selectedIndex > 0 ? completedSessions[selectedIndex - 1] : undefined;
  for (const instrumentId of analysis) {
    for (const interval of REQUIRED_INTERVALS) {
      const field = `canonicalBarReferences.${instrumentId}.${interval}`;
      const group = bars.filter(
        (bar) =>
          bar.canonicalInstrumentId === instrumentId &&
          bar.interval === interval,
      );
      if (group.length !== 2) {
        issues.push(
          issue(
            VerifiedMarketSnapshotIssueCode.TimeframeBarCountMismatch,
            field,
            "Each analysis instrument and interval requires exactly two finalized Bars.",
          ),
        );
        continue;
      }
      const ordered = [...group].sort((left, right) =>
        left.intervalEnd.localeCompare(right.intervalEnd),
      );
      const [start, end] = ordered;
      const exactIdentity =
        start !== undefined &&
        end !== undefined &&
        start.canonicalBarId !== end.canonicalBarId &&
        start.canonicalBarFingerprint !== end.canonicalBarFingerprint &&
        start.intervalEnd < end.intervalEnd;
      const exactSessions =
        interval === BarInterval.OneDay
          ? priorSession !== undefined &&
            start?.sessionDate === priorSession.sessionDate &&
            end?.sessionDate === selectedSession.sessionDate
          : start?.sessionDate === selectedSession.sessionDate &&
            end?.sessionDate === selectedSession.sessionDate;
      if (!exactIdentity || !exactSessions)
        issues.push(
          issue(
            VerifiedMarketSnapshotIssueCode.TimeframeBarBindingInvalid,
            field,
            interval === BarInterval.OneDay
              ? "P1D endpoints must be distinct, ordered prior-session and selected-session Bars."
              : "Intraday endpoints must be distinct, ordered, and both belong to the selected session.",
          ),
        );
    }
  }
}

function validateQuotes(
  value: unknown,
  asOf: string,
  declared: ReadonlySet<string>,
  policy: VerifiedMarketFreshnessQualityPolicy | undefined,
  issues: VerifiedMarketSnapshotIssue[],
): CanonicalQuoteReference[] {
  if (!Array.isArray(value) || value.length === 0) {
    issues.push(
      issue(
        VerifiedMarketSnapshotIssueCode.InvalidRecord,
        "canonicalQuoteReferences",
        "Canonical Quote references are required.",
      ),
    );
    return [];
  }
  const ids = new Set<string>();
  return value.flatMap((entry, index) => {
    const field = `canonicalQuoteReferences[${index}]`;
    if (!record(entry)) {
      issues.push(
        issue(
          VerifiedMarketSnapshotIssueCode.InvalidRecord,
          field,
          "Quote reference is invalid.",
        ),
      );
      return [];
    }
    allowOnly(
      entry,
      [
        "canonicalQuoteId",
        "canonicalQuoteFingerprint",
        "canonicalInstrumentId",
        "observationTime",
        "status",
        "provenanceReference",
      ],
      field,
      issues,
    );
    if (
      typeof entry.provenanceReference !== "string" ||
      !IDENTIFIER.test(entry.provenanceReference)
    )
      issues.push(
        issue(
          VerifiedMarketSnapshotIssueCode.MissingProvenance,
          field,
          "Quote provenance is required.",
        ),
      );
    if (
      ![entry.canonicalQuoteId, entry.canonicalInstrumentId].every(
        (item) => typeof item === "string" && IDENTIFIER.test(item),
      ) ||
      typeof entry.canonicalQuoteFingerprint !== "string" ||
      !FINGERPRINT.test(entry.canonicalQuoteFingerprint) ||
      !timestamp(entry.observationTime)
    )
      issues.push(
        issue(
          VerifiedMarketSnapshotIssueCode.InvalidRecord,
          field,
          "Quote identity, fingerprint, or time is invalid.",
        ),
      );
    if (!declared.has(String(entry.canonicalInstrumentId)))
      issues.push(
        issue(
          VerifiedMarketSnapshotIssueCode.IdentityMismatch,
          field,
          "Quote instrument is outside the declared snapshot scope.",
        ),
      );
    const quoteAgeMilliseconds = timestamp(entry.observationTime)
      ? Date.parse(asOf) - Date.parse(entry.observationTime)
      : Number.NaN;
    const computedCurrent =
      policy !== undefined &&
      quoteAgeMilliseconds >= 0 &&
      quoteAgeMilliseconds <= policy.quoteMaxAgeSeconds * 1_000;
    if (entry.status !== "CURRENT" || !computedCurrent)
      issues.push(
        issue(
          VerifiedMarketSnapshotIssueCode.StaleObservation,
          field,
          "Quote freshness is recomputed from policy and observation time; stale Quotes are blocked.",
        ),
      );
    if (
      timestamp(entry.observationTime) &&
      Date.parse(entry.observationTime) > Date.parse(asOf)
    )
      issues.push(
        issue(
          VerifiedMarketSnapshotIssueCode.FutureObservation,
          field,
          "Future Quote observations are blocked.",
        ),
      );
    if (
      typeof entry.canonicalQuoteId === "string" &&
      ids.has(entry.canonicalQuoteId)
    )
      issues.push(
        issue(
          VerifiedMarketSnapshotIssueCode.IdentityMismatch,
          field,
          "Canonical Quote identity is duplicated.",
        ),
      );
    ids.add(String(entry.canonicalQuoteId));
    return [entry as unknown as CanonicalQuoteReference];
  });
}

function validateBinding(
  value: unknown,
  analysis: readonly string[],
  vehicles: readonly string[],
  bars: readonly CanonicalBarReference[],
  quotes: readonly CanonicalQuoteReference[],
  selectedSession: VerifiedMarketCalendarSessionEvidence | undefined,
  calendarEvidence: ReadonlyMap<string, VerifiedMarketCalendarSessionEvidence>,
  issues: VerifiedMarketSnapshotIssue[],
): VerifiedMarketSnapshotCompositionBinding | undefined {
  if (!record(value)) {
    issues.push(
      issue(
        VerifiedMarketSnapshotIssueCode.CompositionBindingMismatch,
        "compositionBinding",
        "Exact Composition binding is required.",
      ),
    );
    return undefined;
  }
  allowOnly(
    value,
    [
      "mappingRegistryId",
      "mappingRegistryVersion",
      "mappingRegistryFingerprint",
      "profileId",
      "profileVersion",
      "candidates",
    ],
    "compositionBinding",
    issues,
  );
  if (
    ![
      value.mappingRegistryId,
      value.mappingRegistryVersion,
      value.profileId,
      value.profileVersion,
    ].every((entry) => typeof entry === "string" && IDENTIFIER.test(entry)) ||
    typeof value.mappingRegistryFingerprint !== "string" ||
    value.mappingRegistryFingerprint !== verifiedMappingRegistryFingerprint({
      mappingRegistryId: String(value.mappingRegistryId),
      mappingRegistryVersion: String(value.mappingRegistryVersion),
    }) ||
    !Array.isArray(value.candidates) ||
    value.candidates.length !== vehicles.length
  ) {
    issues.push(
      issue(
        VerifiedMarketSnapshotIssueCode.CompositionBindingMismatch,
        "compositionBinding",
        "Composition identity or candidate coverage is invalid.",
      ),
    );
    return undefined;
  }
  const barById = new Map(bars.map((bar) => [bar.canonicalBarId, bar]));
  const quoteById = new Map(
    quotes.map((quote) => [quote.canonicalQuoteId, quote]),
  );
  const consumedBars = new Set<string>();
  const consumedQuotes = new Set<string>();
  const candidates = new Set<string>();
  const boundAnalysis = new Set<string>();
  const boundVehicles = new Set<string>();
  const completedSessions = [...calendarEvidence.values()]
    .filter(
      (entry) =>
        selectedSession !== undefined &&
        entry.status === VerifiedMarketCalendarSessionStatus.Completed &&
        entry.calendarId === selectedSession.calendarId &&
        entry.sessionType === selectedSession.sessionType &&
        entry.timezone === selectedSession.timezone &&
        entry.marketClose <= selectedSession.marketClose,
    )
    .sort((left, right) => left.marketClose.localeCompare(right.marketClose));
  const selectedIndex =
    selectedSession === undefined
      ? -1
      : completedSessions.findIndex(
          (entry) => entry.sessionId === selectedSession.sessionId,
        );
  const priorSession =
    selectedIndex > 0 ? completedSessions[selectedIndex - 1] : undefined;
  for (const [index, raw] of value.candidates.entries()) {
    const field = `compositionBinding.candidates[${index}]`;
    if (!record(raw)) {
      issues.push(
        issue(
          VerifiedMarketSnapshotIssueCode.CompositionBindingMismatch,
          field,
          "Candidate binding is invalid.",
        ),
      );
      continue;
    }
    allowOnly(
      raw,
      [
        "candidateId",
        "analysisInstrumentId",
        "tradeVehicleId",
        "timeframes",
        "quoteId",
        "quoteFingerprint",
      ],
      field,
      issues,
    );
    if (
      ![
        raw.candidateId,
        raw.analysisInstrumentId,
        raw.tradeVehicleId,
        raw.quoteId,
      ].every((entry) => typeof entry === "string" && IDENTIFIER.test(entry)) ||
      typeof raw.quoteFingerprint !== "string" ||
      !FINGERPRINT.test(raw.quoteFingerprint) ||
      !analysis.includes(String(raw.analysisInstrumentId)) ||
      !vehicles.includes(String(raw.tradeVehicleId)) ||
      candidates.has(String(raw.candidateId))
    ) {
      issues.push(
        issue(
          VerifiedMarketSnapshotIssueCode.CompositionBindingMismatch,
          field,
          "Candidate identity is not declared exactly once.",
        ),
      );
      continue;
    }
    candidates.add(String(raw.candidateId));
    boundAnalysis.add(String(raw.analysisInstrumentId));
    boundVehicles.add(String(raw.tradeVehicleId));
    const quote = quoteById.get(String(raw.quoteId));
    if (
      quote === undefined ||
      quote.canonicalInstrumentId !== raw.tradeVehicleId ||
      quote.canonicalQuoteFingerprint !== raw.quoteFingerprint
    )
      issues.push(
        issue(
          VerifiedMarketSnapshotIssueCode.CompositionBindingMismatch,
          `${field}.quoteId`,
          "Candidate quote is not the exact declared Canonical Quote.",
        ),
      );
    else consumedQuotes.add(quote.canonicalQuoteId);
    if (
      !Array.isArray(raw.timeframes) ||
      raw.timeframes.length !== REQUIRED_INTERVALS.length ||
      new Set(
        raw.timeframes.map((entry) =>
          record(entry) ? entry.interval : undefined,
        ),
      ).size !== REQUIRED_INTERVALS.length
    ) {
      issues.push(
        issue(
          VerifiedMarketSnapshotIssueCode.CoverageMissing,
          `${field}.timeframes`,
          "All four required completed timeframes are required.",
        ),
      );
      continue;
    }
    for (const interval of REQUIRED_INTERVALS) {
      const timeframe = raw.timeframes.find(
        (entry) => record(entry) && entry.interval === interval,
      );
      if (
        !record(timeframe) ||
        ![timeframe.startBarId, timeframe.endBarId].every(
          (entry) => typeof entry === "string" && IDENTIFIER.test(entry),
        ) ||
        ![timeframe.startBarFingerprint, timeframe.endBarFingerprint].every(
          (entry) => typeof entry === "string" && FINGERPRINT.test(entry),
        )
      ) {
        issues.push(
          issue(
            VerifiedMarketSnapshotIssueCode.CoverageMissing,
            `${field}.timeframes`,
            `Required ${interval} evidence is malformed.`,
          ),
        );
        continue;
      }
      const resolvedBars: CanonicalBarReference[] = [];
      for (const [idField, fingerprintField] of [
        ["startBarId", "startBarFingerprint"],
        ["endBarId", "endBarFingerprint"],
      ] as const) {
        const bar = barById.get(String(timeframe[idField]));
        if (
          bar === undefined ||
          bar.canonicalInstrumentId !== raw.analysisInstrumentId ||
          bar.interval !== interval ||
          bar.canonicalBarFingerprint !== timeframe[fingerprintField]
        )
          issues.push(
            issue(
              VerifiedMarketSnapshotIssueCode.CompositionBindingMismatch,
              `${field}.timeframes.${interval}.${idField}`,
              "Composition bar must exactly match declared Snapshot evidence.",
            ),
          );
        else {
          consumedBars.add(bar.canonicalBarId);
          resolvedBars.push(bar);
        }
      }
      const [start, end] = resolvedBars;
      const exactOrder =
        start !== undefined &&
        end !== undefined &&
        start.canonicalBarId !== end.canonicalBarId &&
        start.canonicalBarFingerprint !== end.canonicalBarFingerprint &&
        start.intervalEnd < end.intervalEnd;
      const exactSession =
        interval === BarInterval.OneDay
          ? priorSession !== undefined &&
            start?.sessionDate === priorSession.sessionDate &&
            end?.sessionDate === selectedSession?.sessionDate
          : start?.sessionDate === selectedSession?.sessionDate &&
            end?.sessionDate === selectedSession?.sessionDate;
      if (!exactOrder || !exactSession)
        issues.push(
          issue(
            VerifiedMarketSnapshotIssueCode.TimeframeBarBindingInvalid,
            `${field}.timeframes.${interval}`,
            "Timeframe endpoints must be distinct, strictly ordered, and bind the selected completed-session sequence.",
          ),
        );
    }
  }
  if (
    boundAnalysis.size !== analysis.length ||
    analysis.some((id) => !boundAnalysis.has(id))
  )
    issues.push(
      issue(
        VerifiedMarketSnapshotIssueCode.CoverageMissing,
        "compositionBinding",
        "Every analysis instrument requires all four bound timeframes.",
      ),
    );
  if (
    boundVehicles.size !== vehicles.length ||
    vehicles.some((id) => !boundVehicles.has(id))
  )
    issues.push(
      issue(
        VerifiedMarketSnapshotIssueCode.CoverageMissing,
        "compositionBinding",
        "Every trade vehicle requires one bound quote.",
      ),
    );
  const analysisBars = bars.filter((bar) =>
    analysis.includes(bar.canonicalInstrumentId),
  );
  const vehicleQuotes = quotes.filter((quote) =>
    vehicles.includes(quote.canonicalInstrumentId),
  );
  if (
    analysisBars.some((bar) => !consumedBars.has(bar.canonicalBarId)) ||
    consumedBars.size !== analysisBars.length
  )
    issues.push(
      issue(
        VerifiedMarketSnapshotIssueCode.CompositionBindingMismatch,
        "canonicalBarReferences",
        "Snapshot contains analysis Bar evidence not consumed by Composition.",
      ),
    );
  if (
    vehicleQuotes.some(
      (quote) => !consumedQuotes.has(quote.canonicalQuoteId),
    ) ||
    consumedQuotes.size !== vehicleQuotes.length
  )
    issues.push(
      issue(
        VerifiedMarketSnapshotIssueCode.CompositionBindingMismatch,
        "canonicalQuoteReferences",
        "Snapshot contains vehicle Quote evidence not consumed by Composition.",
      ),
    );
  return value as unknown as VerifiedMarketSnapshotCompositionBinding;
}
function validateBenchmarkCoverage(
  benchmarks: readonly string[],
  bars: readonly CanonicalBarReference[],
  issues: VerifiedMarketSnapshotIssue[],
): void {
  for (const benchmark of benchmarks)
    if (!bars.some((bar) => bar.canonicalInstrumentId === benchmark))
      issues.push(
        issue(
          VerifiedMarketSnapshotIssueCode.CoverageMissing,
          "benchmarkInstrumentIds",
          `Benchmark ${benchmark} has no declared evidence.`,
        ),
      );
}
function validateProviderTrace(
  attemptValue: unknown,
  resolutionValue: unknown,
  asOf: string,
  bars: readonly CanonicalBarReference[],
  quotes: readonly CanonicalQuoteReference[],
  expectedMappingRegistryId: string | undefined,
  expectedMappingRegistryVersion: string | undefined,
  expectedMappingRegistryFingerprint: string | undefined,
  issues: VerifiedMarketSnapshotIssue[],
): void {
  if (!Array.isArray(attemptValue) || attemptValue.length === 0) {
    issues.push(
      issue(
        VerifiedMarketSnapshotIssueCode.InvalidProviderTrace,
        "providerRequestAttempts",
        "Explicit provider request attempts are required.",
      ),
    );
    return;
  }
  const attempts = new Map<string, ProviderRequestAttempt>();
  const requestIds = new Set<string>();
  attemptValue.forEach((entry, index) => {
    const field = `providerRequestAttempts[${index}]`;
    if (!record(entry)) {
      issues.push(
        issue(
          VerifiedMarketSnapshotIssueCode.InvalidProviderTrace,
          field,
          "Provider request attempt must be an object.",
        ),
      );
      return;
    }
    allowOnly(
      entry,
      [
        "requestAttemptId",
        "requestId",
        "requestedProvider",
        "actualProvider",
        "capability",
        "interval",
        "requestedSymbolScope",
        "mappingRegistryId",
        "mappingRegistryVersion",
        "mappingRegistryFingerprint",
        "requestWindowStart",
        "requestWindowEnd",
        "requestFingerprint",
        "attemptOrder",
        "result",
        "failureReason",
        "receivedAt",
        "responseSourceReference",
        "dataOrigin",
        "adapterUnderTest",
      ],
      field,
      issues,
    );
    const descriptor = {
      requestAttemptId: String(entry.requestAttemptId),
      requestId: String(entry.requestId),
      requestedProvider: String(entry.requestedProvider),
      capability: entry.capability as VerifiedMarketProviderCapability,
      ...(entry.interval === undefined
        ? {}
        : { interval: entry.interval as BarInterval }),
      requestedSymbolScope: Array.isArray(entry.requestedSymbolScope)
        ? (entry.requestedSymbolScope as string[])
        : [],
      mappingRegistryId: String(entry.mappingRegistryId),
      mappingRegistryVersion: String(entry.mappingRegistryVersion),
      mappingRegistryFingerprint: String(entry.mappingRegistryFingerprint),
      requestWindowStart: String(entry.requestWindowStart),
      requestWindowEnd: String(entry.requestWindowEnd),
    };
    const valid =
      [
        entry.requestAttemptId,
        entry.requestId,
        entry.requestedProvider,
        entry.actualProvider,
        entry.mappingRegistryId,
        entry.mappingRegistryVersion,
        entry.responseSourceReference,
        entry.adapterUnderTest,
      ].every(
        (item) => typeof item === "string" && IDENTIFIER.test(item),
      ) &&
      Object.values(VerifiedMarketProviderCapability).includes(
        entry.capability as VerifiedMarketProviderCapability,
      ) &&
      Object.values(VerifiedMarketProviderAttemptResult).includes(
        entry.result as VerifiedMarketProviderAttemptResult,
      ) &&
      Object.values(VerifiedMarketDataOrigin).includes(
        entry.dataOrigin as VerifiedMarketDataOrigin,
      ) &&
      Array.isArray(entry.requestedSymbolScope) &&
      entry.requestedSymbolScope.length > 0 &&
      new Set(entry.requestedSymbolScope).size ===
        entry.requestedSymbolScope.length &&
      entry.requestedSymbolScope.every(
        (symbol) =>
          typeof symbol === "string" && /^[A-Z][A-Z0-9.-]{0,15}$/u.test(symbol),
      ) &&
      entry.mappingRegistryId === expectedMappingRegistryId &&
      entry.mappingRegistryVersion === expectedMappingRegistryVersion &&
      entry.mappingRegistryFingerprint === expectedMappingRegistryFingerprint &&
      typeof entry.mappingRegistryFingerprint === "string" &&
      SHA256_FINGERPRINT.test(entry.mappingRegistryFingerprint) &&
      timestamp(entry.requestWindowStart) &&
      timestamp(entry.requestWindowEnd) &&
      Date.parse(String(entry.requestWindowStart)) <
        Date.parse(String(entry.requestWindowEnd)) &&
      Date.parse(String(entry.requestWindowEnd)) <= Date.parse(asOf) &&
      timestamp(entry.receivedAt) &&
      Date.parse(String(entry.receivedAt)) <= Date.parse(asOf) &&
      Number.isSafeInteger(entry.attemptOrder) &&
      entry.attemptOrder === index + 1 &&
      typeof entry.requestFingerprint === "string" &&
      entry.requestFingerprint === verifiedProviderRequestFingerprint(descriptor);
    if (
      !valid ||
      attempts.has(String(entry.requestAttemptId)) ||
      requestIds.has(String(entry.requestId))
    ) {
      issues.push(
        issue(
          VerifiedMarketSnapshotIssueCode.InvalidProviderTrace,
          field,
          "Provider request identity, order, bounds, fingerprint, or uniqueness is invalid.",
        ),
      );
      return;
    }
    if (entry.requestedProvider !== entry.actualProvider)
      issues.push(
        issue(
          VerifiedMarketSnapshotIssueCode.SilentProviderFallback,
          field,
          "Provider substitution is forbidden.",
        ),
      );
    if (
      entry.capability === VerifiedMarketProviderCapability.Bars &&
      !REQUIRED_INTERVALS.includes(
        entry.interval as (typeof REQUIRED_INTERVALS)[number],
      )
    )
      issues.push(
        issue(
          VerifiedMarketSnapshotIssueCode.InvalidProviderTrace,
          field,
          "Bar request attempts require one exact interval.",
        ),
      );
    if (
      entry.capability === VerifiedMarketProviderCapability.LatestQuote &&
      entry.interval !== undefined
    )
      issues.push(
        issue(
          VerifiedMarketSnapshotIssueCode.InvalidProviderTrace,
          field,
          "Quote request attempts cannot declare a Bar interval.",
        ),
      );
    if (
      entry.result === VerifiedMarketProviderAttemptResult.Rejected
        ? typeof entry.failureReason !== "string" ||
          !IDENTIFIER.test(entry.failureReason)
        : entry.failureReason !== undefined
    )
      issues.push(
        issue(
          VerifiedMarketSnapshotIssueCode.InvalidProviderTrace,
          field,
          "Rejected requests require one reason; successful requests require none.",
        ),
      );
    attempts.set(
      String(entry.requestAttemptId),
      entry as unknown as ProviderRequestAttempt,
    );
    requestIds.add(String(entry.requestId));
  });

  type Evidence = {
    readonly capability: VerifiedMarketProviderCapability;
    readonly interval: BarInterval | undefined;
    readonly canonicalInstrumentId: string;
    readonly fingerprint: string;
    readonly provenance: string;
    readonly start: string;
    readonly end: string;
  };
  type TypedEvidenceKey =
    `${VerifiedMarketProviderCapability}:${string}`;
  const typedEvidenceKey = (
    capability: VerifiedMarketProviderCapability,
    evidenceId: string,
  ): TypedEvidenceKey => `${capability}:${evidenceId}`;
  const requiredEvidence: readonly (Evidence & {
    readonly evidenceId: string;
  })[] = [
    ...bars.map((bar) => ({
      evidenceId: bar.canonicalBarId,
      capability: VerifiedMarketProviderCapability.Bars,
      interval: bar.interval,
      canonicalInstrumentId: bar.canonicalInstrumentId,
      fingerprint: bar.canonicalBarFingerprint,
      provenance: bar.provenanceReference,
      start: bar.intervalStart,
      end: bar.intervalEnd,
    })),
    ...quotes.map((quote) => ({
      evidenceId: quote.canonicalQuoteId,
      capability: VerifiedMarketProviderCapability.LatestQuote,
      interval: undefined,
      canonicalInstrumentId: quote.canonicalInstrumentId,
      fingerprint: quote.canonicalQuoteFingerprint,
      provenance: quote.provenanceReference,
      start: quote.observationTime,
      end: quote.observationTime,
    })),
  ];
  const evidence = new Map<TypedEvidenceKey, Evidence>();
  for (const item of requiredEvidence) {
    const key = typedEvidenceKey(item.capability, item.evidenceId);
    if (evidence.has(key)) {
      issues.push(
        issue(
          VerifiedMarketSnapshotIssueCode.EvidenceCoverageMismatch,
          "evidenceResolutions",
          `Snapshot typed evidence ${key} is duplicated.`,
        ),
      );
      continue;
    }
    evidence.set(key, {
      capability: item.capability,
      interval: item.interval,
      canonicalInstrumentId: item.canonicalInstrumentId,
      fingerprint: item.fingerprint,
      provenance: item.provenance,
      start: item.start,
      end: item.end,
    });
  }
  if (!Array.isArray(resolutionValue) || resolutionValue.length === 0) {
    issues.push(
      issue(
        VerifiedMarketSnapshotIssueCode.InvalidProviderTrace,
        "evidenceResolutions",
        "Explicit evidence resolutions are required.",
      ),
    );
    return;
  }
  const resolutionIds = new Set<string>();
  const coverage = new Map<TypedEvidenceKey, number>();
  const resolutionsPerAttempt = new Map<string, number>();
  resolutionValue.forEach((entry, index) => {
    const field = `evidenceResolutions[${index}]`;
    if (!record(entry)) {
      issues.push(
        issue(
          VerifiedMarketSnapshotIssueCode.InvalidProviderTrace,
          field,
          "Evidence resolution must be an object.",
        ),
      );
      return;
    }
    allowOnly(
      entry,
      [
        "resolutionId",
        "resolutionFingerprint",
        "result",
        "requestAttemptId",
        "evidenceId",
        "evidenceFingerprint",
        "canonicalInstrumentId",
        "providerSymbol",
        "providerSymbolMappingVersion",
        "providerSymbolMappingFingerprint",
        "mappingRegistryId",
        "mappingRegistryVersion",
        "mappingRegistryFingerprint",
        "capability",
        "interval",
        "evidenceWindowStart",
        "evidenceWindowEnd",
        "observedAt",
        "provenanceReference",
        "responseSourceReference",
      ],
      field,
      issues,
    );
    const attempt = attempts.get(String(entry.requestAttemptId));
    const key = typedEvidenceKey(
      entry.capability as VerifiedMarketProviderCapability,
      String(entry.evidenceId),
    );
    const source = evidence.get(key);
    const fingerprintInput = {
      resolutionId: String(entry.resolutionId),
      result: entry.result as VerifiedMarketEvidenceResolutionResult,
      requestAttemptId: String(entry.requestAttemptId),
      evidenceId: String(entry.evidenceId),
      evidenceFingerprint: String(entry.evidenceFingerprint),
      canonicalInstrumentId: String(entry.canonicalInstrumentId),
      providerSymbol: String(entry.providerSymbol),
      providerSymbolMappingVersion: String(
        entry.providerSymbolMappingVersion,
      ),
      providerSymbolMappingFingerprint: String(
        entry.providerSymbolMappingFingerprint,
      ),
      mappingRegistryId: String(entry.mappingRegistryId),
      mappingRegistryVersion: String(entry.mappingRegistryVersion),
      mappingRegistryFingerprint: String(entry.mappingRegistryFingerprint),
      capability: entry.capability as VerifiedMarketProviderCapability,
      ...(entry.interval === undefined
        ? {}
        : { interval: entry.interval as BarInterval }),
      evidenceWindowStart: String(entry.evidenceWindowStart),
      evidenceWindowEnd: String(entry.evidenceWindowEnd),
      observedAt: String(entry.observedAt),
      provenanceReference: String(entry.provenanceReference),
      responseSourceReference: String(entry.responseSourceReference),
    };
    const valid =
      [
        entry.resolutionId,
        entry.requestAttemptId,
        entry.evidenceId,
        entry.canonicalInstrumentId,
        entry.providerSymbolMappingVersion,
        entry.mappingRegistryId,
        entry.mappingRegistryVersion,
        entry.provenanceReference,
        entry.responseSourceReference,
      ].every(
        (item) => typeof item === "string" && IDENTIFIER.test(item),
      ) &&
      typeof entry.providerSymbol === "string" &&
      /^[A-Z][A-Z0-9.-]{0,15}$/u.test(entry.providerSymbol) &&
      typeof entry.evidenceFingerprint === "string" &&
      FINGERPRINT.test(entry.evidenceFingerprint) &&
      typeof entry.providerSymbolMappingFingerprint === "string" &&
      entry.providerSymbolMappingFingerprint ===
        verifiedProviderSymbolMappingFingerprint({
          canonicalInstrumentId: String(entry.canonicalInstrumentId),
          providerSymbol: String(entry.providerSymbol),
          providerSymbolMappingVersion: String(
            entry.providerSymbolMappingVersion,
          ),
        }) &&
      entry.mappingRegistryId === expectedMappingRegistryId &&
      entry.mappingRegistryVersion === expectedMappingRegistryVersion &&
      entry.mappingRegistryFingerprint === expectedMappingRegistryFingerprint &&
      typeof entry.mappingRegistryFingerprint === "string" &&
      SHA256_FINGERPRINT.test(entry.mappingRegistryFingerprint) &&
      typeof entry.resolutionFingerprint === "string" &&
      entry.result === VerifiedMarketEvidenceResolutionResult.Resolved &&
      entry.resolutionFingerprint ===
        verifiedEvidenceResolutionFingerprint(fingerprintInput) &&
      timestamp(entry.evidenceWindowStart) &&
      timestamp(entry.evidenceWindowEnd) &&
      timestamp(entry.observedAt) &&
      !resolutionIds.has(String(entry.resolutionId));
    if (!valid) {
      issues.push(
        issue(
          VerifiedMarketSnapshotIssueCode.InvalidProviderTrace,
          field,
          "Evidence resolution identity, mapping, fingerprint, or time is invalid.",
        ),
      );
      return;
    }
    resolutionIds.add(String(entry.resolutionId));
    const bindingInvalid =
      attempt === undefined ||
      attempt.result !== VerifiedMarketProviderAttemptResult.Succeeded ||
      source === undefined ||
      source.capability !== entry.capability ||
      source.interval !== entry.interval ||
      source.canonicalInstrumentId !== entry.canonicalInstrumentId ||
      source.fingerprint !== entry.evidenceFingerprint ||
      source.provenance !== entry.provenanceReference ||
      attempt.capability !== entry.capability ||
      attempt.interval !== entry.interval ||
      attempt.mappingRegistryId !== entry.mappingRegistryId ||
      attempt.mappingRegistryVersion !== entry.mappingRegistryVersion ||
      attempt.mappingRegistryFingerprint !== entry.mappingRegistryFingerprint ||
      !attempt.requestedSymbolScope.includes(String(entry.providerSymbol)) ||
      attempt.responseSourceReference !== entry.responseSourceReference ||
      String(entry.evidenceWindowStart) !== source.start ||
      String(entry.evidenceWindowEnd) !== source.end ||
      Date.parse(source.start) < Date.parse(attempt.requestWindowStart) ||
      Date.parse(source.end) > Date.parse(attempt.requestWindowEnd) ||
      Date.parse(String(entry.observedAt)) < Date.parse(source.end) ||
      Date.parse(String(entry.observedAt)) > Date.parse(attempt.receivedAt);
    if (bindingInvalid)
      issues.push(
        issue(
          source !== undefined &&
          attempt !== undefined &&
          (Date.parse(source.start) < Date.parse(attempt.requestWindowStart) ||
            Date.parse(source.end) > Date.parse(attempt.requestWindowEnd))
            ? VerifiedMarketSnapshotIssueCode.RequestWindowMismatch
            : VerifiedMarketSnapshotIssueCode.InvalidProviderTrace,
          field,
          "Resolution must exactly bind Snapshot evidence to its successful batch request and response source.",
        ),
      );
    if (!bindingInvalid) coverage.set(key, (coverage.get(key) ?? 0) + 1);
    if (!bindingInvalid && attempt !== undefined)
      resolutionsPerAttempt.set(
        attempt.requestAttemptId,
        (resolutionsPerAttempt.get(attempt.requestAttemptId) ?? 0) + 1,
      );
  });
  if (
    evidence.size !== requiredEvidence.length ||
    coverage.size !== requiredEvidence.length
  )
    issues.push(
      issue(
        VerifiedMarketSnapshotIssueCode.EvidenceCoverageMismatch,
        "evidenceResolutions",
        `Exactly ${requiredEvidence.length} uniquely typed Snapshot evidence resolutions are required; received ${coverage.size}.`,
      ),
    );
  for (const key of evidence.keys())
    if (coverage.get(key) !== 1)
      issues.push(
        issue(
          VerifiedMarketSnapshotIssueCode.EvidenceCoverageMismatch,
          "evidenceResolutions",
          `Snapshot typed evidence ${key} must have exactly one successful resolution.`,
        ),
      );
  for (const attempt of attempts.values()) {
    const count = resolutionsPerAttempt.get(attempt.requestAttemptId) ?? 0;
    if (
      (attempt.result === VerifiedMarketProviderAttemptResult.Succeeded &&
        count === 0) ||
      (attempt.result === VerifiedMarketProviderAttemptResult.Rejected &&
        count !== 0)
    )
      issues.push(
        issue(
          VerifiedMarketSnapshotIssueCode.InvalidProviderTrace,
          "providerRequestAttempts",
          "Successful requests must resolve evidence and rejected requests must resolve none.",
        ),
      );
  }
}

function validatePolicy(
  value: unknown,
  issues: VerifiedMarketSnapshotIssue[],
): VerifiedMarketFreshnessQualityPolicy | undefined {
  if (!record(value)) {
    issues.push(
      issue(
        VerifiedMarketSnapshotIssueCode.InvalidRecord,
        "freshnessQualityPolicy",
        "Policy is required.",
      ),
    );
    return undefined;
  }
  allowOnly(
    value,
    [
      "policyId",
      "version",
      "closureBufferSeconds",
      "quoteMaxAgeSeconds",
      "barMaxAgeSeconds",
    ],
    "freshnessQualityPolicy",
    issues,
  );
  const barMaxAgeSeconds = value.barMaxAgeSeconds;
  if (
    ![value.policyId, value.version].every(
      (item) => typeof item === "string" && IDENTIFIER.test(item),
    ) ||
    !Number.isSafeInteger(value.closureBufferSeconds) ||
    Number(value.closureBufferSeconds) < 0 ||
    Number(value.closureBufferSeconds) > 300 ||
    !Number.isSafeInteger(value.quoteMaxAgeSeconds) ||
    Number(value.quoteMaxAgeSeconds) <= 0 ||
    Number(value.quoteMaxAgeSeconds) > 86_400 ||
    !record(barMaxAgeSeconds) ||
    Object.keys(barMaxAgeSeconds).length !== REQUIRED_INTERVALS.length ||
    REQUIRED_INTERVALS.some(
      (interval) =>
        !Object.hasOwn(barMaxAgeSeconds, interval) ||
        !Number.isSafeInteger(barMaxAgeSeconds[interval]) ||
        Number(barMaxAgeSeconds[interval]) <= 0 ||
        Number(barMaxAgeSeconds[interval]) > 604_800,
    )
  ) {
    issues.push(
      issue(
        VerifiedMarketSnapshotIssueCode.InvalidRecord,
        "freshnessQualityPolicy",
        "Freshness policy identity or deterministic age bounds are invalid.",
      ),
    );
    return undefined;
  }
  return value as unknown as VerifiedMarketFreshnessQualityPolicy;
}
function validateRequiredEvidence(
  value: unknown,
  issues: VerifiedMarketSnapshotIssue[],
): void {
  if (!record(value)) {
    issues.push(
      issue(
        VerifiedMarketSnapshotIssueCode.InvalidRecord,
        "requiredEvidenceStatus",
        "Required evidence statuses are required.",
      ),
    );
    return;
  }
  const keys = [
    "analysisBars",
    "tradeVehicleQuotes",
    "benchmarks",
    "provenance",
  ];
  allowOnly(value, keys, "requiredEvidenceStatus", issues);
  if (
    keys.some(
      (key) =>
        !Object.hasOwn(value, key) ||
        !Object.values(VerifiedMarketEvidenceStatus).includes(
          value[key] as VerifiedMarketEvidenceStatus,
        ),
    )
  )
    issues.push(
      issue(
        VerifiedMarketSnapshotIssueCode.InvalidRecord,
        "requiredEvidenceStatus",
        "Required evidence statuses are invalid.",
      ),
    );
}
function timestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    Number.isFinite(Date.parse(value)) &&
    new Date(Date.parse(value)).toISOString() === value
  );
}
function record(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function issue(
  code: VerifiedMarketSnapshotIssueCode,
  field: string,
  message: string,
): VerifiedMarketSnapshotIssue {
  return { code, field, message };
}
function allowOnly(
  value: Record<string, unknown>,
  fields: readonly string[],
  path: string,
  issues: VerifiedMarketSnapshotIssue[],
): void {
  for (const key of Object.keys(value))
    if (!fields.includes(key))
      issues.push(
        issue(
          VerifiedMarketSnapshotIssueCode.UndeclaredField,
          `${path}.${key}`,
          "Undeclared field is not allowed.",
        ),
      );
}
function freezeValidation(
  issues: readonly VerifiedMarketSnapshotIssue[],
): VerifiedMarketSnapshotValidationResult {
  return freeze({
    valid: issues.length === 0,
    issues: [...issues].sort((a, b) =>
      `${a.code}|${a.field}|${a.message}`.localeCompare(
        `${b.code}|${b.field}|${b.message}`,
      ),
    ),
  });
}
function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const item of Object.values(value as Record<string, unknown>))
      freeze(item);
  }
  return value;
}
