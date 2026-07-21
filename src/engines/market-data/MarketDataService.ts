import {
  MARKET_DATA_SCHEMA_VERSION,
  MarketDataCapability,
  MarketDataDimensionStatus,
  MarketDataDuplicatePolicy,
  MarketDataIssueCode,
  MarketDataNormalizationStatus,
  MarketDataOperation,
  MarketDataProviderHealthStatus,
  MarketDataQualityStatus,
  MarketDataQuantityUnit,
  MarketDataResultStatus,
  MarketDataTransportStatus,
  MarketDataType,
  MarketDataValidationDimension,
  MarketDataValidationStatus,
  type CanonicalInstrumentIdentity,
  type CanonicalMarketQuote,
  type LatestQuoteRequest,
  type MarketDataClock,
  type MarketDataFreshnessRule,
  type MarketDataNormalizationIssue,
  type MarketDataProviderAdapter,
  type MarketDataProviderDescriptor,
  type MarketDataResult,
  type MarketDataValidationCheck,
} from "../../contracts/MarketData";
import { InstrumentAssetClass } from "../../contracts/CanonicalInstrument";
import {
  isCanonicalInstrumentId,
  validateCanonicalInstrument,
} from "../canonical-instrument/CanonicalInstrument";

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/u;
const INTEGER = /^-?\d+$/u;
const CURRENCY = /^[A-Z]{3}$/u;

export class MarketDataConfigurationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "MarketDataConfigurationError";
  }
}

/** Read-only orchestration of one explicitly requested provider adapter. */
export class MarketDataService {
  private readonly adapters = new Map<string, MarketDataProviderAdapter>();

  public constructor(
    adapters: readonly MarketDataProviderAdapter[],
    private readonly clock: MarketDataClock,
  ) {
    for (const adapter of adapters) {
      const descriptor = validateDescriptor(adapter.getDescriptor());
      if (this.adapters.has(descriptor.providerId)) {
        throw new MarketDataConfigurationError(`Duplicate provider ID: ${descriptor.providerId}`);
      }
      this.adapters.set(descriptor.providerId, adapter);
    }
  }

  public listProviders(): readonly MarketDataProviderDescriptor[] {
    return deepFreeze(
      [...this.adapters.values()]
        .map((adapter) => copyDescriptor(validateDescriptor(adapter.getDescriptor())))
        .sort((left, right) => left.providerId.localeCompare(right.providerId)),
    );
  }

  public async getLatestQuote(value: unknown): Promise<MarketDataResult> {
    const request = validateRequest(value);
    const startedAt = parseTimestamp(this.clock.now(), "clock.now");
    const adapter = this.adapters.get(request.providerId);

    if (!adapter) {
      return resultWithoutData(
        request,
        startedAt,
        MarketDataResultStatus.Unavailable,
        MarketDataQualityStatus.Unavailable,
        MarketDataTransportStatus.NotAttempted,
        issue(MarketDataIssueCode.ProviderNotRegistered, "Requested provider is not registered."),
      );
    }

    const descriptor = validateDescriptor(adapter.getDescriptor());
    if (!descriptor.enabled) {
      return resultWithoutData(
        request,
        startedAt,
        MarketDataResultStatus.Unavailable,
        MarketDataQualityStatus.Unavailable,
        MarketDataTransportStatus.NotAttempted,
        issue(MarketDataIssueCode.ProviderDisabled, "Requested provider is disabled."),
      );
    }
    if (!request.policy.allowedProviderIds.includes(request.providerId)) {
      return resultWithoutData(
        request,
        startedAt,
        MarketDataResultStatus.Rejected,
        MarketDataQualityStatus.Invalid,
        MarketDataTransportStatus.NotAttempted,
        issue(MarketDataIssueCode.ProviderNotAllowed, "Requested provider is not allowed by policy."),
      );
    }
    const unsupportedCapability = request.policy.requiredCapabilities.find(
      (capability) => !descriptor.capabilities.includes(capability),
    );
    if (unsupportedCapability !== undefined) {
      return resultWithoutData(
        request,
        startedAt,
        MarketDataResultStatus.Unsupported,
        MarketDataQualityStatus.Unsupported,
        MarketDataTransportStatus.NotAttempted,
        issue(MarketDataIssueCode.CapabilityUnsupported, `Provider does not support required capability ${unsupportedCapability}.`),
      );
    }

    const health = adapter.getHealth();
    validateHealth(health, descriptor.providerId);
    if (health.status === MarketDataProviderHealthStatus.Unavailable) {
      return resultWithoutData(
        request,
        startedAt,
        MarketDataResultStatus.Unavailable,
        MarketDataQualityStatus.Unavailable,
        MarketDataTransportStatus.Unavailable,
        issue(MarketDataIssueCode.ProviderUnavailable, health.reason ?? "Provider is unavailable."),
      );
    }

    let raw;
    try {
      raw = await adapter.fetchLatestQuote(deepFreeze(clone(request)));
    } catch (error: unknown) {
      const occurredAt = this.clock.now();
      const normalizedError = adapter.normalizeError(error, deepFreeze(clone(request)), occurredAt);
      validateAdapterError(normalizedError, descriptor.providerId);
      return resultWithoutData(
        request,
        startedAt,
        MarketDataResultStatus.Unavailable,
        MarketDataQualityStatus.Unavailable,
        MarketDataTransportStatus.Failed,
        issue(MarketDataIssueCode.TransportFailure, normalizedError.safeMessage),
      );
    }

    const rawCopy = deepFreeze(clone(raw));
    if (!isRecord(rawCopy) || rawCopy.providerId !== descriptor.providerId || !isTimestamp(rawCopy.receivedAt)) {
      return resultWithoutData(
        request,
        startedAt,
        MarketDataResultStatus.Rejected,
        MarketDataQualityStatus.Invalid,
        MarketDataTransportStatus.Succeeded,
        issue(MarketDataIssueCode.InvalidProviderIdentity, "Raw response envelope is invalid."),
        MarketDataNormalizationStatus.NotAttempted,
      );
    }

    let normalized;
    try {
      normalized = adapter.normalizeLatestQuote(rawCopy, deepFreeze(clone(request)));
    } catch {
      return resultWithoutData(
        request,
        startedAt,
        MarketDataResultStatus.Rejected,
        MarketDataQualityStatus.Invalid,
        MarketDataTransportStatus.Succeeded,
        issue(MarketDataIssueCode.NormalizationRejected, "Adapter normalization failed safely."),
        MarketDataNormalizationStatus.Rejected,
      );
    }
    validateNormalizationEnvelope(normalized, descriptor.providerId);
    if (normalized.status === MarketDataNormalizationStatus.Rejected || normalized.data === undefined) {
      const blockers = normalized.blockers.length > 0
        ? sortIssues(normalized.blockers)
        : [issue(MarketDataIssueCode.NormalizationRejected, "Adapter rejected the provider response.")];
      const quality = blockers.some((blocker) => blocker.code === MarketDataIssueCode.ConflictingFields)
        ? MarketDataQualityStatus.Conflicting
        : blockers.some((blocker) => blocker.code === MarketDataIssueCode.MissingRequiredField)
          ? MarketDataQualityStatus.Incomplete
          : MarketDataQualityStatus.Invalid;
      return resultWithoutData(
        request,
        startedAt,
        MarketDataResultStatus.Rejected,
        quality,
        MarketDataTransportStatus.Succeeded,
        blockers,
        MarketDataNormalizationStatus.Rejected,
        normalized.warnings,
      );
    }

    const rule = findFreshnessRule(request, normalized.data.instrument?.assetClass);
    const assessment = validateCandidate(request, normalized.data, descriptor, rule, rawCopy.receivedAt);
    if (assessment.blockers.length > 0) {
      return dataValidationFailure(
        request,
        startedAt,
        normalized.data.receivedAt,
        assessment,
        normalized.warnings,
      );
    }

    const candidate = normalized.data;
    const instrument = candidate.instrument as CanonicalInstrumentIdentity;
    const fingerprint = quoteFingerprint(candidate);
    const quote: CanonicalMarketQuote = {
      schemaVersion: MARKET_DATA_SCHEMA_VERSION,
      dataType: MarketDataType.Quote,
      instrument: clone(instrument),
      bidPrice: clone(candidate.bidPrice!),
      askPrice: clone(candidate.askPrice!),
      ...(candidate.bidSize === undefined ? {} : { bidSize: clone(candidate.bidSize) }),
      ...(candidate.askSize === undefined ? {} : { askSize: clone(candidate.askSize) }),
      ...(candidate.quantityUnit === undefined ? {} : { quantityUnit: candidate.quantityUnit }),
      ...(candidate.observationTime === undefined ? {} : { observationTime: candidate.observationTime }),
      ...(candidate.providerPublishedAt === undefined ? {} : { providerPublishedAt: candidate.providerPublishedAt }),
      receivedAt: candidate.receivedAt!,
      normalizedAt: candidate.normalizedAt!,
      source: clone(candidate.source!),
      fingerprint,
    };
    const warnings = sortIssues([
      ...normalized.warnings,
      ...assessment.warnings,
    ]);
    const processedAt = this.clock.now();

    return deepFreeze({
      schemaVersion: MARKET_DATA_SCHEMA_VERSION,
      requestId: request.requestId,
      operation: MarketDataOperation.LatestQuote,
      status: MarketDataResultStatus.Accepted,
      qualityStatus: MarketDataQualityStatus.Valid,
      providerId: request.providerId,
      capability: MarketDataCapability.LatestQuote,
      requestedInstrument: clone(request.instrument),
      canonicalInstrument: clone(instrument),
      ...(quote.observationTime === undefined ? {} : { observationTime: quote.observationTime }),
      receivedAt: quote.receivedAt,
      data: quote,
      transportStatus: MarketDataTransportStatus.Succeeded,
      normalizationStatus: MarketDataNormalizationStatus.Normalized,
      validation: {
        status: MarketDataValidationStatus.Passed,
        checks: assessment.checks,
      },
      blockers: [],
      warnings,
      policyId: request.policy.policyId,
      policyVersion: request.policy.version,
      trace: clone(request.trace),
      processing: processing(request, startedAt, processedAt),
    });
  }
}

interface CandidateAssessment {
  readonly checks: readonly MarketDataValidationCheck[];
  readonly blockers: readonly MarketDataNormalizationIssue[];
  readonly warnings: readonly MarketDataNormalizationIssue[];
  readonly qualityStatus: MarketDataQualityStatus;
}

function validateCandidate(
  request: LatestQuoteRequest,
  candidate: NonNullable<ReturnType<MarketDataProviderAdapter["normalizeLatestQuote"]>["data"]>,
  descriptor: MarketDataProviderDescriptor,
  rule: MarketDataFreshnessRule | undefined,
  rawReceivedAt: string,
): CandidateAssessment {
  const issues = new Map<MarketDataValidationDimension, MarketDataNormalizationIssue[]>();
  const add = (dimension: MarketDataValidationDimension, value: MarketDataNormalizationIssue): void => {
    issues.set(dimension, [...(issues.get(dimension) ?? []), value]);
  };

  if (!candidate.instrument || candidate.instrument.schemaVersion !== MARKET_DATA_SCHEMA_VERSION) {
    add(MarketDataValidationDimension.Schema, issue(MarketDataIssueCode.MissingRequiredField, "Canonical instrument is required.", "instrument"));
  }
  if (!candidate.source || candidate.source.providerId !== descriptor.providerId || candidate.source.adapterId !== descriptor.adapterId) {
    add(MarketDataValidationDimension.ProviderIdentity, issue(MarketDataIssueCode.InvalidProviderIdentity, "Source provider and adapter identity must match the selected adapter.", "source"));
  }
  if (candidate.instrument) {
    if (!validateCanonicalInstrument(candidate.instrument).valid
      || candidate.instrument.instrumentId !== request.instrument.instrumentId) {
      add(MarketDataValidationDimension.InstrumentIdentity, issue(MarketDataIssueCode.InvalidInstrumentIdentity, "Canonical instrument identity is invalid or does not match the request.", "instrument"));
    }
    if (!descriptor.supportedAssetClasses.includes(candidate.instrument.assetClass)) {
      add(MarketDataValidationDimension.InstrumentIdentity, issue(MarketDataIssueCode.InvalidInstrumentIdentity, "Provider does not declare support for the canonical instrument asset class.", "instrument.assetClass"));
    }
    if (rule === undefined) {
      add(MarketDataValidationDimension.Schema, issue(MarketDataIssueCode.MissingRequiredField, "Policy has no quote rule for the canonical instrument asset class.", "policy.freshnessRules"));
    }
  }
  if (!candidate.source
    || !validIdentifier(candidate.source.providerInstrumentId)
    || !validIdentifier(candidate.source.providerSymbol)
    || !nonEmpty(candidate.source.sourceReference)
    || !nonEmpty(candidate.source.contentIntegrityReference)) {
    add(MarketDataValidationDimension.Provenance, issue(MarketDataIssueCode.MissingProvenance, "Provider source references and content integrity metadata are required.", "source"));
  }

  const timestampFields: Array<[string, string | undefined]> = [
    ["observationTime", candidate.observationTime],
    ["providerPublishedAt", candidate.providerPublishedAt],
    ["receivedAt", candidate.receivedAt],
    ["normalizedAt", candidate.normalizedAt],
  ];
  for (const [field, timestamp] of timestampFields) {
    if (timestamp !== undefined && !isTimestamp(timestamp)) {
      add(MarketDataValidationDimension.Timestamp, issue(MarketDataIssueCode.InvalidTimestamp, `${field} must be a canonical UTC timestamp.`, field));
    }
  }
  if (!candidate.receivedAt || !candidate.normalizedAt) {
    add(MarketDataValidationDimension.Timestamp, issue(MarketDataIssueCode.MissingRequiredField, "Receipt and normalization timestamps are required.", "receivedAt"));
  }
  if (candidate.receivedAt !== undefined && candidate.receivedAt !== rawReceivedAt) {
    add(MarketDataValidationDimension.Provenance, issue(MarketDataIssueCode.MissingProvenance, "Normalized receipt time must preserve the raw response receipt time.", "receivedAt"));
  }
  if (rule?.requireObservationTime === true && candidate.observationTime === undefined) {
    add(MarketDataValidationDimension.Timestamp, issue(MarketDataIssueCode.MissingObservationTime, "Observation time is required by policy.", "observationTime"));
  }
  if (candidate.observationTime && isTimestamp(candidate.observationTime)) {
    const observationMs = Date.parse(candidate.observationTime);
    const evaluatedMs = Date.parse(request.evaluatedAt);
    if (observationMs > evaluatedMs) {
      add(MarketDataValidationDimension.Timestamp, issue(MarketDataIssueCode.FutureObservation, "Observation time cannot be after evaluation time.", "observationTime"));
    }
    if (rule && evaluatedMs - observationMs > rule.maxAgeSeconds * 1000) {
      add(MarketDataValidationDimension.Freshness, issue(MarketDataIssueCode.StaleObservation, "Observation exceeds the policy freshness threshold.", "observationTime"));
    }
    if (request.previousObservationTime && observationMs < Date.parse(request.previousObservationTime)) {
      add(MarketDataValidationDimension.Ordering, issue(MarketDataIssueCode.OutOfOrderObservation, "Observation precedes the previous accepted observation.", "observationTime"));
    }
  }
  if (candidate.providerPublishedAt && candidate.observationTime
    && isTimestamp(candidate.providerPublishedAt) && isTimestamp(candidate.observationTime)
    && Date.parse(candidate.providerPublishedAt) < Date.parse(candidate.observationTime)) {
    add(MarketDataValidationDimension.Timestamp, issue(MarketDataIssueCode.InvalidTimestamp, "Provider publication time cannot precede observation time.", "providerPublishedAt"));
  }
  if (candidate.receivedAt && candidate.providerPublishedAt
    && isTimestamp(candidate.receivedAt) && isTimestamp(candidate.providerPublishedAt)
    && Date.parse(candidate.receivedAt) < Date.parse(candidate.providerPublishedAt)) {
    add(MarketDataValidationDimension.Timestamp, issue(MarketDataIssueCode.InvalidTimestamp, "Receipt time cannot precede provider publication time.", "receivedAt"));
  }
  if (candidate.normalizedAt && candidate.receivedAt
    && isTimestamp(candidate.normalizedAt) && isTimestamp(candidate.receivedAt)
    && Date.parse(candidate.normalizedAt) < Date.parse(candidate.receivedAt)) {
    add(MarketDataValidationDimension.Timestamp, issue(MarketDataIssueCode.InvalidTimestamp, "Normalization time cannot precede receipt time.", "normalizedAt"));
  }

  if (!candidate.instrument || !CURRENCY.test(candidate.instrument.currency)
    || (rule !== undefined && !rule.allowedCurrencies.includes(candidate.instrument.currency))) {
    add(MarketDataValidationDimension.Numeric, issue(MarketDataIssueCode.InvalidCurrency, "Currency is invalid or not allowed by policy.", "instrument.currency"));
  }
  for (const [field, value] of [["bidPrice", candidate.bidPrice], ["askPrice", candidate.askPrice]] as const) {
    if (!value || !validDecimal(value.atomicValue, value.scale, false)) {
      add(MarketDataValidationDimension.Numeric, issue(MarketDataIssueCode.InvalidNumericValue, `${field} must be a positive fixed decimal.`, field));
    } else if (rule && value.scale > rule.maxPriceScale) {
      add(MarketDataValidationDimension.Precision, issue(MarketDataIssueCode.InvalidPrecision, `${field} exceeds policy precision.`, field));
    }
  }
  const hasAnySize = candidate.bidSize !== undefined || candidate.askSize !== undefined || candidate.quantityUnit !== undefined;
  if (hasAnySize && (!candidate.bidSize || !candidate.askSize || candidate.quantityUnit !== MarketDataQuantityUnit.BaseUnits)) {
    add(MarketDataValidationDimension.Numeric, issue(MarketDataIssueCode.AmbiguousUnits, "Both sizes and an explicit base-unit quantity are required together.", "quantityUnit"));
  } else if (hasAnySize && (!validDecimal(candidate.bidSize!.atomicValue, candidate.bidSize!.scale, true)
    || !validDecimal(candidate.askSize!.atomicValue, candidate.askSize!.scale, true))) {
    add(MarketDataValidationDimension.Numeric, issue(MarketDataIssueCode.InvalidNumericValue, "Quote sizes must be non-negative fixed decimals.", "bidSize"));
  }
  if (candidate.bidPrice && candidate.askPrice
    && validDecimal(candidate.bidPrice.atomicValue, candidate.bidPrice.scale, false)
    && validDecimal(candidate.askPrice.atomicValue, candidate.askPrice.scale, false)
    && compareDecimal(candidate.bidPrice, candidate.askPrice) > 0) {
    add(MarketDataValidationDimension.InternalConsistency, issue(MarketDataIssueCode.InvalidQuoteRelationship, "Bid price cannot exceed ask price.", "bidPrice"));
  }
  if (request.previousFingerprint && request.previousFingerprint === quoteFingerprint(candidate)) {
    const duplicate = issue(MarketDataIssueCode.DuplicateObservation, "Quote exactly matches the previous accepted observation.");
    if (request.policy.duplicatePolicy === MarketDataDuplicatePolicy.RejectExact) {
      add(MarketDataValidationDimension.Duplicate, duplicate);
    }
  }

  const dimensions = Object.values(MarketDataValidationDimension);
  const checks = dimensions.map((dimension) => ({
    dimension,
    status: issues.has(dimension) ? MarketDataDimensionStatus.Failed : MarketDataDimensionStatus.Passed,
    issueCodes: [...new Set((issues.get(dimension) ?? []).map((value) => value.code))].sort(),
  }));
  const blockers = sortIssues([...issues.values()].flat());
  const warnings = request.previousFingerprint
    && request.previousFingerprint === quoteFingerprint(candidate)
    && request.policy.duplicatePolicy === MarketDataDuplicatePolicy.AllowExactWithWarning
    ? [issue(MarketDataIssueCode.DuplicateObservation, "Quote exactly matches the previous accepted observation.")]
    : [];

  return {
    checks,
    blockers,
    warnings,
    qualityStatus: qualityFromIssues(blockers),
  };
}

function validateRequest(value: unknown): LatestQuoteRequest {
  if (!isRecord(value)
    || value.schemaVersion !== MARKET_DATA_SCHEMA_VERSION
    || value.operation !== MarketDataOperation.LatestQuote
    || !validIdentifier(value.requestId)
    || !validIdentifier(value.providerId)
    || !isRecord(value.instrument)
    || !isCanonicalInstrumentId(value.instrument.instrumentId)
    || !isTimestamp(value.requestedAt)
    || !isTimestamp(value.evaluatedAt)
    || !isRecord(value.trace)
    || !validIdentifier(value.trace.correlationId)
    || !isRecord(value.policy)) {
    throw new MarketDataConfigurationError("Latest quote request is malformed.");
  }
  const policy = value.policy;
  if (policy.schemaVersion !== MARKET_DATA_SCHEMA_VERSION
    || !validIdentifier(policy.policyId)
    || !validIdentifier(policy.version)
    || !Array.isArray(policy.allowedProviderIds)
    || !policy.allowedProviderIds.every(validIdentifier)
    || !Array.isArray(policy.requiredCapabilities)
    || !policy.requiredCapabilities.every((entry) => Object.values(MarketDataCapability).includes(entry as MarketDataCapability))
    || !policy.requiredCapabilities.includes(MarketDataCapability.LatestQuote)
    || !Object.values(MarketDataDuplicatePolicy).includes(policy.duplicatePolicy as MarketDataDuplicatePolicy)
    || !Array.isArray(policy.freshnessRules)
    || policy.freshnessRules.length === 0) {
    throw new MarketDataConfigurationError("Market data policy is malformed.");
  }
  for (const rule of policy.freshnessRules) {
    if (!isRecord(rule)
      || !Object.values(InstrumentAssetClass).includes(rule.assetClass as InstrumentAssetClass)
      || rule.dataType !== MarketDataType.Quote
      || !Number.isSafeInteger(rule.maxAgeSeconds) || (rule.maxAgeSeconds as number) < 0
      || !Number.isSafeInteger(rule.maxPriceScale) || (rule.maxPriceScale as number) < 0 || (rule.maxPriceScale as number) > 18
      || !Array.isArray(rule.allowedCurrencies) || !rule.allowedCurrencies.every((currency) => typeof currency === "string" && CURRENCY.test(currency))
      || typeof rule.requireObservationTime !== "boolean") {
      throw new MarketDataConfigurationError("Market data freshness rule is malformed.");
    }
  }
  if (value.previousObservationTime !== undefined && !isTimestamp(value.previousObservationTime)) {
    throw new MarketDataConfigurationError("Previous observation time must be a canonical UTC timestamp.");
  }
  if (value.previousFingerprint !== undefined && !nonEmpty(value.previousFingerprint)) {
    throw new MarketDataConfigurationError("Previous fingerprint is malformed.");
  }
  return deepFreeze(clone(value as unknown as LatestQuoteRequest));
}

function validateDescriptor(value: MarketDataProviderDescriptor): MarketDataProviderDescriptor {
  if (!isRecord(value)
    || value.schemaVersion !== MARKET_DATA_SCHEMA_VERSION
    || !validIdentifier(value.adapterId)
    || !validIdentifier(value.adapterVersion)
    || !validIdentifier(value.providerId)
    || typeof value.enabled !== "boolean"
    || !Array.isArray(value.capabilities)
    || value.capabilities.length === 0
    || !value.capabilities.every((entry) => Object.values(MarketDataCapability).includes(entry))
    || new Set(value.capabilities).size !== value.capabilities.length
    || !Array.isArray(value.supportedAssetClasses)
    || value.supportedAssetClasses.length === 0
    || !value.supportedAssetClasses.every((entry) => Object.values(InstrumentAssetClass).includes(entry))) {
    throw new MarketDataConfigurationError("Provider descriptor is malformed.");
  }
  return value;
}

function validateHealth(value: unknown, providerId: string): void {
  if (!isRecord(value)
    || value.providerId !== providerId
    || !Object.values(MarketDataProviderHealthStatus).includes(value.status as MarketDataProviderHealthStatus)
    || !isTimestamp(value.observedAt)) {
    throw new MarketDataConfigurationError("Provider health response is malformed.");
  }
}

function validateAdapterError(value: unknown, providerId: string): void {
  if (!isRecord(value) || value.providerId !== providerId || !nonEmpty(value.safeCode)
    || !nonEmpty(value.safeMessage) || typeof value.retryable !== "boolean" || !isTimestamp(value.occurredAt)) {
    throw new MarketDataConfigurationError("Provider error normalization is malformed.");
  }
}

function validateNormalizationEnvelope(value: unknown, providerId: string): asserts value is ReturnType<MarketDataProviderAdapter["normalizeLatestQuote"]> {
  if (!isRecord(value)
    || value.providerId !== providerId
    || ![MarketDataNormalizationStatus.Normalized, MarketDataNormalizationStatus.Rejected].includes(value.status as MarketDataNormalizationStatus)
    || !Array.isArray(value.blockers)
    || !Array.isArray(value.warnings)) {
    throw new MarketDataConfigurationError("Normalization result is malformed.");
  }
}

function findFreshnessRule(request: LatestQuoteRequest, assetClass: InstrumentAssetClass | undefined): MarketDataFreshnessRule | undefined {
  if (assetClass === undefined) return undefined;
  return request.policy.freshnessRules.find((rule) => rule.assetClass === assetClass && rule.dataType === MarketDataType.Quote);
}

function dataValidationFailure(
  request: LatestQuoteRequest,
  startedAt: number,
  receivedAt: string | undefined,
  assessment: CandidateAssessment,
  normalizationWarnings: readonly MarketDataNormalizationIssue[],
): MarketDataResult {
  const processedAt = new Date(startedAt).toISOString();
  return deepFreeze({
    schemaVersion: MARKET_DATA_SCHEMA_VERSION,
    requestId: request.requestId,
    operation: MarketDataOperation.LatestQuote,
    status: MarketDataResultStatus.Rejected,
    qualityStatus: assessment.qualityStatus,
    providerId: request.providerId,
    capability: MarketDataCapability.LatestQuote,
    requestedInstrument: clone(request.instrument),
    ...(receivedAt === undefined ? {} : { receivedAt }),
    transportStatus: MarketDataTransportStatus.Succeeded,
    normalizationStatus: MarketDataNormalizationStatus.Normalized,
    validation: { status: MarketDataValidationStatus.Failed, checks: assessment.checks },
    blockers: assessment.blockers,
    warnings: sortIssues([...normalizationWarnings, ...assessment.warnings]),
    policyId: request.policy.policyId,
    policyVersion: request.policy.version,
    trace: clone(request.trace),
    processing: processing(request, startedAt, processedAt),
  });
}

function resultWithoutData(
  request: LatestQuoteRequest,
  startedAt: number,
  status: MarketDataResultStatus,
  qualityStatus: MarketDataQualityStatus,
  transportStatus: MarketDataTransportStatus,
  blockers: MarketDataNormalizationIssue | readonly MarketDataNormalizationIssue[],
  normalizationStatus = MarketDataNormalizationStatus.NotAttempted,
  warnings: readonly MarketDataNormalizationIssue[] = [],
): MarketDataResult {
  const processedAt = new Date(startedAt).toISOString();
  const sortedBlockers = sortIssues(Array.isArray(blockers) ? blockers : [blockers]);
  return deepFreeze({
    schemaVersion: MARKET_DATA_SCHEMA_VERSION,
    requestId: request.requestId,
    operation: MarketDataOperation.LatestQuote,
    status,
    qualityStatus,
    providerId: request.providerId,
    capability: MarketDataCapability.LatestQuote,
    requestedInstrument: clone(request.instrument),
    transportStatus,
    normalizationStatus,
    validation: {
      status: MarketDataValidationStatus.NotRun,
      checks: [],
    },
    blockers: sortedBlockers,
    warnings: sortIssues(warnings),
    policyId: request.policy.policyId,
    policyVersion: request.policy.version,
    trace: clone(request.trace),
    processing: processing(request, startedAt, processedAt),
  });
}

function processing(request: LatestQuoteRequest, startedAt: number, processedAt: string) {
  const processedMs = Date.parse(processedAt);
  return {
    requestedAt: request.requestedAt,
    evaluatedAt: request.evaluatedAt,
    processedAt,
    durationMs: Math.max(0, processedMs - startedAt),
  };
}

function qualityFromIssues(issues: readonly MarketDataNormalizationIssue[]): MarketDataQualityStatus {
  if (issues.some((value) => value.code === MarketDataIssueCode.OutOfOrderObservation)) return MarketDataQualityStatus.OutOfOrder;
  if (issues.some((value) => value.code === MarketDataIssueCode.StaleObservation)) return MarketDataQualityStatus.Stale;
  if (issues.some((value) => value.code === MarketDataIssueCode.ConflictingFields)) return MarketDataQualityStatus.Conflicting;
  if (issues.some((value) => [MarketDataIssueCode.MissingRequiredField, MarketDataIssueCode.MissingObservationTime, MarketDataIssueCode.MissingProvenance].includes(value.code))) {
    return MarketDataQualityStatus.Incomplete;
  }
  return MarketDataQualityStatus.Invalid;
}

function quoteFingerprint(candidate: NonNullable<ReturnType<MarketDataProviderAdapter["normalizeLatestQuote"]>["data"]>): string {
  return [
    candidate.instrument?.instrumentId ?? "",
    candidate.bidPrice ? `${candidate.bidPrice.atomicValue}:${candidate.bidPrice.scale}` : "",
    candidate.askPrice ? `${candidate.askPrice.atomicValue}:${candidate.askPrice.scale}` : "",
    candidate.bidSize ? `${candidate.bidSize.atomicValue}:${candidate.bidSize.scale}` : "",
    candidate.askSize ? `${candidate.askSize.atomicValue}:${candidate.askSize.scale}` : "",
    candidate.quantityUnit ?? "",
    candidate.observationTime ?? "",
    candidate.source?.providerId ?? "",
    candidate.source?.sourceReference ?? "",
  ].join("|");
}

function compareDecimal(left: { atomicValue: string; scale: number }, right: { atomicValue: string; scale: number }): number {
  const scale = Math.max(left.scale, right.scale);
  const leftValue = BigInt(left.atomicValue) * (10n ** BigInt(scale - left.scale));
  const rightValue = BigInt(right.atomicValue) * (10n ** BigInt(scale - right.scale));
  return leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0;
}

function validDecimal(atomicValue: unknown, scale: unknown, allowZero: boolean): boolean {
  if (typeof atomicValue !== "string" || !INTEGER.test(atomicValue) || !Number.isSafeInteger(scale) || (scale as number) < 0 || (scale as number) > 18) return false;
  const value = BigInt(atomicValue);
  return allowZero ? value >= 0n : value > 0n;
}

function issue(code: MarketDataIssueCode, message: string, field?: string): MarketDataNormalizationIssue {
  return { code, message, ...(field === undefined ? {} : { field }) };
}

function sortIssues(values: readonly MarketDataNormalizationIssue[]): MarketDataNormalizationIssue[] {
  return values.map((value) => ({ ...value })).sort((left, right) => `${left.code}|${left.field ?? ""}|${left.message}`.localeCompare(`${right.code}|${right.field ?? ""}|${right.message}`));
}

function copyDescriptor(value: MarketDataProviderDescriptor): MarketDataProviderDescriptor {
  return {
    ...value,
    capabilities: [...value.capabilities].sort(),
    supportedAssetClasses: [...value.supportedAssetClasses].sort(),
  };
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
  if (Array.isArray(value)) return value.map((entry) => clone(entry)) as T;
  if (isRecord(value)) {
    const output: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) output[key] = clone(entry);
    return output as T;
  }
  return value;
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) deepFreeze(nested);
  }
  return value;
}
