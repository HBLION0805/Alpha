import {
  EVENT_CONTRACT_OBSERVATION_INSTRUMENT_ID,
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
  type EventContractObservationInput,
} from "../../contracts/EventContractObservation";
import {
  DEFAULT_EVENT_CONTRACT_OBSERVATION_POLICY,
  EventContractObservationEngine,
  EventContractObservationValidationError,
  validateEventContractObservationInput,
  validateEventContractObservationPolicy,
} from "./EventContractObservationEngine";

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) throw new Error(`${label}: expected ${String(expected)}, received ${String(actual)}.`);
}

function assertTrue(value: boolean, label: string): void {
  if (!value) throw new Error(`${label}: expected true.`);
}

function assertDeepEqual(actual: unknown, expected: unknown, label: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${label}: values differ.`);
}

function decimal(value: string, scale: number) {
  return { atomicValue: value, scale };
}

function validInput(): EventContractObservationInput {
  return {
    schemaVersion: EVENT_CONTRACT_OBSERVATION_SCHEMA_VERSION,
    observationId: "event-contract-observation:btc:20260723-204227",
    capturedAt: "2026-07-23T20:42:27.000Z",
    contract: {
      termsId: "terms:robinhood:btc-15m:20260723-2045",
      termsVersion: "2026-07-23",
      platform: EventContractPlatform.Robinhood,
      exchangeId: "exchange:forecast",
      marketId: "market:btc-15m:20260723-2045",
      contractId: "contract:btc-15m:6483926",
      title: "BTC 15 min",
      eventType: EventContractObservationEventType.BtcFifteenMinute,
      instrumentId: EVENT_CONTRACT_OBSERVATION_INSTRUMENT_ID,
      outcomePair: EVENT_CONTRACT_OBSERVATION_OUTCOME_PAIR,
      windowStartsAt: "2026-07-23T20:30:00.000Z",
      tradingClosesAt: "2026-07-23T20:45:00.000Z",
      evaluatesAt: "2026-07-23T20:45:00.000Z",
      evaluationMethod: EventContractEvaluationMethod.AtScheduledTime,
      thresholdOperator: EventContractThresholdOperator.AtOrAbove,
      targetPrice: decimal("6483926", 2),
      settlementSourceId: "source:cme-cf-brti",
      settlementSourceName: "CME CF Bitcoin Real Time Index",
      termsSourceId: "source:robinhood:terms",
      termsSourceRecordId: "source-record:terms:btc-15m:20260723-2045",
      termsEvidenceId: "evidence:terms:btc-15m:20260723-2045",
    },
    referencePrice: {
      price: decimal("6474487", 2),
      observedAt: "2026-07-23T20:42:27.000Z",
      sourceId: "source:cme-cf-brti",
      sourceRecordId: "source-record:brti:20260723-204227",
      evidenceId: "evidence:reference-price:20260723-204227",
    },
    quotes: [
      {
        side: EventContractObservationSide.Down,
        bidPriceBasisPoints: 9650,
        askPriceBasisPoints: 9660,
        observedAt: "2026-07-23T20:42:27.000Z",
        sourceId: "source:robinhood:event-market",
        sourceRecordId: "source-record:quote:down:20260723-204227",
        evidenceId: "evidence:quote:down:20260723-204227",
      },
      {
        side: EventContractObservationSide.Up,
        bidPriceBasisPoints: 340,
        askPriceBasisPoints: 350,
        observedAt: "2026-07-23T20:42:27.000Z",
        sourceId: "source:robinhood:event-market",
        sourceRecordId: "source-record:quote:up:20260723-204227",
        evidenceId: "evidence:quote:up:20260723-204227",
      },
    ],
    feePreviews: [
      {
        side: EventContractObservationSide.Down,
        quoteSourceRecordId: "source-record:quote:down:20260723-204227",
        quantity: 100,
        contractPriceBasisPoints: 9660,
        capturedAt: "2026-07-23T20:42:27.000Z",
        contractSubtotal: decimal("9660", 2),
        robinhoodCommission: decimal("16", 2),
        exchangeFee: decimal("100", 2),
        otherFees: decimal("0", 0),
        totalCost: decimal("9776", 2),
        maximumPayout: decimal("100", 0),
        feeSourceId: "source:robinhood:order-preview",
        feeSourceRecordId: "source-record:fee-preview:down:20260723-204227",
        evidenceId: "evidence:fee-preview:down:20260723-204227",
      },
      {
        side: EventContractObservationSide.Up,
        quoteSourceRecordId: "source-record:quote:up:20260723-204227",
        quantity: 100,
        contractPriceBasisPoints: 350,
        capturedAt: "2026-07-23T20:42:27.000Z",
        contractSubtotal: decimal("350", 2),
        robinhoodCommission: decimal("17", 2),
        exchangeFee: decimal("100", 2),
        otherFees: decimal("0", 0),
        totalCost: decimal("467", 2),
        maximumPayout: decimal("100", 0),
        feeSourceId: "source:robinhood:order-preview",
        feeSourceRecordId: "source-record:fee-preview:up:20260723-204227",
        evidenceId: "evidence:fee-preview:up:20260723-204227",
      },
    ],
    evidence: [
      { evidenceId: "evidence:fee-preview:up:20260723-204227", kind: EventContractEvidenceKind.FeePreview, capturedAt: "2026-07-23T20:42:27.000Z", sourceId: "source:robinhood:order-preview", sourceRecordId: "source-record:fee-preview:up:20260723-204227" },
      { evidenceId: "evidence:terms:btc-15m:20260723-2045", kind: EventContractEvidenceKind.Terms, capturedAt: "2026-07-23T20:42:26.000Z", sourceId: "source:robinhood:terms", sourceRecordId: "source-record:terms:btc-15m:20260723-2045" },
      { evidenceId: "evidence:quote:down:20260723-204227", kind: EventContractEvidenceKind.Quote, capturedAt: "2026-07-23T20:42:27.000Z", sourceId: "source:robinhood:event-market", sourceRecordId: "source-record:quote:down:20260723-204227" },
      { evidenceId: "evidence:reference-price:20260723-204227", kind: EventContractEvidenceKind.ReferencePrice, capturedAt: "2026-07-23T20:42:27.000Z", sourceId: "source:cme-cf-brti", sourceRecordId: "source-record:brti:20260723-204227" },
      { evidenceId: "evidence:fee-preview:down:20260723-204227", kind: EventContractEvidenceKind.FeePreview, capturedAt: "2026-07-23T20:42:27.000Z", sourceId: "source:robinhood:order-preview", sourceRecordId: "source-record:fee-preview:down:20260723-204227" },
      { evidenceId: "evidence:quote:up:20260723-204227", kind: EventContractEvidenceKind.Quote, capturedAt: "2026-07-23T20:42:27.000Z", sourceId: "source:robinhood:event-market", sourceRecordId: "source-record:quote:up:20260723-204227" },
    ],
  };
}

function changed(update: (draft: Record<string, unknown>) => void): unknown {
  const draft = JSON.parse(JSON.stringify(validInput())) as Record<string, unknown>;
  update(draft);
  return draft;
}

function expectIssue(value: unknown, code: EventContractObservationIssueCode): void {
  const result = validateEventContractObservationInput(value);
  if (!result.issues.some((entry) => entry.code === code)) throw new Error(`Expected ${code}; received ${JSON.stringify(result.issues)}.`);
}

function expectThrow(run: () => unknown): void {
  try { run(); } catch (error: unknown) {
    assertTrue(error instanceof EventContractObservationValidationError, "typed validation error");
    return;
  }
  throw new Error("Expected validation error.");
}

const engine = new EventContractObservationEngine();
const tests: ReadonlyArray<readonly [string, () => void]> = [
  ["valid observation constructs", () => {
    const result = validateEventContractObservationInput(validInput());
    assertTrue(result.valid, JSON.stringify(result.issues));
  }],
  ["output is deterministically ordered", () => {
    const result = engine.create(validInput());
    assertEqual(result.quotes[0]?.side, EventContractObservationSide.Up, "UP quote first");
    assertEqual(result.feePreviews[0]?.side, EventContractObservationSide.Up, "UP preview first");
    assertEqual(result.sideEconomics[0]?.side, EventContractObservationSide.Up, "UP economics first");
  }],
  ["remaining time is derived", () => assertEqual(engine.create(validInput()).remainingSeconds, 153, "remaining seconds")],
  ["UP break-even includes all fees", () => assertEqual(engine.create(validInput()).sideEconomics[0]?.breakEvenProbabilityBasisPoints, 467, "UP break-even")],
  ["DOWN break-even includes all fees", () => assertEqual(engine.create(validInput()).sideEconomics[1]?.breakEvenProbabilityBasisPoints, 9776, "DOWN break-even")],
  ["UP maximum profit is exact", () => assertDeepEqual(engine.create(validInput()).sideEconomics[0]?.maximumProfit, decimal("9533", 2), "UP maximum profit")],
  ["DOWN maximum profit is exact", () => assertDeepEqual(engine.create(validInput()).sideEconomics[1]?.maximumProfit, decimal("224", 2), "DOWN maximum profit")],
  ["fee total is exact", () => assertDeepEqual(engine.create(validInput()).sideEconomics[0]?.totalFees, decimal("117", 2), "fees")],
  ["semantically equal decimal scales normalize", () => {
    const first = engine.create(validInput());
    const secondInput = changed((draft) => {
      const contract = draft["contract"] as Record<string, unknown>;
      contract["targetPrice"] = decimal("648392600", 4);
    });
    const second = engine.create(secondInput);
    assertEqual(first.fingerprint, second.fingerprint, "normalized fingerprint");
  }],
  ["output is deeply immutable", () => {
    const result = engine.create(validInput());
    assertTrue(Object.isFrozen(result), "record frozen");
    assertTrue(Object.isFrozen(result.contract), "contract frozen");
    assertTrue(Object.isFrozen(result.sideEconomics), "economics frozen");
  }],
  ["source input is unchanged", () => {
    const input = validInput();
    const before = JSON.stringify(input);
    engine.create(input);
    assertEqual(JSON.stringify(input), before, "source input");
  }],
  ["output has observation-only authority", () => assertEqual(engine.create(validInput()).authorizationStatus, EventContractObservationAuthorizationStatus.ObservationOnly, "authority")],
  ["unknown root field fails closed", () => expectIssue(changed((draft) => { draft["positionSize"] = 1000; }), EventContractObservationIssueCode.InvalidRecord)],
  ["unknown contract field fails closed", () => expectIssue(changed((draft) => { (draft["contract"] as Record<string, unknown>)["brokerOrder"] = "BUY"; }), EventContractObservationIssueCode.InvalidContract)],
  ["unknown quote field fails closed", () => expectIssue(changed((draft) => { ((draft["quotes"] as Array<Record<string, unknown>>)[0] as Record<string, unknown>)["rank"] = 1; }), EventContractObservationIssueCode.InvalidQuote)],
  ["unknown preview field fails closed", () => expectIssue(changed((draft) => { ((draft["feePreviews"] as Array<Record<string, unknown>>)[0] as Record<string, unknown>)["leverage"] = 3; }), EventContractObservationIssueCode.InvalidFeePreview)],
  ["missing UP quote fails closed", () => expectIssue(changed((draft) => { draft["quotes"] = (draft["quotes"] as Array<Record<string, unknown>>).filter((entry) => entry["side"] !== EventContractObservationSide.Up); }), EventContractObservationIssueCode.MissingSide)],
  ["duplicate DOWN preview fails closed", () => expectIssue(changed((draft) => { const values = draft["feePreviews"] as Array<Record<string, unknown>>; values[1] = JSON.parse(JSON.stringify(values[0])) as Record<string, unknown>; }), EventContractObservationIssueCode.DuplicateSide)],
  ["bid above ask fails closed", () => expectIssue(changed((draft) => { ((draft["quotes"] as Array<Record<string, unknown>>)[0] as Record<string, unknown>)["bidPriceBasisPoints"] = 9700; }), EventContractObservationIssueCode.InvalidQuote)],
  ["zero ask fails closed", () => expectIssue(changed((draft) => { ((draft["quotes"] as Array<Record<string, unknown>>)[0] as Record<string, unknown>)["askPriceBasisPoints"] = 0; }), EventContractObservationIssueCode.InvalidQuote)],
  ["capture before window fails closed", () => expectIssue(changed((draft) => { draft["capturedAt"] = "2026-07-23T20:29:59.000Z"; }), EventContractObservationIssueCode.InvalidSettlementTerms)],
  ["non-15-minute window fails closed", () => expectIssue(changed((draft) => { (draft["contract"] as Record<string, unknown>)["evaluatesAt"] = "2026-07-23T20:46:00.000Z"; }), EventContractObservationIssueCode.InvalidSettlementTerms)],
  ["trading close after evaluation fails closed", () => expectIssue(changed((draft) => { (draft["contract"] as Record<string, unknown>)["tradingClosesAt"] = "2026-07-23T20:45:01.000Z"; }), EventContractObservationIssueCode.InvalidSettlementTerms)],
  ["stale reference price fails closed", () => expectIssue(changed((draft) => { (draft["referencePrice"] as Record<string, unknown>)["observedAt"] = "2026-07-23T20:42:24.000Z"; }), EventContractObservationIssueCode.StaleObservation)],
  ["future quote fails closed", () => expectIssue(changed((draft) => { ((draft["quotes"] as Array<Record<string, unknown>>)[0] as Record<string, unknown>)["observedAt"] = "2026-07-23T20:42:28.000Z"; }), EventContractObservationIssueCode.FutureObservation)],
  ["stale preview fails closed", () => expectIssue(changed((draft) => { ((draft["feePreviews"] as Array<Record<string, unknown>>)[0] as Record<string, unknown>)["capturedAt"] = "2026-07-23T20:42:21.000Z"; }), EventContractObservationIssueCode.StaleObservation)],
  ["preview before its quote fails closed", () => expectIssue(changed((draft) => {
    ((draft["feePreviews"] as Array<Record<string, unknown>>)[0] as Record<string, unknown>)["capturedAt"] = "2026-07-23T20:42:26.000Z";
  }), EventContractObservationIssueCode.InvalidFeePreview)],
  ["preview quote identity mismatch fails closed", () => expectIssue(changed((draft) => { ((draft["feePreviews"] as Array<Record<string, unknown>>)[0] as Record<string, unknown>)["quoteSourceRecordId"] = "source-record:quote:other"; }), EventContractObservationIssueCode.MismatchedReference)],
  ["preview ask price mismatch fails closed", () => expectIssue(changed((draft) => { ((draft["feePreviews"] as Array<Record<string, unknown>>)[0] as Record<string, unknown>)["contractPriceBasisPoints"] = 9650; }), EventContractObservationIssueCode.MismatchedReference)],
  ["subtotal mismatch fails closed", () => expectIssue(changed((draft) => { ((draft["feePreviews"] as Array<Record<string, unknown>>)[1] as Record<string, unknown>)["contractSubtotal"] = decimal("349", 2); }), EventContractObservationIssueCode.ArithmeticMismatch)],
  ["total cost mismatch fails closed", () => expectIssue(changed((draft) => { ((draft["feePreviews"] as Array<Record<string, unknown>>)[1] as Record<string, unknown>)["totalCost"] = decimal("466", 2); }), EventContractObservationIssueCode.ArithmeticMismatch)],
  ["maximum payout mismatch fails closed", () => expectIssue(changed((draft) => { ((draft["feePreviews"] as Array<Record<string, unknown>>)[1] as Record<string, unknown>)["maximumPayout"] = decimal("99", 0); }), EventContractObservationIssueCode.ArithmeticMismatch)],
  ["no possible profit fails closed", () => expectIssue(changed((draft) => {
    const preview = (draft["feePreviews"] as Array<Record<string, unknown>>)[0] as Record<string, unknown>;
    preview["exchangeFee"] = decimal("340", 2);
    preview["totalCost"] = decimal("10016", 2);
  }), EventContractObservationIssueCode.NoPossibleProfit)],
  ["negative fee fails closed", () => expectIssue(changed((draft) => { ((draft["feePreviews"] as Array<Record<string, unknown>>)[1] as Record<string, unknown>)["otherFees"] = decimal("-1", 2); }), EventContractObservationIssueCode.InvalidFixedDecimal)],
  ["oversized decimal fails closed", () => expectIssue(changed((draft) => { (draft["referencePrice"] as Record<string, unknown>)["price"] = decimal("9".repeat(25), 0); }), EventContractObservationIssueCode.InvalidFixedDecimal)],
  ["unsupported instrument fails closed", () => expectIssue(changed((draft) => { (draft["contract"] as Record<string, unknown>)["instrumentId"] = "instrument:crypto:eth-usd"; }), EventContractObservationIssueCode.InvalidContract)],
  ["reference price must use settlement source", () => expectIssue(changed((draft) => { (draft["referencePrice"] as Record<string, unknown>)["sourceId"] = "source:unrelated"; }), EventContractObservationIssueCode.MismatchedReference)],
  ["missing evidence fails closed", () => expectIssue(changed((draft) => { (draft["evidence"] as Array<Record<string, unknown>>).pop(); }), EventContractObservationIssueCode.InvalidEvidence)],
  ["extra evidence fails closed", () => expectIssue(changed((draft) => { (draft["evidence"] as Array<Record<string, unknown>>).push({ evidenceId: "evidence:extra", kind: EventContractEvidenceKind.Quote, capturedAt: draft["capturedAt"], sourceId: "source:extra", sourceRecordId: "source-record:extra" }); }), EventContractObservationIssueCode.InvalidEvidence)],
  ["wrong evidence kind fails closed", () => expectIssue(changed((draft) => { ((draft["evidence"] as Array<Record<string, unknown>>)[0] as Record<string, unknown>)["kind"] = EventContractEvidenceKind.Quote; }), EventContractObservationIssueCode.MismatchedReference)],
  ["wrong quote evidence source fails closed", () => expectIssue(changed((draft) => { ((draft["evidence"] as Array<Record<string, unknown>>)[2] as Record<string, unknown>)["sourceRecordId"] = "source-record:quote:wrong"; }), EventContractObservationIssueCode.MismatchedReference)],
  ["wrong fee evidence source fails closed", () => expectIssue(changed((draft) => { ((draft["evidence"] as Array<Record<string, unknown>>)[0] as Record<string, unknown>)["sourceRecordId"] = "source-record:fee-preview:wrong"; }), EventContractObservationIssueCode.MismatchedReference)],
  ["future evidence fails closed", () => expectIssue(changed((draft) => { ((draft["evidence"] as Array<Record<string, unknown>>)[1] as Record<string, unknown>)["capturedAt"] = "2026-07-23T20:42:28.000Z"; }), EventContractObservationIssueCode.FutureObservation)],
  ["invalid policy fails at construction", () => {
    const policy = { ...DEFAULT_EVENT_CONTRACT_OBSERVATION_POLICY, maximumQuoteAgeMilliseconds: 0 };
    assertTrue(validateEventContractObservationPolicy(policy).length > 0, "policy issue");
    expectThrow(() => new EventContractObservationEngine(policy));
  }],
  ["quantity above policy fails closed", () => expectIssue(changed((draft) => { ((draft["feePreviews"] as Array<Record<string, unknown>>)[0] as Record<string, unknown>)["quantity"] = 50_001; }), EventContractObservationIssueCode.InvalidFeePreview)],
  ["invalid record throws typed error", () => expectThrow(() => engine.create({}))],
  ["identical input produces identical fingerprint", () => assertEqual(engine.create(validInput()).fingerprint, engine.create(validInput()).fingerprint, "fingerprint")],
  ["quote order does not change fingerprint", () => {
    const first = engine.create(validInput());
    const secondInput = validInput();
    const second = engine.create({ ...secondInput, quotes: [...secondInput.quotes].reverse(), feePreviews: [...secondInput.feePreviews].reverse(), evidence: [...secondInput.evidence].reverse() });
    assertEqual(first.fingerprint, second.fingerprint, "order-independent fingerprint");
  }],
  ["record contains no recommendation or execution field", () => {
    const serialized = JSON.stringify(engine.create(validInput()));
    assertTrue(!serialized.includes("\"recommendation\""), "no recommendation");
    assertTrue(!serialized.includes("\"orderInstruction\""), "no order instruction");
  }],
];

function main(): void {
  let passed = 0;
  for (const [name, run] of tests) {
    try {
      run();
      passed += 1;
      console.log(`PASS ${name}`);
    } catch (error: unknown) {
      console.error(`FAIL ${name}`);
      throw error;
    }
  }
  console.log(`Event Contract Observation tests passed: ${String(passed)}/${String(tests.length)}.`);
}

main();
