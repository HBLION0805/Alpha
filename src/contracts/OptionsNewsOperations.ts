import type { NewsEventStatus, NewsLatencyMeasurement } from "./OptionsNewsDomain";
import type { NewsTransportMode } from "./OptionsNewsProvider";

export enum NewsBudgetState { Normal = "NORMAL", Warning = "WARNING", BlockedBudget = "BLOCKED_BUDGET", BlockedCostUnknown = "BLOCKED_COST_UNKNOWN" }
export enum NewsHealthState { Healthy = "HEALTHY", Degraded = "DEGRADED", BlockedNetwork = "BLOCKED_NETWORK", BlockedCredentials = "BLOCKED_CREDENTIALS", BlockedBudget = "BLOCKED_BUDGET", Unavailable = "UNAVAILABLE" }

export interface NewsBudgetPolicy { readonly policyVersion: string; readonly currency: "USD"; readonly softLimitMinorUnits: 8000; readonly hardLimitMinorUnits: 10000; readonly monthlyBoundary: "UTC"; }
export interface NewsBudgetReservation { readonly reservationId: string; readonly providerId: string; readonly monthUtc: string; readonly estimatedMinorUnits: number; readonly state: "RESERVED" | "RELEASED" | "RECONCILED"; readonly actualMinorUnits: number | null; }
export interface NewsBudgetSnapshot { readonly monthUtc: string; readonly committedMinorUnits: number; readonly reservedMinorUnits: number; readonly state: NewsBudgetState; }

export interface NewsHealthSnapshot {
  readonly providerId: string;
  readonly adapterName: string;
  readonly adapterVersion: string;
  readonly transportMode: NewsTransportMode;
  readonly state: NewsHealthState;
  readonly lastSuccessfulFixtureAtUtc: string | null;
  readonly failureClass: string | null;
  readonly reasonCode: string;
  readonly requestCount: number;
  readonly parseCount: number;
  readonly normalizeCount: number;
  readonly verifyCount: number;
  readonly latency: NewsLatencyMeasurement;
  readonly latencySampleCount: number;
  readonly estimatedMinorUnits: number;
  readonly actualMinorUnits: number;
  readonly reservedMinorUnits: number;
  readonly budgetState: NewsBudgetState;
  readonly networkAuthority: "BLOCKED";
  readonly credentialAuthority: "NOT_READ";
  readonly dataFreshness: "FIXTURE_ONLY" | "UNMEASURED";
}

export interface OptionsNewsPipelineResult { readonly status: NewsEventStatus; readonly eventId: string | null; readonly reasonCode: string; }
