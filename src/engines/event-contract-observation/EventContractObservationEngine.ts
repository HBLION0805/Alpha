import {
  EVENT_CONTRACT_OBSERVATION_INSTRUMENT_ID,
  EVENT_CONTRACT_OBSERVATION_MAX_ATOMIC_DIGITS,
  EVENT_CONTRACT_OBSERVATION_MAX_DECIMAL_SCALE,
  EVENT_CONTRACT_OBSERVATION_OUTCOME_PAIR,
  EVENT_CONTRACT_OBSERVATION_SCHEMA_VERSION,
  EventContractEvaluationMethod,
  EventContractEvidenceKind,
  EventContractObservationAuthorizationStatus,
  EventContractObservationEventType,
  EventContractObservationIssueCode,
  EventContractPlatform,
  EventContractObservationSide,
  EventContractThresholdOperator,
  type EventContractFeePreview,
  type EventContractFixedDecimal,
  type EventContractObservationEvidence,
  type EventContractObservationInput,
  type EventContractObservationIssue,
  type EventContractObservationPolicy,
  type EventContractObservationRecord,
  type EventContractObservationValidationResult,
  type EventContractReferencePriceObservation,
  type EventContractSettlementTerms,
  type EventContractSideEconomics,
  type EventContractSideQuote,
} from "../../contracts/EventContractObservation";

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/u;
const VERSION = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u;
const INTEGER = /^-?(?:0|[1-9][0-9]*)$/u;
const MONEY_SCALE = 8;
const MONEY_FACTOR = 100_000_000n;
const CONTRACT_PRICE_FACTOR = 10_000n;

const INPUT_KEYS = ["schemaVersion", "observationId", "capturedAt", "contract", "referencePrice", "quotes", "feePreviews", "evidence"] as const;
const CONTRACT_KEYS = ["termsId", "termsVersion", "platform", "exchangeId", "marketId", "contractId", "title", "eventType", "instrumentId", "outcomePair", "windowStartsAt", "tradingClosesAt", "evaluatesAt", "evaluationMethod", "thresholdOperator", "targetPrice", "settlementSourceId", "settlementSourceName", "termsSourceId", "termsSourceRecordId", "termsEvidenceId"] as const;
const REFERENCE_PRICE_KEYS = ["price", "observedAt", "sourceId", "sourceRecordId", "evidenceId"] as const;
const QUOTE_KEYS = ["side", "bidPriceBasisPoints", "askPriceBasisPoints", "observedAt", "sourceId", "sourceRecordId", "evidenceId"] as const;
const PREVIEW_KEYS = ["side", "quoteSourceRecordId", "quantity", "contractPriceBasisPoints", "capturedAt", "contractSubtotal", "robinhoodCommission", "exchangeFee", "otherFees", "totalCost", "maximumPayout", "feeSourceId", "feeSourceRecordId", "evidenceId"] as const;
const EVIDENCE_KEYS = ["evidenceId", "kind", "capturedAt", "sourceId", "sourceRecordId"] as const;
const DECIMAL_KEYS = ["atomicValue", "scale"] as const;
type ExpectedEvidence = {
  readonly evidenceId: string;
  readonly kind: EventContractEvidenceKind;
  readonly capturedAt: string | undefined;
  readonly sourceId: string | undefined;
  readonly sourceRecordId: string | undefined;
};

export const DEFAULT_EVENT_CONTRACT_OBSERVATION_POLICY: EventContractObservationPolicy = deepFreeze({
  policyId: "event-contract-observation:btc-15-minute:1",
  version: "1.0",
  ruleSetVersion: "1.0",
  eventDurationSeconds: 900,
  maximumReferencePriceAgeMilliseconds: 2_000,
  maximumQuoteAgeMilliseconds: 2_000,
  maximumFeePreviewAgeMilliseconds: 5_000,
  maximumQuantity: 50_000,
});

export class EventContractObservationValidationError extends Error {
  public constructor(public readonly issues: readonly EventContractObservationIssue[]) {
    super("Event contract observation validation failed.");
    this.name = "EventContractObservationValidationError";
  }
}

export class EventContractObservationEngine {
  readonly #policy: EventContractObservationPolicy;

  public constructor(policy: Readonly<EventContractObservationPolicy> = DEFAULT_EVENT_CONTRACT_OBSERVATION_POLICY) {
    const issues = validateEventContractObservationPolicy(policy);
    if (issues.length > 0) throw new EventContractObservationValidationError(issues);
    this.#policy = deepFreeze(structuredClone(policy));
  }

  public create(value: unknown): EventContractObservationRecord {
    const validation = validateEventContractObservationInput(value, this.#policy);
    if (!validation.valid) throw new EventContractObservationValidationError(validation.issues);
    const input = value as EventContractObservationInput;
    const quotes = input.quotes.map(canonicalQuote).sort(sideOrder);
    const feePreviews = input.feePreviews.map(canonicalPreview).sort(sideOrder);
    const evidence = input.evidence.map(canonicalEvidence).sort((left, right) => left.evidenceId.localeCompare(right.evidenceId));
    const sideEconomics = feePreviews.map((preview) => deriveEconomics(preview, quotes)).sort(sideOrder);
    const base = {
      schemaVersion: EVENT_CONTRACT_OBSERVATION_SCHEMA_VERSION,
      observationId: input.observationId,
      capturedAt: input.capturedAt,
      remainingSeconds: Math.trunc((Date.parse(input.contract.evaluatesAt) - Date.parse(input.capturedAt)) / 1_000),
      contract: canonicalContract(input.contract),
      referencePrice: canonicalReferencePrice(input.referencePrice),
      quotes,
      feePreviews,
      evidence,
      sideEconomics,
      policyId: this.#policy.policyId,
      policyVersion: this.#policy.version,
      ruleSetVersion: this.#policy.ruleSetVersion,
      authorizationStatus: EventContractObservationAuthorizationStatus.ObservationOnly,
      deterministic: true as const,
      readOnly: true as const,
    };
    return deepFreeze({ ...base, fingerprint: `fnv1a64:${fnv1a64(canonicalize(base))}` });
  }
}

export function validateEventContractObservationInput(
  value: unknown,
  policy: Readonly<EventContractObservationPolicy> = DEFAULT_EVENT_CONTRACT_OBSERVATION_POLICY,
): EventContractObservationValidationResult {
  const issues: EventContractObservationIssue[] = [...validateEventContractObservationPolicy(policy)];
  if (!isRecord(value)) return validationResult([...issues, issue(EventContractObservationIssueCode.InvalidRecord, "input", "Observation input must be an object.")]);
  validateExactKeys(issues, value, INPUT_KEYS, "input", EventContractObservationIssueCode.InvalidRecord);
  if (value.schemaVersion !== EVENT_CONTRACT_OBSERVATION_SCHEMA_VERSION) add(issues, EventContractObservationIssueCode.InvalidSchemaVersion, "schemaVersion", "Schema version is unsupported.");
  validateIdentifier(issues, value.observationId, "observationId");
  validateTimestamp(issues, value.capturedAt, "capturedAt");
  validateContract(issues, value.contract, value.capturedAt, policy);
  validateReferencePrice(issues, value.referencePrice, value.capturedAt, policy);
  if (isRecord(value.contract) && isRecord(value.referencePrice) && value.referencePrice.sourceId !== value.contract.settlementSourceId) add(issues, EventContractObservationIssueCode.MismatchedReference, "referencePrice.sourceId", "Reference-price source must match the contract settlement source.");
  validateQuotes(issues, value.quotes, value.capturedAt, policy);
  validatePreviews(issues, value.feePreviews, value.quotes, value.capturedAt, policy);
  validateEvidence(issues, value.evidence, value, value.capturedAt);
  return validationResult(issues);
}

export function validateEventContractObservationPolicy(value: unknown): readonly EventContractObservationIssue[] {
  const issues: EventContractObservationIssue[] = [];
  if (!isRecord(value)) return deepFreeze([issue(EventContractObservationIssueCode.InvalidPolicy, "policy", "Policy must be an object.")]);
  const keys = ["policyId", "version", "ruleSetVersion", "eventDurationSeconds", "maximumReferencePriceAgeMilliseconds", "maximumQuoteAgeMilliseconds", "maximumFeePreviewAgeMilliseconds", "maximumQuantity"] as const;
  validateExactKeys(issues, value, keys, "policy", EventContractObservationIssueCode.InvalidPolicy);
  validateIdentifier(issues, value.policyId, "policy.policyId", EventContractObservationIssueCode.InvalidPolicy);
  validateVersion(issues, value.version, "policy.version", EventContractObservationIssueCode.InvalidPolicy);
  validateVersion(issues, value.ruleSetVersion, "policy.ruleSetVersion", EventContractObservationIssueCode.InvalidPolicy);
  for (const field of ["eventDurationSeconds", "maximumReferencePriceAgeMilliseconds", "maximumQuoteAgeMilliseconds", "maximumFeePreviewAgeMilliseconds", "maximumQuantity"] as const) {
    if (!Number.isSafeInteger(value[field]) || (value[field] as number) <= 0) add(issues, EventContractObservationIssueCode.InvalidPolicy, `policy.${field}`, `${field} must be a positive safe integer.`);
  }
  if (value.eventDurationSeconds !== 900) add(issues, EventContractObservationIssueCode.InvalidPolicy, "policy.eventDurationSeconds", "BTC 15-minute policy duration must be 900 seconds.");
  if (Number.isSafeInteger(value.maximumQuantity) && (value.maximumQuantity as number) > 50_000) add(issues, EventContractObservationIssueCode.InvalidPolicy, "policy.maximumQuantity", "Maximum quantity cannot exceed 50,000 contracts.");
  return deepFreeze(issues.sort(compareIssues));
}

function validateContract(issues: EventContractObservationIssue[], value: unknown, capturedAt: unknown, policy: Readonly<EventContractObservationPolicy>): void {
  if (!isRecord(value)) { add(issues, EventContractObservationIssueCode.InvalidContract, "contract", "Contract must be an object."); return; }
  validateExactKeys(issues, value, CONTRACT_KEYS, "contract", EventContractObservationIssueCode.InvalidContract);
  for (const field of ["termsId", "exchangeId", "marketId", "contractId", "settlementSourceId", "termsSourceId", "termsSourceRecordId", "termsEvidenceId"] as const) validateIdentifier(issues, value[field], `contract.${field}`);
  validateVersion(issues, value.termsVersion, "contract.termsVersion");
  validateText(issues, value.title, "contract.title", 300);
  validateText(issues, value.settlementSourceName, "contract.settlementSourceName", 160);
  if (value.platform !== EventContractPlatform.Robinhood) add(issues, EventContractObservationIssueCode.InvalidContract, "contract.platform", "Day15-T1 supports Robinhood observations only.");
  if (value.eventType !== EventContractObservationEventType.BtcFifteenMinute) add(issues, EventContractObservationIssueCode.InvalidContract, "contract.eventType", "Day15-T1 supports BTC 15-minute events only.");
  if (value.instrumentId !== EVENT_CONTRACT_OBSERVATION_INSTRUMENT_ID) add(issues, EventContractObservationIssueCode.InvalidContract, "contract.instrumentId", "Canonical instrument must be BTC-USD.");
  if (value.outcomePair !== EVENT_CONTRACT_OBSERVATION_OUTCOME_PAIR) add(issues, EventContractObservationIssueCode.InvalidContract, "contract.outcomePair", "Outcome pair must be UP_DOWN.");
  if (!isEnumValue(EventContractEvaluationMethod, value.evaluationMethod)) add(issues, EventContractObservationIssueCode.InvalidSettlementTerms, "contract.evaluationMethod", "Evaluation method is unsupported.");
  if (!isEnumValue(EventContractThresholdOperator, value.thresholdOperator)) add(issues, EventContractObservationIssueCode.InvalidSettlementTerms, "contract.thresholdOperator", "Threshold operator is unsupported.");
  validatePositiveDecimal(issues, value.targetPrice, "contract.targetPrice");
  for (const field of ["windowStartsAt", "tradingClosesAt", "evaluatesAt"] as const) validateTimestamp(issues, value[field], `contract.${field}`);
  if (isTimestamp(value.windowStartsAt) && isTimestamp(value.tradingClosesAt) && isTimestamp(value.evaluatesAt)) {
    const start = Date.parse(value.windowStartsAt);
    const closes = Date.parse(value.tradingClosesAt);
    const evaluates = Date.parse(value.evaluatesAt);
    if (evaluates - start !== policy.eventDurationSeconds * 1_000) add(issues, EventContractObservationIssueCode.InvalidSettlementTerms, "contract.evaluatesAt", "Contract window must be exactly 15 minutes.");
    if (closes < start || closes > evaluates) add(issues, EventContractObservationIssueCode.InvalidSettlementTerms, "contract.tradingClosesAt", "Trading close must fall within the contract window.");
    if (isTimestamp(capturedAt)) {
      const capture = Date.parse(capturedAt);
      if (capture < start || capture > closes) add(issues, EventContractObservationIssueCode.InvalidSettlementTerms, "capturedAt", "Capture must occur within the tradable contract window.");
    }
  }
}

function validateReferencePrice(issues: EventContractObservationIssue[], value: unknown, capturedAt: unknown, policy: Readonly<EventContractObservationPolicy>): void {
  if (!isRecord(value)) { add(issues, EventContractObservationIssueCode.InvalidRecord, "referencePrice", "Reference price must be an object."); return; }
  validateExactKeys(issues, value, REFERENCE_PRICE_KEYS, "referencePrice", EventContractObservationIssueCode.InvalidRecord);
  validatePositiveDecimal(issues, value.price, "referencePrice.price");
  validateTimestamp(issues, value.observedAt, "referencePrice.observedAt");
  for (const field of ["sourceId", "sourceRecordId", "evidenceId"] as const) validateIdentifier(issues, value[field], `referencePrice.${field}`);
  validateFreshness(issues, value.observedAt, capturedAt, policy.maximumReferencePriceAgeMilliseconds, "referencePrice.observedAt");
}

function validateQuotes(issues: EventContractObservationIssue[], value: unknown, capturedAt: unknown, policy: Readonly<EventContractObservationPolicy>): void {
  if (!Array.isArray(value)) { add(issues, EventContractObservationIssueCode.InvalidQuote, "quotes", "Quotes must be an array."); return; }
  validateSideCardinality(issues, value, "quotes");
  value.forEach((quote, index) => {
    const field = `quotes.${String(index)}`;
    if (!isRecord(quote)) { add(issues, EventContractObservationIssueCode.InvalidQuote, field, "Quote must be an object."); return; }
    validateExactKeys(issues, quote, QUOTE_KEYS, field, EventContractObservationIssueCode.InvalidQuote);
    if (!isEnumValue(EventContractObservationSide, quote.side)) add(issues, EventContractObservationIssueCode.InvalidQuote, `${field}.side`, "Quote side is unsupported.");
    validateContractPrice(issues, quote.askPriceBasisPoints, `${field}.askPriceBasisPoints`);
    if (quote.bidPriceBasisPoints !== null) {
      validateContractPrice(issues, quote.bidPriceBasisPoints, `${field}.bidPriceBasisPoints`);
      if (Number.isSafeInteger(quote.bidPriceBasisPoints) && Number.isSafeInteger(quote.askPriceBasisPoints) && (quote.bidPriceBasisPoints as number) > (quote.askPriceBasisPoints as number)) add(issues, EventContractObservationIssueCode.InvalidQuote, field, "Bid cannot exceed ask.");
    }
    validateTimestamp(issues, quote.observedAt, `${field}.observedAt`);
    for (const key of ["sourceId", "sourceRecordId", "evidenceId"] as const) validateIdentifier(issues, quote[key], `${field}.${key}`);
    validateFreshness(issues, quote.observedAt, capturedAt, policy.maximumQuoteAgeMilliseconds, `${field}.observedAt`);
  });
}

function validatePreviews(issues: EventContractObservationIssue[], value: unknown, quotesValue: unknown, capturedAt: unknown, policy: Readonly<EventContractObservationPolicy>): void {
  if (!Array.isArray(value)) { add(issues, EventContractObservationIssueCode.InvalidFeePreview, "feePreviews", "Fee previews must be an array."); return; }
  validateSideCardinality(issues, value, "feePreviews");
  const quotes = Array.isArray(quotesValue) ? quotesValue.filter(isRecord) : [];
  value.forEach((preview, index) => {
    const field = `feePreviews.${String(index)}`;
    if (!isRecord(preview)) { add(issues, EventContractObservationIssueCode.InvalidFeePreview, field, "Fee preview must be an object."); return; }
    validateExactKeys(issues, preview, PREVIEW_KEYS, field, EventContractObservationIssueCode.InvalidFeePreview);
    if (!isEnumValue(EventContractObservationSide, preview.side)) add(issues, EventContractObservationIssueCode.InvalidFeePreview, `${field}.side`, "Preview side is unsupported.");
    validateIdentifier(issues, preview.quoteSourceRecordId, `${field}.quoteSourceRecordId`);
    validateContractPrice(issues, preview.contractPriceBasisPoints, `${field}.contractPriceBasisPoints`);
    if (!Number.isSafeInteger(preview.quantity) || (preview.quantity as number) <= 0 || (preview.quantity as number) > policy.maximumQuantity) add(issues, EventContractObservationIssueCode.InvalidFeePreview, `${field}.quantity`, "Quantity must be a positive whole number within policy.");
    validateTimestamp(issues, preview.capturedAt, `${field}.capturedAt`);
    validateFreshness(issues, preview.capturedAt, capturedAt, policy.maximumFeePreviewAgeMilliseconds, `${field}.capturedAt`);
    for (const moneyField of ["contractSubtotal", "robinhoodCommission", "exchangeFee", "otherFees", "totalCost", "maximumPayout"] as const) validateNonNegativeDecimal(issues, preview[moneyField], `${field}.${moneyField}`);
    for (const key of ["feeSourceId", "feeSourceRecordId", "evidenceId"] as const) validateIdentifier(issues, preview[key], `${field}.${key}`);
    const quote = quotes.find((candidate) => candidate.side === preview.side);
    if (quote === undefined || quote.sourceRecordId !== preview.quoteSourceRecordId || quote.askPriceBasisPoints !== preview.contractPriceBasisPoints) add(issues, EventContractObservationIssueCode.MismatchedReference, field, "Fee preview must bind to the exact side quote and ask price.");
    if (quote !== undefined && isTimestamp(quote.observedAt) && isTimestamp(preview.capturedAt) && Date.parse(preview.capturedAt) < Date.parse(quote.observedAt)) add(issues, EventContractObservationIssueCode.InvalidFeePreview, `${field}.capturedAt`, "Fee preview cannot predate its referenced quote.");
    validatePreviewArithmetic(issues, preview, field);
  });
}

function validateEvidence(issues: EventContractObservationIssue[], value: unknown, input: Record<string, unknown>, capturedAt: unknown): void {
  if (!Array.isArray(value)) { add(issues, EventContractObservationIssueCode.InvalidEvidence, "evidence", "Evidence must be an array."); return; }
  const evidenceById = new Map<string, Record<string, unknown>>();
  value.forEach((entry, index) => {
    const field = `evidence.${String(index)}`;
    if (!isRecord(entry)) { add(issues, EventContractObservationIssueCode.InvalidEvidence, field, "Evidence must be an object."); return; }
    validateExactKeys(issues, entry, EVIDENCE_KEYS, field, EventContractObservationIssueCode.InvalidEvidence);
    validateIdentifier(issues, entry.evidenceId, `${field}.evidenceId`);
    if (!isEnumValue(EventContractEvidenceKind, entry.kind)) add(issues, EventContractObservationIssueCode.InvalidEvidence, `${field}.kind`, "Evidence kind is unsupported.");
    validateTimestamp(issues, entry.capturedAt, `${field}.capturedAt`);
    validateNotFuture(issues, entry.capturedAt, capturedAt, `${field}.capturedAt`);
    validateIdentifier(issues, entry.sourceId, `${field}.sourceId`);
    validateIdentifier(issues, entry.sourceRecordId, `${field}.sourceRecordId`);
    if (typeof entry.evidenceId === "string") {
      if (evidenceById.has(entry.evidenceId)) add(issues, EventContractObservationIssueCode.InvalidEvidence, `${field}.evidenceId`, "Evidence IDs must be unique.");
      evidenceById.set(entry.evidenceId, entry);
    }
  });

  const expected = collectExpectedEvidence(input);
  const actualIds = [...evidenceById.keys()].sort();
  const expectedIds = expected.map((entry) => entry.evidenceId).sort();
  if (canonicalize(actualIds) !== canonicalize(expectedIds)) add(issues, EventContractObservationIssueCode.InvalidEvidence, "evidence", "Evidence must contain exactly the records referenced by terms, price, quotes, and fee previews.");
  for (const reference of expected) {
    const evidence = evidenceById.get(reference.evidenceId);
    if (evidence === undefined) continue;
    if (evidence.kind !== reference.kind || (reference.capturedAt !== undefined && evidence.capturedAt !== reference.capturedAt) || (reference.sourceId !== undefined && evidence.sourceId !== reference.sourceId) || (reference.sourceRecordId !== undefined && evidence.sourceRecordId !== reference.sourceRecordId)) {
      add(issues, EventContractObservationIssueCode.MismatchedReference, `evidence.${reference.evidenceId}`, "Evidence type, time, source, and source record must match the referenced observation.");
    }
  }
}

function collectExpectedEvidence(input: Record<string, unknown>): ExpectedEvidence[] {
  const expected: ExpectedEvidence[] = [];
  if (isRecord(input.contract) && typeof input.contract.termsEvidenceId === "string") expected.push({ evidenceId: input.contract.termsEvidenceId, kind: EventContractEvidenceKind.Terms, capturedAt: undefined, sourceId: stringOrUndefined(input.contract.termsSourceId), sourceRecordId: stringOrUndefined(input.contract.termsSourceRecordId) });
  if (isRecord(input.referencePrice) && typeof input.referencePrice.evidenceId === "string") expected.push({ evidenceId: input.referencePrice.evidenceId, kind: EventContractEvidenceKind.ReferencePrice, capturedAt: stringOrUndefined(input.referencePrice.observedAt), sourceId: stringOrUndefined(input.referencePrice.sourceId), sourceRecordId: stringOrUndefined(input.referencePrice.sourceRecordId) });
  if (Array.isArray(input.quotes)) for (const quote of input.quotes) if (isRecord(quote) && typeof quote.evidenceId === "string") expected.push({ evidenceId: quote.evidenceId, kind: EventContractEvidenceKind.Quote, capturedAt: stringOrUndefined(quote.observedAt), sourceId: stringOrUndefined(quote.sourceId), sourceRecordId: stringOrUndefined(quote.sourceRecordId) });
  if (Array.isArray(input.feePreviews)) for (const preview of input.feePreviews) if (isRecord(preview) && typeof preview.evidenceId === "string") expected.push({ evidenceId: preview.evidenceId, kind: EventContractEvidenceKind.FeePreview, capturedAt: stringOrUndefined(preview.capturedAt), sourceId: stringOrUndefined(preview.feeSourceId), sourceRecordId: stringOrUndefined(preview.feeSourceRecordId) });
  return expected;
}

function validatePreviewArithmetic(issues: EventContractObservationIssue[], preview: Record<string, unknown>, field: string): void {
  const decimals = ["contractSubtotal", "robinhoodCommission", "exchangeFee", "otherFees", "totalCost", "maximumPayout"] as const;
  if (!Number.isSafeInteger(preview.quantity) || (preview.quantity as number) <= 0 || !Number.isSafeInteger(preview.contractPriceBasisPoints) || decimals.some((key) => !isNonNegativeDecimal(preview[key]))) return;
  try {
    const quantity = BigInt(preview.quantity as number);
    const expectedSubtotal = quantity * BigInt(preview.contractPriceBasisPoints as number) * (MONEY_FACTOR / CONTRACT_PRICE_FACTOR);
    const subtotal = toMoneyAtomic(preview.contractSubtotal as EventContractFixedDecimal);
    const commission = toMoneyAtomic(preview.robinhoodCommission as EventContractFixedDecimal);
    const exchange = toMoneyAtomic(preview.exchangeFee as EventContractFixedDecimal);
    const other = toMoneyAtomic(preview.otherFees as EventContractFixedDecimal);
    const total = toMoneyAtomic(preview.totalCost as EventContractFixedDecimal);
    const payout = toMoneyAtomic(preview.maximumPayout as EventContractFixedDecimal);
    if (subtotal !== expectedSubtotal) add(issues, EventContractObservationIssueCode.ArithmeticMismatch, `${field}.contractSubtotal`, "Contract subtotal must equal quantity multiplied by contract price.");
    if (total !== subtotal + commission + exchange + other) add(issues, EventContractObservationIssueCode.ArithmeticMismatch, `${field}.totalCost`, "Total cost must equal subtotal plus all fees.");
    if (payout !== quantity * MONEY_FACTOR) add(issues, EventContractObservationIssueCode.ArithmeticMismatch, `${field}.maximumPayout`, "Maximum payout must equal one dollar per contract.");
    if (total >= payout) add(issues, EventContractObservationIssueCode.NoPossibleProfit, `${field}.totalCost`, "All-in cost must remain below maximum payout.");
  } catch {
    add(issues, EventContractObservationIssueCode.UnsafeNumericValue, field, "Fee-preview arithmetic exceeds the bounded deterministic domain.");
  }
}

function deriveEconomics(preview: EventContractFeePreview, quotes: readonly EventContractSideQuote[]): EventContractSideEconomics {
  const quote = quotes.find((candidate) => candidate.side === preview.side);
  if (quote === undefined) throw new Error("Validated quote is missing.");
  const commission = toMoneyAtomic(preview.robinhoodCommission);
  const exchange = toMoneyAtomic(preview.exchangeFee);
  const other = toMoneyAtomic(preview.otherFees);
  const total = toMoneyAtomic(preview.totalCost);
  const payout = toMoneyAtomic(preview.maximumPayout);
  const breakEven = safeBigIntToNumber(ceilDivide(total * CONTRACT_PRICE_FACTOR, payout), "break-even probability");
  return {
    side: preview.side,
    quoteSourceRecordId: preview.quoteSourceRecordId,
    quantity: preview.quantity,
    contractPriceBasisPoints: preview.contractPriceBasisPoints,
    contractSubtotal: canonicalDecimal(preview.contractSubtotal),
    totalFees: fromMoneyAtomic(commission + exchange + other),
    allInCost: canonicalDecimal(preview.totalCost),
    maximumPayout: canonicalDecimal(preview.maximumPayout),
    maximumProfit: fromMoneyAtomic(payout - total),
    breakEvenProbabilityBasisPoints: breakEven,
    quoteEvidenceId: quote.evidenceId,
    feeEvidenceId: preview.evidenceId,
  };
}

function validateSideCardinality(issues: EventContractObservationIssue[], values: readonly unknown[], field: string): void {
  const sides = values.filter(isRecord).map((entry) => entry.side);
  for (const side of [EventContractObservationSide.Up, EventContractObservationSide.Down]) {
    const count = sides.filter((value) => value === side).length;
    if (count === 0) add(issues, EventContractObservationIssueCode.MissingSide, field, `${side} is required.`);
    if (count > 1) add(issues, EventContractObservationIssueCode.DuplicateSide, field, `${side} may appear only once.`);
  }
  if (values.length !== 2) add(issues, EventContractObservationIssueCode.InvalidRecord, field, "Exactly one UP and one DOWN record are required.");
}

function validateFreshness(issues: EventContractObservationIssue[], observedAt: unknown, capturedAt: unknown, maximumAge: number, field: string): void {
  if (!isTimestamp(observedAt) || !isTimestamp(capturedAt)) return;
  const age = Date.parse(capturedAt) - Date.parse(observedAt);
  if (age < 0) add(issues, EventContractObservationIssueCode.FutureObservation, field, "Source observation cannot occur after record capture.");
  else if (age > maximumAge) add(issues, EventContractObservationIssueCode.StaleObservation, field, `Source observation exceeds the ${String(maximumAge)}ms freshness limit.`);
}

function validateNotFuture(issues: EventContractObservationIssue[], observedAt: unknown, capturedAt: unknown, field: string): void {
  if (isTimestamp(observedAt) && isTimestamp(capturedAt) && Date.parse(observedAt) > Date.parse(capturedAt)) add(issues, EventContractObservationIssueCode.FutureObservation, field, "Evidence cannot be captured after the observation record.");
}

function validatePositiveDecimal(issues: EventContractObservationIssue[], value: unknown, field: string): void {
  validateDecimalShape(issues, value, field);
  if (isBoundedDecimal(value) && BigInt(value.atomicValue) <= 0n) add(issues, EventContractObservationIssueCode.InvalidFixedDecimal, field, "Value must be positive.");
}

function validateNonNegativeDecimal(issues: EventContractObservationIssue[], value: unknown, field: string): void {
  validateDecimalShape(issues, value, field);
  if (isBoundedDecimal(value) && BigInt(value.atomicValue) < 0n) add(issues, EventContractObservationIssueCode.InvalidFixedDecimal, field, "Value must be non-negative.");
}

function validateDecimalShape(issues: EventContractObservationIssue[], value: unknown, field: string): void {
  if (!isRecord(value)) { add(issues, EventContractObservationIssueCode.InvalidFixedDecimal, field, "Fixed decimal must be an object."); return; }
  validateExactKeys(issues, value, DECIMAL_KEYS, field, EventContractObservationIssueCode.InvalidFixedDecimal);
  if (!isBoundedDecimal(value)) add(issues, EventContractObservationIssueCode.InvalidFixedDecimal, field, "Fixed decimal atomic value or scale is invalid.");
}

function validateContractPrice(issues: EventContractObservationIssue[], value: unknown, field: string): void {
  if (!Number.isSafeInteger(value) || (value as number) <= 0 || (value as number) >= 10_000) add(issues, EventContractObservationIssueCode.InvalidQuote, field, "Contract price must be an integer strictly inside 0..10000 basis points.");
}

function validateIdentifier(issues: EventContractObservationIssue[], value: unknown, field: string, code = EventContractObservationIssueCode.InvalidIdentifier): void {
  if (typeof value !== "string" || !IDENTIFIER.test(value)) add(issues, code, field, "Identifier is invalid.");
}

function validateVersion(issues: EventContractObservationIssue[], value: unknown, field: string, code = EventContractObservationIssueCode.InvalidIdentifier): void {
  if (typeof value !== "string" || !VERSION.test(value)) add(issues, code, field, "Version is invalid.");
}

function validateText(issues: EventContractObservationIssue[], value: unknown, field: string, maximum: number): void {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > maximum) add(issues, EventContractObservationIssueCode.InvalidContract, field, `Text must contain 1 through ${String(maximum)} characters.`);
}

function validateTimestamp(issues: EventContractObservationIssue[], value: unknown, field: string): void {
  if (!isTimestamp(value)) add(issues, EventContractObservationIssueCode.InvalidTimestamp, field, "Timestamp must be canonical UTC with millisecond precision.");
}

function canonicalContract(value: EventContractSettlementTerms): EventContractSettlementTerms {
  return {
    termsId: value.termsId,
    termsVersion: value.termsVersion,
    platform: value.platform,
    exchangeId: value.exchangeId,
    marketId: value.marketId,
    contractId: value.contractId,
    title: value.title,
    eventType: value.eventType,
    instrumentId: value.instrumentId,
    outcomePair: value.outcomePair,
    windowStartsAt: value.windowStartsAt,
    tradingClosesAt: value.tradingClosesAt,
    evaluatesAt: value.evaluatesAt,
    evaluationMethod: value.evaluationMethod,
    thresholdOperator: value.thresholdOperator,
    targetPrice: canonicalDecimal(value.targetPrice),
    settlementSourceId: value.settlementSourceId,
    settlementSourceName: value.settlementSourceName,
    termsSourceId: value.termsSourceId,
    termsSourceRecordId: value.termsSourceRecordId,
    termsEvidenceId: value.termsEvidenceId,
  };
}

function canonicalReferencePrice(value: EventContractReferencePriceObservation): EventContractReferencePriceObservation {
  return { price: canonicalDecimal(value.price), observedAt: value.observedAt, sourceId: value.sourceId, sourceRecordId: value.sourceRecordId, evidenceId: value.evidenceId };
}

function canonicalQuote(value: EventContractSideQuote): EventContractSideQuote {
  return { side: value.side, bidPriceBasisPoints: value.bidPriceBasisPoints, askPriceBasisPoints: value.askPriceBasisPoints, observedAt: value.observedAt, sourceId: value.sourceId, sourceRecordId: value.sourceRecordId, evidenceId: value.evidenceId };
}

function canonicalPreview(value: EventContractFeePreview): EventContractFeePreview {
  return {
    side: value.side,
    quoteSourceRecordId: value.quoteSourceRecordId,
    quantity: value.quantity,
    contractPriceBasisPoints: value.contractPriceBasisPoints,
    capturedAt: value.capturedAt,
    contractSubtotal: canonicalDecimal(value.contractSubtotal),
    robinhoodCommission: canonicalDecimal(value.robinhoodCommission),
    exchangeFee: canonicalDecimal(value.exchangeFee),
    otherFees: canonicalDecimal(value.otherFees),
    totalCost: canonicalDecimal(value.totalCost),
    maximumPayout: canonicalDecimal(value.maximumPayout),
    feeSourceId: value.feeSourceId,
    feeSourceRecordId: value.feeSourceRecordId,
    evidenceId: value.evidenceId,
  };
}

function canonicalEvidence(value: EventContractObservationEvidence): EventContractObservationEvidence {
  return { evidenceId: value.evidenceId, kind: value.kind, capturedAt: value.capturedAt, sourceId: value.sourceId, sourceRecordId: value.sourceRecordId };
}

function canonicalDecimal(value: EventContractFixedDecimal): EventContractFixedDecimal {
  let atomic = BigInt(value.atomicValue);
  let scale = value.scale;
  while (scale > 0 && atomic % 10n === 0n) { atomic /= 10n; scale -= 1; }
  return { atomicValue: atomic.toString(), scale };
}

function toMoneyAtomic(value: EventContractFixedDecimal): bigint {
  if (value.scale > MONEY_SCALE) throw new Error("Money scale exceeds supported precision.");
  return BigInt(value.atomicValue) * (10n ** BigInt(MONEY_SCALE - value.scale));
}

function fromMoneyAtomic(value: bigint): EventContractFixedDecimal {
  return canonicalDecimal({ atomicValue: value.toString(), scale: MONEY_SCALE });
}

function isBoundedDecimal(value: unknown): value is EventContractFixedDecimal {
  return isRecord(value)
    && typeof value.atomicValue === "string"
    && INTEGER.test(value.atomicValue)
    && value.atomicValue.replace("-", "").length <= EVENT_CONTRACT_OBSERVATION_MAX_ATOMIC_DIGITS
    && Number.isSafeInteger(value.scale)
    && (value.scale as number) >= 0
    && (value.scale as number) <= EVENT_CONTRACT_OBSERVATION_MAX_DECIMAL_SCALE;
}

function isNonNegativeDecimal(value: unknown): value is EventContractFixedDecimal {
  return isBoundedDecimal(value) && BigInt(value.atomicValue) >= 0n;
}

function validateExactKeys(issues: EventContractObservationIssue[], value: Record<string, unknown>, allowed: readonly string[], field: string, code: EventContractObservationIssueCode): void {
  for (const key of Object.keys(value).filter((candidate) => !allowed.includes(candidate)).sort()) add(issues, code, `${field}.${key}`, "Undeclared fields are not permitted.");
}

function validationResult(issues: readonly EventContractObservationIssue[]): EventContractObservationValidationResult {
  const ordered = deepFreeze([...issues].sort(compareIssues));
  return deepFreeze({ valid: ordered.length === 0, issues: ordered });
}

function sideOrder<T extends { readonly side: EventContractObservationSide }>(left: T, right: T): number {
  return left.side === right.side ? 0 : left.side === EventContractObservationSide.Up ? -1 : 1;
}

function ceilDivide(numerator: bigint, denominator: bigint): bigint {
  return (numerator + denominator - 1n) / denominator;
}

function safeBigIntToNumber(value: bigint, label: string): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER)) throw new Error(`Unsafe integer in ${label}.`);
  return Number(value);
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function isEnumValue<T extends Record<string, string>>(enumValue: T, value: unknown): value is T[keyof T] {
  return typeof value === "string" && Object.values(enumValue).includes(value);
}

function issue(code: EventContractObservationIssueCode, field: string, message: string): EventContractObservationIssue {
  return { code, field, message };
}

function add(issues: EventContractObservationIssue[], code: EventContractObservationIssueCode, field: string, message: string): void {
  issues.push(issue(code, field, message));
}

function compareIssues(left: EventContractObservationIssue, right: EventContractObservationIssue): number {
  return left.code.localeCompare(right.code) || left.field.localeCompare(right.field) || left.message.localeCompare(right.message);
}

function canonicalize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (isRecord(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

function fnv1a64(value: string): string {
  let hash = 0xcbf29ce484222325n;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= BigInt(value.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, "0");
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) deepFreeze(nested);
  }
  return value;
}
