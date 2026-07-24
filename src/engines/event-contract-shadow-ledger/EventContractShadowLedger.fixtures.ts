import {
  EVENT_CONTRACT_OBSERVATION_INSTRUMENT_ID,
  EVENT_CONTRACT_OBSERVATION_OUTCOME_PAIR,
  EVENT_CONTRACT_OBSERVATION_SCHEMA_VERSION,
  EVENT_CONTRACT_SHADOW_LEDGER_SCHEMA_VERSION,
  EventContractEvaluationMethod,
  EventContractEvidenceKind,
  EventContractObservationEventType,
  EventContractObservationSide,
  EventContractPlatform,
  EventContractThresholdOperator,
  type EventContractObservationInput,
  type EventContractSettlementInput,
} from "../../contracts";

const decimal = (atomicValue: string, scale: number) => ({ atomicValue, scale });

export function validShadowObservationInput(): EventContractObservationInput {
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
      { side: EventContractObservationSide.Down, bidPriceBasisPoints: 9650, askPriceBasisPoints: 9660, observedAt: "2026-07-23T20:42:27.000Z", sourceId: "source:robinhood:event-market", sourceRecordId: "source-record:quote:down:20260723-204227", evidenceId: "evidence:quote:down:20260723-204227" },
      { side: EventContractObservationSide.Up, bidPriceBasisPoints: 340, askPriceBasisPoints: 350, observedAt: "2026-07-23T20:42:27.000Z", sourceId: "source:robinhood:event-market", sourceRecordId: "source-record:quote:up:20260723-204227", evidenceId: "evidence:quote:up:20260723-204227" },
    ],
    feePreviews: [
      { side: EventContractObservationSide.Down, quoteSourceRecordId: "source-record:quote:down:20260723-204227", quantity: 100, contractPriceBasisPoints: 9660, capturedAt: "2026-07-23T20:42:27.000Z", contractSubtotal: decimal("9660", 2), robinhoodCommission: decimal("16", 2), exchangeFee: decimal("100", 2), otherFees: decimal("0", 0), totalCost: decimal("9776", 2), maximumPayout: decimal("100", 0), feeSourceId: "source:robinhood:order-preview", feeSourceRecordId: "source-record:fee-preview:down:20260723-204227", evidenceId: "evidence:fee-preview:down:20260723-204227" },
      { side: EventContractObservationSide.Up, quoteSourceRecordId: "source-record:quote:up:20260723-204227", quantity: 100, contractPriceBasisPoints: 350, capturedAt: "2026-07-23T20:42:27.000Z", contractSubtotal: decimal("350", 2), robinhoodCommission: decimal("17", 2), exchangeFee: decimal("100", 2), otherFees: decimal("0", 0), totalCost: decimal("467", 2), maximumPayout: decimal("100", 0), feeSourceId: "source:robinhood:order-preview", feeSourceRecordId: "source-record:fee-preview:up:20260723-204227", evidenceId: "evidence:fee-preview:up:20260723-204227" },
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

export function validShadowSettlementInput(): EventContractSettlementInput {
  return {
    schemaVersion: EVENT_CONTRACT_SHADOW_LEDGER_SCHEMA_VERSION,
    settlementId: "settlement:btc:20260723-2045",
    observationId: "event-contract-observation:btc:20260723-204227",
    termsId: "terms:robinhood:btc-15m:20260723-2045",
    contractId: "contract:btc-15m:6483926",
    settledAt: "2026-07-23T20:45:01.000Z",
    winningSide: EventContractObservationSide.Down,
    settlementSourceId: "source:cme-cf-brti",
    settlementSourceRecordId: "source-record:brti:settlement:20260723-2045",
    evidenceId: "evidence:settlement:btc:20260723-2045",
  };
}
