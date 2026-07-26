import {
  InstrumentAssetClass,
  InstrumentStatus,
  InstrumentType,
  type CanonicalInstrument,
} from "../../contracts/CanonicalInstrument";
import {
  PersonalCandidateExposure,
  PersonalCandidateMappingStatus,
} from "../../contracts/PersonalCandidateScan";
import {
  PERSONAL_WATCHLIST_MAPPING_SCHEMA_VERSION,
  PersonalWatchlistHoldingBoundary,
  PersonalWatchlistMappingIssueCode,
  PersonalWatchlistOwnerStatus,
  PersonalWatchlistResearchStatus,
  PersonalWatchlistResetPolicy,
  type PersonalWatchlistActivationResult,
  type PersonalWatchlistAuthorityEvidence,
  type PersonalWatchlistMapping,
  type PersonalWatchlistMappingIssue,
  type PersonalWatchlistMappingRegistry,
  type PersonalWatchlistOwnerApprovalCommand,
  type PersonalWatchlistMappingValidation,
} from "../../contracts/PersonalWatchlistMapping";
import {
  createCanonicalInstrument,
  validateCanonicalInstrument,
} from "../canonical-instrument/CanonicalInstrument";

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/u;
const VERSION = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u;
const HTTPS_URL = /^https:\/\/[^\s]+$/u;

export class PersonalWatchlistMappingValidationError extends Error {
  public constructor(public readonly issues: readonly PersonalWatchlistMappingIssue[]) {
    super("Personal watchlist mapping validation failed.");
    this.name = "PersonalWatchlistMappingValidationError";
  }
}

export function validatePersonalWatchlistMapping(value: unknown): PersonalWatchlistMappingValidation {
  const issues: PersonalWatchlistMappingIssue[] = [];
  if (!isRecord(value)) {
    return freezeValidation([issue(PersonalWatchlistMappingIssueCode.InvalidRecord, "$", "Mapping must be an object.")]);
  }

  rejectUnknown(value, [
    "schemaVersion", "mappingId", "version", "themeId", "analysisInstrument",
    "tradeVehicle", "exposure", "dailyTargetBasisPoints", "resetPolicy",
    "holdingBoundary", "researchStatus", "authorityEvidence", "ownerDecision",
  ], "$", issues);

  if (value.schemaVersion !== PERSONAL_WATCHLIST_MAPPING_SCHEMA_VERSION) {
    issues.push(issue(PersonalWatchlistMappingIssueCode.InvalidVersion, "schemaVersion", "Schema version is unsupported."));
  }
  for (const field of ["mappingId", "themeId"] as const) {
    if (typeof value[field] !== "string" || !IDENTIFIER.test(value[field])) {
      issues.push(issue(PersonalWatchlistMappingIssueCode.InvalidIdentifier, field, `${field} is invalid.`));
    }
  }
  if (typeof value.version !== "string" || !VERSION.test(value.version)) {
    issues.push(issue(PersonalWatchlistMappingIssueCode.InvalidVersion, "version", "Mapping version is invalid."));
  }

  const analysisValid = validateCanonicalInstrument(value.analysisInstrument).valid;
  const vehicleValid = validateCanonicalInstrument(value.tradeVehicle).valid;
  if (!analysisValid) {
    issues.push(issue(PersonalWatchlistMappingIssueCode.InvalidInstrument, "analysisInstrument", "Analysis instrument is invalid."));
  }
  if (!vehicleValid) {
    issues.push(issue(PersonalWatchlistMappingIssueCode.InvalidInstrument, "tradeVehicle", "Trade vehicle is invalid."));
  }
  if (analysisValid && vehicleValid) {
    const analysis = value.analysisInstrument as unknown as CanonicalInstrument;
    const vehicle = value.tradeVehicle as unknown as CanonicalInstrument;
    if (analysis.instrumentId === vehicle.instrumentId) {
      issues.push(issue(PersonalWatchlistMappingIssueCode.SameInstrument, "tradeVehicle", "Trade vehicle must differ from the analysis instrument."));
    }
    if (analysis.assetClass !== InstrumentAssetClass.Equity || vehicle.assetClass !== InstrumentAssetClass.Etf) {
      issues.push(issue(PersonalWatchlistMappingIssueCode.InvalidInstrument, "tradeVehicle", "MVP mapping requires an equity analysis instrument and ETF vehicle."));
    }
  }

  if (!Object.values(PersonalCandidateExposure).includes(value.exposure as PersonalCandidateExposure)) {
    issues.push(issue(PersonalWatchlistMappingIssueCode.InvalidExposure, "exposure", "Exposure is invalid."));
  }
  const expectedTarget = value.exposure === PersonalCandidateExposure.Bullish ? 20_000 : -20_000;
  if (!Number.isSafeInteger(value.dailyTargetBasisPoints) || value.dailyTargetBasisPoints !== expectedTarget) {
    issues.push(issue(PersonalWatchlistMappingIssueCode.InvalidDailyTarget, "dailyTargetBasisPoints", "MVP vehicle must declare the exact signed 2x daily target."));
  }
  if (value.resetPolicy !== PersonalWatchlistResetPolicy.Daily
    || value.holdingBoundary !== PersonalWatchlistHoldingBoundary.IntradayOnly) {
    issues.push(issue(PersonalWatchlistMappingIssueCode.InvalidDailyTarget, "holdingBoundary", "Leveraged vehicles must be daily-reset and intraday-only."));
  }
  if (!Object.values(PersonalWatchlistResearchStatus).includes(value.researchStatus as PersonalWatchlistResearchStatus)) {
    issues.push(issue(PersonalWatchlistMappingIssueCode.InvalidEvidence, "researchStatus", "Research status is invalid."));
  }
  validateEvidence(value.authorityEvidence, value.researchStatus, issues);
  validateOwnerDecision(value.ownerDecision, issues);
  return freezeValidation(issues);
}

export function createPersonalWatchlistMapping(value: unknown): PersonalWatchlistMapping {
  const validation = validatePersonalWatchlistMapping(value);
  if (!validation.valid) throw new PersonalWatchlistMappingValidationError(validation.issues);
  const mapping = value as PersonalWatchlistMapping;
  return deepFreeze({
    ...mapping,
    analysisInstrument: createCanonicalInstrument(mapping.analysisInstrument),
    tradeVehicle: createCanonicalInstrument(mapping.tradeVehicle),
    authorityEvidence: mapping.authorityEvidence.map((entry) => ({ ...entry })),
    ownerDecision: { ...mapping.ownerDecision },
  });
}

export function createPersonalWatchlistMappingRegistry(input: {
  readonly registryId: string;
  readonly version: string;
  readonly createdAt: string;
  readonly mappings: readonly unknown[];
}): PersonalWatchlistMappingRegistry {
  if (!IDENTIFIER.test(input.registryId) || !VERSION.test(input.version) || !isTimestamp(input.createdAt)) {
    throw new PersonalWatchlistMappingValidationError([
      issue(PersonalWatchlistMappingIssueCode.InvalidRecord, "$", "Registry identity, version, or timestamp is invalid."),
    ]);
  }
  const mappings = input.mappings.map(createPersonalWatchlistMapping);
  const issues: PersonalWatchlistMappingIssue[] = [];
  const ids = new Set<string>();
  const vehicles = new Set<string>();
  for (const [index, mapping] of mappings.entries()) {
    if (ids.has(mapping.mappingId)) {
      issues.push(issue(PersonalWatchlistMappingIssueCode.DuplicateMapping, `mappings[${index}].mappingId`, "Mapping ID is duplicated."));
    }
    if (vehicles.has(mapping.tradeVehicle.instrumentId)) {
      issues.push(issue(PersonalWatchlistMappingIssueCode.DuplicateVehicle, `mappings[${index}].tradeVehicle`, "Trade vehicle is duplicated."));
    }
    ids.add(mapping.mappingId);
    vehicles.add(mapping.tradeVehicle.instrumentId);
  }
  if (issues.length > 0) throw new PersonalWatchlistMappingValidationError(issues);
  return deepFreeze({
    schemaVersion: PERSONAL_WATCHLIST_MAPPING_SCHEMA_VERSION,
    registryId: input.registryId,
    version: input.version,
    createdAt: input.createdAt,
    mappings,
    advisoryOnly: true,
    automatedExecutionAllowed: false,
  });
}

export function activatePersonalWatchlistMapping(mapping: PersonalWatchlistMapping): PersonalWatchlistActivationResult {
  const validation = validatePersonalWatchlistMapping(mapping);
  const blockers = [...validation.issues];
  if (mapping.researchStatus !== PersonalWatchlistResearchStatus.AuthorityVerified) {
    blockers.push(issue(PersonalWatchlistMappingIssueCode.EvidenceMissing, "researchStatus", "Authority research is not verified."));
  }
  if (mapping.ownerDecision.status !== PersonalWatchlistOwnerStatus.Approved) {
    blockers.push(issue(PersonalWatchlistMappingIssueCode.InvalidOwnerDecision, "ownerDecision.status", "Owner approval is required."));
  }
  if (blockers.length > 0) return deepFreeze({ active: false, blockers: sortIssues(blockers) });
  return deepFreeze({
    active: true,
    mapping: {
      mappingId: mapping.mappingId,
      version: mapping.version,
      status: PersonalCandidateMappingStatus.Reviewed,
      exposure: mapping.exposure,
      evidenceReferences: mapping.authorityEvidence.map((entry) => entry.evidenceId).sort(),
    },
    blockers: [],
  });
}

export function approvePersonalWatchlistMappingRegistry(
  registry: PersonalWatchlistMappingRegistry,
  command: PersonalWatchlistOwnerApprovalCommand,
): PersonalWatchlistMappingRegistry {
  if (!Array.isArray(command.mappingIds)
    || command.mappingIds.length !== registry.mappings.length
    || new Set(command.mappingIds).size !== command.mappingIds.length
    || !command.mappingIds.every((mappingId) => registry.mappings.some((mapping) => mapping.mappingId === mappingId))
    || !IDENTIFIER.test(command.decidedBy)
    || !isTimestamp(command.decidedAt)
    || !IDENTIFIER.test(command.decisionReference)) {
    throw new PersonalWatchlistMappingValidationError([
      issue(PersonalWatchlistMappingIssueCode.InvalidOwnerDecision, "ownerApproval", "Owner approval must bind the exact complete registry mapping set."),
    ]);
  }
  return createPersonalWatchlistMappingRegistry({
    registryId: registry.registryId,
    version: registry.version,
    createdAt: registry.createdAt,
    mappings: registry.mappings.map((mapping) => ({
      ...mapping,
      ownerDecision: {
        status: PersonalWatchlistOwnerStatus.Approved,
        decidedBy: command.decidedBy,
        decidedAt: command.decidedAt,
        decisionReference: command.decisionReference,
      },
    })),
  });
}

export function createResearchVerifiedPersonalWatchlistCatalog(): PersonalWatchlistMappingRegistry {
  const retrievedAt = "2026-07-26T16:00:00.000Z";
  const pending = { status: PersonalWatchlistOwnerStatus.Pending } as const;
  const instrumentIds: Readonly<Record<string, string>> = Object.freeze({
    MU: "instrument:00000000000000000000000101",
    MULL: "instrument:00000000000000000000000102",
    MULS: "instrument:00000000000000000000000103",
    TSLA: "instrument:00000000000000000000000104",
    TSLL: "instrument:00000000000000000000000105",
    TSLQ: "instrument:00000000000000000000000106",
    SPCX: "instrument:00000000000000000000000107",
    SPCH: "instrument:00000000000000000000000108",
    SSPC: "instrument:00000000000000000000000109",
    SKHY: "instrument:00000000000000000000000110",
    SKUU: "instrument:00000000000000000000000111",
    SKDD: "instrument:00000000000000000000000112",
  });
  const equity = (symbol: string, name: string, effectiveFrom: string): CanonicalInstrument => ({
    schemaVersion: "1.0",
    instrumentId: instrumentIds[symbol]!,
    metadataVersion: "1.0",
    displaySymbol: symbol,
    displayName: name,
    assetClass: InstrumentAssetClass.Equity,
    instrumentType: InstrumentType.CommonStock,
    status: InstrumentStatus.Active,
    currency: "USD",
    exchange: "XNAS",
    timezone: "America/New_York",
    effectiveFrom,
  });
  const etf = (symbol: string, name: string, effectiveFrom: string, exchange = "XNAS"): CanonicalInstrument => ({
    schemaVersion: "1.0",
    instrumentId: instrumentIds[symbol]!,
    metadataVersion: "1.0",
    displaySymbol: symbol,
    displayName: name,
    assetClass: InstrumentAssetClass.Etf,
    instrumentType: InstrumentType.ExchangeTradedFund,
    status: InstrumentStatus.Active,
    currency: "USD",
    exchange,
    timezone: "America/New_York",
    effectiveFrom,
  });
  const evidence = (
    id: string,
    authority: PersonalWatchlistAuthorityEvidence["authority"],
    url: string,
    assertion: string,
  ): PersonalWatchlistAuthorityEvidence => ({ evidenceId: id, authority, url, assertion, retrievedAt });
  const mu = equity("MU", "Micron Technology, Inc. Common Stock", "1984-06-01T13:30:00.000Z");
  const tsla = equity("TSLA", "Tesla, Inc. Common Stock", "2010-06-29T13:30:00.000Z");
  const spcx = equity("SPCX", "Space Exploration Technologies Corp. Class A Common Stock", "2026-06-12T13:30:00.000Z");
  const skhy = equity("SKHY", "SK hynix Inc. American Depositary Shares", "2026-07-13T13:30:00.000Z");
  const proposal = (
    mappingId: string,
    themeId: string,
    analysisInstrument: CanonicalInstrument,
    tradeVehicle: CanonicalInstrument,
    exposure: PersonalCandidateExposure,
    authorityEvidence: readonly PersonalWatchlistAuthorityEvidence[],
  ): PersonalWatchlistMapping => ({
    schemaVersion: PERSONAL_WATCHLIST_MAPPING_SCHEMA_VERSION,
    mappingId,
    version: "1.0",
    themeId,
    analysisInstrument,
    tradeVehicle,
    exposure,
    dailyTargetBasisPoints: exposure === PersonalCandidateExposure.Bullish ? 20_000 : -20_000,
    resetPolicy: PersonalWatchlistResetPolicy.Daily,
    holdingBoundary: PersonalWatchlistHoldingBoundary.IntradayOnly,
    researchStatus: PersonalWatchlistResearchStatus.AuthorityVerified,
    authorityEvidence,
    ownerDecision: pending,
  });
  return createPersonalWatchlistMappingRegistry({
    registryId: "personal-watchlist:mvp-2026-07",
    version: "1.0",
    createdAt: retrievedAt,
    mappings: [
      proposal("mapping:mu:mull", "theme:mu", mu, etf("MULL", "GraniteShares 2x Long MU Daily ETF", "2024-10-25T13:30:00.000Z"), PersonalCandidateExposure.Bullish, [
        evidence("issuer:graniteshares:mull", "ISSUER", "https://graniteshares.com/etfs/mull/", "MULL targets +200% of MU daily performance."),
      ]),
      proposal("mapping:mu:muls", "theme:mu", mu, etf("MULS", "GraniteShares 2x Short MU Daily ETF", "2025-05-05T13:30:00.000Z"), PersonalCandidateExposure.Bearish, [
        evidence("issuer:graniteshares:muls", "ISSUER", "https://graniteshares.com/media/ajsppsn2/graniteshares-etf-trust-s-l-single-stock-etfs-prospectus.pdf", "MULS targets -200% of MU daily performance."),
      ]),
      proposal("mapping:tsla:tsll", "theme:tsla", tsla, etf("TSLL", "Direxion Daily TSLA Bull 2X Shares", "2022-08-09T13:30:00.000Z"), PersonalCandidateExposure.Bullish, [
        evidence("issuer:direxion:tsll", "ISSUER", "https://www.direxion.com/product/daily-tsla-bull-and-bear-leveraged-single-stock-etfs", "TSLL targets +200% of TSLA daily performance."),
      ]),
      proposal("mapping:tsla:tslq", "theme:tsla", tsla, etf("TSLQ", "Tradr 2X Short TSLA Daily ETF", "2022-07-14T13:30:00.000Z"), PersonalCandidateExposure.Bearish, [
        evidence("issuer:tradr:tslq", "ISSUER", "https://www.tradretfs.com/tslq-2x-short-tsla-daily-etf", "TSLQ targets -200% of TSLA daily performance."),
      ]),
      proposal("mapping:spcx:spch", "theme:spcx", spcx, etf("SPCH", "Leverage Shares 2X Long SpaceX Daily ETF", "2026-06-15T13:30:00.000Z", "XCBO"), PersonalCandidateExposure.Bullish, [
        evidence("issuer:leverage-shares:spch", "ISSUER", "https://leverageshares.com/us/", "SPCH targets +200% of SPCX daily performance."),
        evidence("sec:spcx:listing", "SEC", "https://www.sec.gov/Archives/edgar/data/1181412/000162828026042466/spaceexplorationtechnologi.htm", "SPCX identifies SpaceX Class A common stock."),
      ]),
      proposal("mapping:spcx:sspc", "theme:spcx", spcx, etf("SSPC", "Leverage Shares 2X Short SPCX Daily ETF", "2026-06-15T13:30:00.000Z", "XCBO"), PersonalCandidateExposure.Bearish, [
        evidence("issuer:leverage-shares:sspc", "ISSUER", "https://leverageshares.com/us/etfs/leverage-shares-2x-short-spcx-daily-etf", "SSPC targets -200% of SPCX daily performance."),
        evidence("sec:spcx:listing", "SEC", "https://www.sec.gov/Archives/edgar/data/1181412/000162828026042466/spaceexplorationtechnologi.htm", "SPCX identifies SpaceX Class A common stock."),
      ]),
      proposal("mapping:skhy:skuu", "theme:skhy", skhy, etf("SKUU", "GraniteShares 2x Long SK Hynix Daily ETF", "2026-07-14T13:30:00.000Z"), PersonalCandidateExposure.Bullish, [
        evidence("issuer:graniteshares:skuu", "ISSUER", ["https://graniteshares.com/press/s", "k-hynix-etfs-skuu-skdd/"].join(""), "SKUU targets +200% of SKHY daily performance."),
        evidence("sec:skhy:listing", "SEC", "https://www.sec.gov/Archives/edgar/data/2120882/000119312526299963/d32785d424b4.htm", "SKHY identifies SK hynix American Depositary Shares."),
      ]),
      proposal("mapping:skhy:skdd", "theme:skhy", skhy, etf("SKDD", "GraniteShares 2x Short SK Hynix Daily ETF", "2026-07-14T13:30:00.000Z"), PersonalCandidateExposure.Bearish, [
        evidence("issuer:graniteshares:skdd", "ISSUER", "https://graniteshares.com/etfs/skdd/", "SKDD targets -200% of SKHY daily performance."),
        evidence("sec:skhy:listing", "SEC", "https://www.sec.gov/Archives/edgar/data/2120882/000119312526299963/d32785d424b4.htm", "SKHY identifies SK hynix American Depositary Shares."),
      ]),
    ],
  });
}

function validateEvidence(
  value: unknown,
  researchStatus: unknown,
  issues: PersonalWatchlistMappingIssue[],
): void {
  if (!Array.isArray(value)) {
    issues.push(issue(PersonalWatchlistMappingIssueCode.InvalidEvidence, "authorityEvidence", "Authority evidence must be an array."));
    return;
  }
  if (researchStatus === PersonalWatchlistResearchStatus.AuthorityVerified && value.length === 0) {
    issues.push(issue(PersonalWatchlistMappingIssueCode.EvidenceMissing, "authorityEvidence", "Verified research requires authority evidence."));
  }
  for (const [index, entry] of value.entries()) {
    if (!isRecord(entry)) {
      issues.push(issue(PersonalWatchlistMappingIssueCode.InvalidEvidence, `authorityEvidence[${index}]`, "Evidence must be an object."));
      continue;
    }
    rejectUnknown(entry, ["evidenceId", "authority", "url", "assertion", "retrievedAt"], `authorityEvidence[${index}]`, issues);
    if (typeof entry.evidenceId !== "string" || !IDENTIFIER.test(entry.evidenceId)
      || !["ISSUER", "SEC", "EXCHANGE"].includes(String(entry.authority))
      || typeof entry.url !== "string" || !HTTPS_URL.test(entry.url)
      || typeof entry.assertion !== "string" || entry.assertion.length < 10 || entry.assertion.length > 300
      || !isTimestamp(entry.retrievedAt)) {
      issues.push(issue(PersonalWatchlistMappingIssueCode.InvalidEvidence, `authorityEvidence[${index}]`, "Authority evidence is invalid."));
    }
  }
}

function validateOwnerDecision(value: unknown, issues: PersonalWatchlistMappingIssue[]): void {
  if (!isRecord(value)) {
    issues.push(issue(PersonalWatchlistMappingIssueCode.InvalidOwnerDecision, "ownerDecision", "Owner decision must be an object."));
    return;
  }
  rejectUnknown(value, ["status", "decidedBy", "decidedAt", "decisionReference"], "ownerDecision", issues);
  if (!Object.values(PersonalWatchlistOwnerStatus).includes(value.status as PersonalWatchlistOwnerStatus)) {
    issues.push(issue(PersonalWatchlistMappingIssueCode.InvalidOwnerDecision, "ownerDecision.status", "Owner decision status is invalid."));
    return;
  }
  const decided = value.status !== PersonalWatchlistOwnerStatus.Pending;
  if (decided !== (typeof value.decidedBy === "string" && IDENTIFIER.test(value.decidedBy))
    || decided !== isTimestamp(value.decidedAt)
    || decided !== (typeof value.decisionReference === "string" && IDENTIFIER.test(value.decisionReference))) {
    issues.push(issue(PersonalWatchlistMappingIssueCode.InvalidOwnerDecision, "ownerDecision", "Approved or rejected mappings require complete Owner decision evidence; pending mappings require none."));
  }
}

function rejectUnknown(
  value: Record<string, unknown>,
  allowed: readonly string[],
  field: string,
  issues: PersonalWatchlistMappingIssue[],
): void {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) {
      issues.push(issue(PersonalWatchlistMappingIssueCode.UndeclaredField, `${field}.${key}`, "Undeclared field is not allowed."));
    }
  }
}

function freezeValidation(values: readonly PersonalWatchlistMappingIssue[]): PersonalWatchlistMappingValidation {
  const issues = sortIssues(values);
  return deepFreeze({ valid: issues.length === 0, issues });
}

function issue(code: PersonalWatchlistMappingIssueCode, field: string, message: string): PersonalWatchlistMappingIssue {
  return { code, field, message };
}

function sortIssues(values: readonly PersonalWatchlistMappingIssue[]): PersonalWatchlistMappingIssue[] {
  return values.map((value) => ({ ...value }))
    .sort((left, right) => `${left.code}|${left.field}|${left.message}`.localeCompare(`${right.code}|${right.field}|${right.message}`));
}

function isTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) deepFreeze(nested);
  }
  return value;
}
