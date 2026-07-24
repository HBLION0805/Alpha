import type {
  EventContractObservationRecord,
  EventContractSettlementRecord,
} from "../contracts";

export type EventContractShadowRepositoryEvent =
  | {
      readonly schemaVersion: "1.0";
      readonly sequence: number;
      readonly fingerprint: string;
      readonly eventType: "OBSERVATION_APPENDED";
      readonly acceptedAt: string;
      readonly observation: EventContractObservationRecord;
    }
  | {
      readonly schemaVersion: "1.0";
      readonly sequence: number;
      readonly fingerprint: string;
      readonly eventType: "SETTLEMENT_APPENDED";
      readonly acceptedAt: string;
      readonly settlement: EventContractSettlementRecord;
    };
