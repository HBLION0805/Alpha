import { BarFreshnessStatus, BarInterval } from "../../contracts/CanonicalBar";
import {
  MARKET_DATA_SCHEMA_VERSION,
  MarketDataBarMode,
  MarketDataCapability,
  MarketDataDimensionStatus,
  MarketDataIssueCode,
  MarketDataNormalizationStatus,
  MarketDataOperation,
  MarketDataProviderHealthStatus,
  MarketDataQualityStatus,
  MarketDataResultStatus,
  MarketDataTransportStatus,
  MarketDataValidationDimension,
  MarketDataValidationStatus,
  type MarketDataAdapterError,
  type MarketDataBarRequest,
  type MarketDataBarResult,
  type MarketDataClock,
  type MarketDataNormalizationIssue,
  type MarketDataValidationCheck,
} from "../../contracts/MarketData";
import type { MarketDataProviderComposition } from "../../contracts/MarketDataProviderComposition";
import { isCanonicalInstrumentId } from "../canonical-instrument/CanonicalInstrument";
import { validateCanonicalBar } from "../canonical-bar/CanonicalBar";
import { MarketDataConfigurationError } from "./MarketDataQuoteOrchestrator";

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/u;

/** Capability-specific deterministic Bar orchestration behind the MarketDataService facade. */
export class MarketDataBarOrchestrator {
  public constructor(
    private readonly composition: MarketDataProviderComposition,
    private readonly clock: MarketDataClock,
  ) {}

  public async getBars(value: unknown): Promise<MarketDataBarResult> {
    const request = validateBarRequest(value);
    const startedAt = parseTimestamp(this.clock.now(), "clock.now");
    const provider = this.composition.getProvider(request.providerId);
    const adapter = this.composition.getBarAdapter(request.providerId);
    if (provider === undefined || adapter === undefined) {
      return withoutData(request, startedAt, MarketDataResultStatus.Unavailable, MarketDataQualityStatus.Unavailable,
        MarketDataTransportStatus.NotAttempted, issue(MarketDataIssueCode.ProviderNotRegistered, "Requested Bar provider or capability adapter is not registered."));
    }
    if (!provider.defaultEnabled) {
      return withoutData(request, startedAt, MarketDataResultStatus.Unavailable, MarketDataQualityStatus.Unavailable,
        MarketDataTransportStatus.NotAttempted, issue(MarketDataIssueCode.ProviderDisabled, "Requested Bar provider is disabled."));
    }
    if (!request.policy.allowedProviderIds.includes(request.providerId)) {
      return withoutData(request, startedAt, MarketDataResultStatus.Rejected, MarketDataQualityStatus.Invalid,
        MarketDataTransportStatus.NotAttempted, issue(MarketDataIssueCode.ProviderNotAllowed, "Requested Bar provider is not allowed by policy."));
    }
    const unsupportedCapability = request.policy.requiredCapabilities.find(
      (capability) => !provider.capabilities.includes(capability),
    );
    if (unsupportedCapability !== undefined) {
      return withoutData(request, startedAt, MarketDataResultStatus.Unsupported, MarketDataQualityStatus.Unsupported,
        MarketDataTransportStatus.NotAttempted,
        issue(MarketDataIssueCode.CapabilityUnsupported, `Provider does not support required capability ${unsupportedCapability}.`));
    }

    const descriptor = adapter.getDescriptor();
    if (descriptor.capability !== MarketDataCapability.Bars
      || !descriptor.supportedBarIntervals?.includes(request.interval)) {
      return withoutData(request, startedAt, MarketDataResultStatus.Unsupported, MarketDataQualityStatus.Unsupported,
        MarketDataTransportStatus.NotAttempted, issue(MarketDataIssueCode.CapabilityUnsupported, "Bar interval is not supported by the attached adapter."));
    }

    const health = adapter.getHealth();
    validateHealth(health, request.providerId);
    if (health.status === MarketDataProviderHealthStatus.Unavailable) {
      return withoutData(request, startedAt, MarketDataResultStatus.Unavailable, MarketDataQualityStatus.Unavailable,
        MarketDataTransportStatus.Unavailable, issue(MarketDataIssueCode.ProviderUnavailable, health.reason ?? "Provider is unavailable."));
    }

    let raw;
    try {
      raw = await adapter.fetchBars(deepFreeze(clone(request)));
    } catch (error: unknown) {
      const normalizedError = adapter.normalizeError(error, deepFreeze(clone(request)), this.clock.now());
      validateAdapterError(normalizedError, request.providerId);
      return withoutData(request, startedAt, MarketDataResultStatus.Unavailable, MarketDataQualityStatus.Unavailable,
        MarketDataTransportStatus.Failed, issue(MarketDataIssueCode.TransportFailure, normalizedError.safeMessage));
    }

    const rawCopy = deepFreeze(clone(raw));
    if (!isRecord(rawCopy) || rawCopy.providerId !== request.providerId || !isTimestamp(rawCopy.receivedAt)) {
      return withoutData(request, startedAt, MarketDataResultStatus.Rejected, MarketDataQualityStatus.Invalid,
        MarketDataTransportStatus.Succeeded, issue(MarketDataIssueCode.InvalidProviderIdentity, "Raw Bar response envelope is invalid."));
    }

    let normalized;
    try {
      normalized = adapter.normalizeBars(rawCopy, deepFreeze(clone(request)));
    } catch {
      return withoutData(request, startedAt, MarketDataResultStatus.Rejected, MarketDataQualityStatus.Invalid,
        MarketDataTransportStatus.Succeeded, issue(MarketDataIssueCode.NormalizationRejected, "Bar normalization failed safely."),
        MarketDataNormalizationStatus.Rejected);
    }
    if (!isRecord(normalized)
      || normalized.providerId !== request.providerId
      || !Array.isArray(normalized.bars)
      || !Number.isSafeInteger(normalized.duplicateCount) || normalized.duplicateCount < 0
      || !Array.isArray(normalized.blockers)
      || !Array.isArray(normalized.warnings)) {
      throw new MarketDataConfigurationError("Bar normalization result is malformed.");
    }
    if (normalized.status === MarketDataNormalizationStatus.Rejected || normalized.bars.length === 0) {
      return withoutData(request, startedAt, MarketDataResultStatus.Rejected,
        normalized.blockers.some((entry) => entry.code === MarketDataIssueCode.AmbiguousUnits)
          ? MarketDataQualityStatus.Incomplete : MarketDataQualityStatus.Invalid,
        MarketDataTransportStatus.Succeeded,
        normalized.blockers.length > 0 ? normalized.blockers : issue(MarketDataIssueCode.NoAcceptedData, "Adapter returned no accepted Bars."),
        MarketDataNormalizationStatus.Rejected, normalized.warnings);
    }
    if (normalized.bars.length > request.maxRecords) {
      return withoutData(request, startedAt, MarketDataResultStatus.Rejected, MarketDataQualityStatus.Invalid,
        MarketDataTransportStatus.Succeeded, issue(MarketDataIssueCode.InvalidRequestWindow, "Adapter returned more Bars than requested."),
        MarketDataNormalizationStatus.Normalized, normalized.warnings);
    }

    const bars = normalized.bars.map(clone)
      .sort((left, right) => left.intervalStart.localeCompare(right.intervalStart) || left.barId.localeCompare(right.barId));
    const invalid = bars.some((bar) => !validateCanonicalBar(bar).valid
      || bar.instrument.instrumentId !== request.instrument.instrumentId
      || bar.source.providerId !== request.providerId
      || bar.interval !== request.interval
      || !provider.supportedAssetClasses.includes(bar.instrument.assetClass)
      || !descriptor.supportedAssetClasses.includes(bar.instrument.assetClass));
    if (invalid) {
      return withoutData(request, startedAt, MarketDataResultStatus.Rejected, MarketDataQualityStatus.Invalid,
        MarketDataTransportStatus.Succeeded, issue(MarketDataIssueCode.NormalizationRejected, "Adapter returned an invalid or undeclared Canonical Bar."),
        MarketDataNormalizationStatus.Normalized, normalized.warnings);
    }

    const stale = bars.some((bar) => bar.quality.freshness === BarFreshnessStatus.Stale);
    if (stale && request.barMode === MarketDataBarMode.Intraday) {
      return withoutData(request, startedAt, MarketDataResultStatus.Rejected, MarketDataQualityStatus.Stale,
        MarketDataTransportStatus.Succeeded, issue(MarketDataIssueCode.StaleObservation, "Intraday Bar result contains stale observations."),
        MarketDataNormalizationStatus.Normalized, normalized.warnings);
    }

    const checks = passedChecks(normalized.duplicateCount);
    const processedAt = this.clock.now();
    return deepFreeze({
      schemaVersion: MARKET_DATA_SCHEMA_VERSION,
      requestId: request.requestId,
      operation: MarketDataOperation.Bars,
      status: MarketDataResultStatus.Accepted,
      qualityStatus: stale ? MarketDataQualityStatus.Stale : MarketDataQualityStatus.Valid,
      providerId: request.providerId,
      barMode: request.barMode,
      capability: MarketDataCapability.Bars,
      requestedInstrument: clone(request.instrument),
      interval: request.interval,
      data: bars,
      duplicateCount: normalized.duplicateCount,
      transportStatus: MarketDataTransportStatus.Succeeded,
      normalizationStatus: MarketDataNormalizationStatus.Normalized,
      validation: { status: MarketDataValidationStatus.Passed, checks },
      blockers: [],
      warnings: sortIssues(normalized.warnings),
      policyId: request.policy.policyId,
      policyVersion: request.policy.version,
      trace: clone(request.trace),
      processing: processing(request, startedAt, processedAt),
    });
  }
}

function validateBarRequest(value: unknown): MarketDataBarRequest {
  if (!isRecord(value)
    || value.schemaVersion !== MARKET_DATA_SCHEMA_VERSION
    || value.operation !== MarketDataOperation.Bars
    || !validIdentifier(value.requestId)
    || !validIdentifier(value.providerId)
    || !Object.values(MarketDataBarMode).includes(value.barMode as MarketDataBarMode)
    || !isRecord(value.instrument) || !isCanonicalInstrumentId(value.instrument.instrumentId)
    || !Object.values(BarInterval).includes(value.interval as BarInterval)
    || !isTimestamp(value.startTime) || !isTimestamp(value.endTime)
    || Date.parse(value.endTime as string) <= Date.parse(value.startTime as string)
    || !Number.isSafeInteger(value.maxRecords) || (value.maxRecords as number) < 1
    || !isTimestamp(value.requestedAt) || !isTimestamp(value.evaluatedAt)
    || !isRecord(value.trace) || !validIdentifier(value.trace.correlationId)
    || !isRecord(value.policy)) {
    throw new MarketDataConfigurationError("Bar request is malformed.");
  }
  const policy = value.policy;
  const lookbackSeconds = (Date.parse(value.endTime as string) - Date.parse(value.startTime as string)) / 1000;
  if (policy.schemaVersion !== MARKET_DATA_SCHEMA_VERSION
    || !validIdentifier(policy.policyId) || !validIdentifier(policy.version)
    || !Array.isArray(policy.allowedProviderIds) || !policy.allowedProviderIds.every(validIdentifier)
    || !Array.isArray(policy.requiredCapabilities)
    || !policy.requiredCapabilities.every((entry) => Object.values(MarketDataCapability).includes(entry as MarketDataCapability))
    || !policy.requiredCapabilities.includes(MarketDataCapability.Bars)
    || !Number.isSafeInteger(policy.maxRecords) || (policy.maxRecords as number) < 1 || (policy.maxRecords as number) > 5_000
    || !Number.isSafeInteger(policy.maxLookbackSeconds) || (policy.maxLookbackSeconds as number) < 1
    || (value.maxRecords as number) > (policy.maxRecords as number)
    || lookbackSeconds > (policy.maxLookbackSeconds as number)) {
    throw new MarketDataConfigurationError("Bar policy is malformed or request exceeds its record or lookback limit.");
  }
  return deepFreeze(clone(value as unknown as MarketDataBarRequest));
}

function passedChecks(duplicateCount: number): readonly MarketDataValidationCheck[] {
  return deepFreeze(Object.values(MarketDataValidationDimension).map((dimension) => ({
    dimension,
    status: MarketDataDimensionStatus.Passed,
    issueCodes: dimension === MarketDataValidationDimension.Duplicate && duplicateCount > 0
      ? [MarketDataIssueCode.DuplicateObservation]
      : [],
  })));
}

function withoutData(
  request: MarketDataBarRequest,
  startedAt: number,
  status: MarketDataResultStatus,
  qualityStatus: MarketDataQualityStatus,
  transportStatus: MarketDataTransportStatus,
  blockers: MarketDataNormalizationIssue | readonly MarketDataNormalizationIssue[],
  normalizationStatus = MarketDataNormalizationStatus.NotAttempted,
  warnings: readonly MarketDataNormalizationIssue[] = [],
): MarketDataBarResult {
  const processedAt = new Date(startedAt).toISOString();
  return deepFreeze({
    schemaVersion: MARKET_DATA_SCHEMA_VERSION,
    requestId: request.requestId,
    operation: MarketDataOperation.Bars,
    status,
    qualityStatus,
    providerId: request.providerId,
    barMode: request.barMode,
    capability: MarketDataCapability.Bars,
    requestedInstrument: clone(request.instrument),
    interval: request.interval,
    data: [],
    duplicateCount: 0,
    transportStatus,
    normalizationStatus,
    validation: { status: MarketDataValidationStatus.NotRun, checks: [] },
    blockers: sortIssues(Array.isArray(blockers) ? blockers : [blockers]),
    warnings: sortIssues(warnings),
    policyId: request.policy.policyId,
    policyVersion: request.policy.version,
    trace: clone(request.trace),
    processing: processing(request, startedAt, processedAt),
  });
}

function validateHealth(value: unknown, providerId: string): void {
  if (!isRecord(value) || value.providerId !== providerId
    || !Object.values(MarketDataProviderHealthStatus).includes(value.status as MarketDataProviderHealthStatus)
    || !isTimestamp(value.observedAt)) {
    throw new MarketDataConfigurationError("Provider health response is malformed.");
  }
}

function validateAdapterError(value: unknown, providerId: string): asserts value is MarketDataAdapterError {
  if (!isRecord(value) || value.providerId !== providerId || !nonEmpty(value.safeCode)
    || !nonEmpty(value.safeMessage) || typeof value.retryable !== "boolean" || !isTimestamp(value.occurredAt)) {
    throw new MarketDataConfigurationError("Provider error normalization is malformed.");
  }
}

function processing(request: MarketDataBarRequest, startedAt: number, processedAt: string) {
  return {
    requestedAt: request.requestedAt,
    evaluatedAt: request.evaluatedAt,
    processedAt,
    durationMs: Math.max(0, Date.parse(processedAt) - startedAt),
  };
}

function issue(code: MarketDataIssueCode, message: string, field?: string): MarketDataNormalizationIssue {
  return { code, message, ...(field === undefined ? {} : { field }) };
}

function sortIssues(values: readonly MarketDataNormalizationIssue[]): MarketDataNormalizationIssue[] {
  return values.map((value) => ({ ...value })).sort((left, right) =>
    `${left.code}|${left.field ?? ""}|${left.message}`.localeCompare(`${right.code}|${right.field ?? ""}|${right.message}`));
}

function validIdentifier(value: unknown): value is string {
  return typeof value === "string" && IDENTIFIER.test(value);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 500;
}

function isTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function parseTimestamp(value: string, field: string): number {
  if (!isTimestamp(value)) throw new MarketDataConfigurationError(`${field} must be a canonical UTC timestamp.`);
  return Date.parse(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clone<T>(value: T): T {
  if (Array.isArray(value)) return value.map(clone) as T;
  if (isRecord(value)) return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, clone(entry)])) as T;
  return value;
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) deepFreeze(nested);
  }
  return value;
}
