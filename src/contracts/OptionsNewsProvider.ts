import type { NewsEvidenceRecord } from "./OptionsNewsDomain";
import type { NewsSourceRegistration } from "./OptionsNewsSourceRegistry";

export enum NewsTransportMode { Fixture = "FIXTURE", DryRun = "DRY_RUN", LiveDisabled = "LIVE_DISABLED" }
export enum NewsProviderErrorCode { InvalidRequest = "INVALID_REQUEST", InvalidRawResponse = "INVALID_RAW_RESPONSE", CredentialsForbidden = "CREDENTIALS_FORBIDDEN", NetworkBlocked = "NETWORK_BLOCKED", RegistryMismatch = "REGISTRY_MISMATCH", CostUnknown = "COST_UNKNOWN" }

export interface NewsProviderRequest {
  readonly requestId: string;
  readonly sourceId: string;
  readonly requestedAtUtc: string;
  readonly symbols: readonly string[];
  readonly topics: readonly string[];
}

export interface NewsTransportRequest {
  readonly mode: NewsTransportMode;
  readonly providerId: string;
  readonly endpointTemplate: string;
  readonly query: Readonly<Record<string, string>>;
  readonly headers: Readonly<Record<string, string>>;
  readonly credentialsRequired: boolean;
  readonly networkEnabled: false;
}

export interface NewsFixtureTransport {
  execute(request: NewsTransportRequest): unknown;
}

export interface NewsProviderAdapter {
  readonly adapterName: string;
  readonly adapterVersion: string;
  readonly source: NewsSourceRegistration;
  buildRequest(request: NewsProviderRequest, mode?: NewsTransportMode): NewsTransportRequest;
  normalize(raw: unknown, request: NewsProviderRequest): readonly NewsEvidenceRecord[];
}

export interface SummaryProvider {
  summarize(input: { readonly evidence: readonly NewsEvidenceRecord[]; readonly generatedAtUtc: string }): import("./OptionsNewsDomain").SummaryEnvelope;
}
