import { createHash } from "node:crypto";
import type { CboeOptionQuoteRow, OptionsMarketImportMetadata } from "../../contracts/OptionsMarketEvidence";
import { parseCboeOptionQuotesCsv, validateCboeOptionQuoteRow } from "../../integration/options-market-evidence/CboeOptionQuotesCsv";

const MAX_FILE_BYTES = 4 * 1024 * 1024;
const MAX_ROWS = 10_000;
const MAX_DATASETS = 1000;
const SIZE_SEMANTICS_CHANGE_ET = "2026-06-22";
const METADATA_KEYS = ["datasetId", "origin", "source", "usageDeclaration", "intervalMinutes", "delivery"];
const EVIDENCE_KEYS = ["schemaVersion", "adapterVersion", "metadata", "importedAt", "sourceFileSha256", "rows", "nonTargetRowCount", "duplicateRowCount"];
const ROW_KEYS = ["underlyingSymbol", "root", "optionType", "expirationDate", "strikeCents", "contractKey", "quoteDatetimeEt", "snapshotAt", "bidCents", "askCents", "bidSizeContracts", "askSizeContracts", "underlyingBidCents", "underlyingAskCents", "impliedVolatility", "delta", "gamma", "theta", "vega", "rho", "openInterest"];
const NULLABLE_ROW_KEYS = ["bidCents", "askCents", "bidSizeContracts", "askSizeContracts", "underlyingBidCents", "underlyingAskCents", "impliedVolatility", "delta", "gamma", "theta", "vega", "rho", "openInterest"] as const;
const COMMON_REPLAY_BLOCKERS = [
  "CONTRACT_TERMS_UNVERIFIED", "EXCHANGE_CALENDAR_UNVERIFIED", "POINT_IN_TIME_AVAILABILITY_UNVERIFIED",
  "COST_AND_SLIPPAGE_MODEL_UNQUALIFIED", "FILL_MODEL_UNQUALIFIED", "SOURCE_AUTHENTICITY_UNVERIFIED", "INTERVAL_SAMPLING_NOT_TICK_PATH",
] as const;

export interface OptionsMarketEvidence {
  readonly schemaVersion: "1.0";
  readonly adapterVersion: "CBOE_OPTION_QUOTES_CSV_V1";
  readonly metadata: OptionsMarketImportMetadata;
  /** Actual local import time, independent of the historical market snapshot clock. */
  readonly importedAt: string;
  /** Exact source-file checksum; this does not authenticate a publisher or license. */
  readonly sourceFileSha256: string;
  readonly rows: readonly CboeOptionQuoteRow[];
  readonly nonTargetRowCount: number;
  readonly duplicateRowCount: number;
}

export interface OptionsMarketContractPath {
  readonly contractKey: string;
  readonly underlyingSymbol: "GLD" | "IBIT";
  readonly root: string;
  readonly optionType: "CALL" | "PUT";
  readonly expirationDate: string;
  readonly strikeCents: number;
  readonly observationCount: number;
  readonly firstSnapshotAt: string;
  readonly lastSnapshotAt: string;
  readonly pathShape: "SINGLE_SNAPSHOT" | "INTERVAL_SAMPLED_PATH";
  readonly missingFields: readonly string[];
  /** Gaps compare elapsed timestamps; unknown exchange sessions are not silently removed. */
  readonly gapCount: number;
  readonly maximumGapMinutes: number | null;
  readonly sizeSemantics: "PRE_2026_06_22_INTERVAL_END" | "LAST_PRICE_CHANGE_MAY_BE_STALE" | "MIXED";
  readonly blockers: readonly string[];
}

export interface OptionsMarketEvidenceQualification {
  readonly schemaVersion: "1.0";
  readonly datasetId: string;
  readonly origin: OptionsMarketImportMetadata["origin"];
  readonly metadata: OptionsMarketImportMetadata;
  readonly importedAt: string;
  readonly sourceFileSha256: string;
  readonly rowCount: number;
  readonly nonTargetRowCount: number;
  readonly duplicateRowCount: number;
  readonly contractPaths: readonly OptionsMarketContractPath[];
  readonly blockers: readonly string[];
  readonly decision: "NO_REPLAY";
  readonly realPriceReplayReady: false;
  readonly tradesExecuted: 0;
  readonly executionAllowed: false;
  readonly winProbability: null;
}

export interface OptionsMarketEvidenceReport {
  readonly schemaVersion: "1.0";
  readonly asOf: string | null;
  readonly datasetCount: number;
  readonly excludedAfterAsOfCount: number;
  readonly rowCount: number;
  readonly origins: Readonly<Record<OptionsMarketImportMetadata["origin"], number>>;
  readonly datasets: readonly OptionsMarketEvidenceQualification[];
  readonly decision: "NO_REPLAY";
  readonly realPriceReplayReady: false;
  readonly tradesExecuted: 0;
  readonly executionAllowed: false;
  readonly winProbability: null;
  readonly limitations: readonly string[];
}

function exactRecord(input: unknown, keys: readonly string[], code: string): Record<string, unknown> {
  if (input === null || typeof input !== "object" || Array.isArray(input)
      || ![Object.prototype, null].includes(Object.getPrototypeOf(input))) throw new Error(code);
  const descriptors = Object.getOwnPropertyDescriptors(input);
  const ownKeys = Reflect.ownKeys(input);
  if (ownKeys.length !== keys.length || ownKeys.some((key) => typeof key !== "string" || !keys.includes(key)
      || !Object.hasOwn(descriptors[key]!, "value") || !descriptors[key]!.enumerable)) throw new Error(code);
  return input as Record<string, unknown>;
}

function array(input: unknown, maximum: number, code: string): readonly unknown[] {
  if (!Array.isArray(input) || Object.getPrototypeOf(input) !== Array.prototype || input.length > maximum) throw new Error(code);
  const descriptors = Object.getOwnPropertyDescriptors(input);
  if (Reflect.ownKeys(input).length !== input.length + 1 || Array.from({ length: input.length }, (_, index) => String(index))
    .some((key) => !Object.hasOwn(descriptors, key) || !Object.hasOwn(descriptors[key]!, "value") || !descriptors[key]!.enumerable)) throw new Error(code);
  return input;
}

function utc(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
}

function integer(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && !Object.is(value, -0) && value >= minimum && value <= maximum;
}

function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object") { for (const child of Object.values(value)) freeze(child); Object.freeze(value); }
  return value;
}

/** Canonical JSON SHA-256 for local integrity, not authentication or permission. */
export function marketEvidenceFingerprint(value: unknown): string {
  const active = new Set<object>();
  function canonical(item: unknown, depth = 0): string {
    if (depth > 100) throw new Error("INVALID_MARKET_EVIDENCE_FINGERPRINT_INPUT");
    if (item === null || typeof item === "string" || typeof item === "boolean") return JSON.stringify(item);
    if (typeof item === "number" && Number.isFinite(item) && !Object.is(item, -0)) return JSON.stringify(item);
    if (typeof item !== "object" || active.has(item)) throw new Error("INVALID_MARKET_EVIDENCE_FINGERPRINT_INPUT");
    active.add(item);
    try {
      if (Array.isArray(item)) return `[${array(item, 1_000_000, "INVALID_MARKET_EVIDENCE_FINGERPRINT_INPUT").map((child) => canonical(child, depth + 1)).join(",")}]`;
      const keys = Object.keys(item).sort();
      const checked = exactRecord(item, keys, "INVALID_MARKET_EVIDENCE_FINGERPRINT_INPUT");
      return `{${keys.map((key) => `${JSON.stringify(key)}:${canonical(checked[key], depth + 1)}`).join(",")}}`;
    } finally { active.delete(item); }
  }
  return `sha256:${createHash("sha256").update(canonical(value), "utf8").digest("hex")}`;
}

function validateMetadata(input: unknown): OptionsMarketImportMetadata {
  const value = exactRecord(input, METADATA_KEYS, "INVALID_MARKET_IMPORT_METADATA_FIELDS");
  if (typeof value.datasetId !== "string" || !/^[A-Za-z0-9][A-Za-z0-9:._/-]{0,99}$/u.test(value.datasetId)
      || (value.origin !== "SYNTHETIC_FIXTURE" && value.origin !== "OWNER_PROVIDED_FILE")
      || value.source !== "CBOE_DATASHOP_OPTION_QUOTES" || !integer(value.intervalMinutes, 1, 405)
      || (value.delivery !== "HISTORICAL_FILE" && value.delivery !== "INTRADAY_15_MIN_DELAYED")) throw new Error("INVALID_MARKET_IMPORT_METADATA");
  if ((value.origin === "SYNTHETIC_FIXTURE" && value.usageDeclaration !== "SYNTHETIC_TEST_ONLY")
      || (value.origin === "OWNER_PROVIDED_FILE" && value.usageDeclaration !== "OWNER_ATTESTED_LOCAL_USE" && value.usageDeclaration !== "UNKNOWN")) {
    throw new Error("MARKET_IMPORT_ORIGIN_USAGE_MISMATCH");
  }
  return Object.freeze({ datasetId: value.datasetId, origin: value.origin, source: value.source,
    usageDeclaration: value.usageDeclaration, intervalMinutes: value.intervalMinutes, delivery: value.delivery }) as OptionsMarketImportMetadata;
}

/** The caller supplies the actual ingestion clock; CSV content cannot supply one. */
export function createOptionsMarketEvidence(csv: string, metadata: unknown, importedAt: string): OptionsMarketEvidence {
  if (typeof csv !== "string" || new TextEncoder().encode(csv).byteLength > MAX_FILE_BYTES) throw new Error("MARKET_EVIDENCE_FILE_BYTE_LIMIT");
  const checkedMetadata = validateMetadata(metadata);
  if (!utc(importedAt)) throw new Error("INVALID_MARKET_EVIDENCE_IMPORTED_AT");
  const parsed = parseCboeOptionQuotesCsv(csv);
  return validateOptionsMarketEvidence({ schemaVersion: "1.0", adapterVersion: "CBOE_OPTION_QUOTES_CSV_V1",
    metadata: checkedMetadata, importedAt, sourceFileSha256: `sha256:${createHash("sha256").update(csv, "utf8").digest("hex")}`,
    rows: parsed.rows, nonTargetRowCount: parsed.nonTargetRowCount, duplicateRowCount: parsed.duplicateRowCount });
}

/** Rehydrates normalized content; the raw source checksum cannot authenticate or reconstruct an absent source file. */
export function validateOptionsMarketEvidence(input: unknown): OptionsMarketEvidence {
  const value = exactRecord(input, EVIDENCE_KEYS, "INVALID_MARKET_EVIDENCE_FIELDS");
  if (value.schemaVersion !== "1.0" || value.adapterVersion !== "CBOE_OPTION_QUOTES_CSV_V1") throw new Error("UNSUPPORTED_MARKET_EVIDENCE_VERSION");
  const metadata = validateMetadata(value.metadata);
  if (!utc(value.importedAt)) throw new Error("INVALID_MARKET_EVIDENCE_IMPORTED_AT");
  if (typeof value.sourceFileSha256 !== "string" || !/^sha256:[0-9a-f]{64}$/u.test(value.sourceFileSha256)) throw new Error("INVALID_MARKET_EVIDENCE_SOURCE_HASH");
  const rawRows = array(value.rows, MAX_ROWS, "INVALID_MARKET_EVIDENCE_ROWS");
  if (!integer(value.nonTargetRowCount, 0, MAX_ROWS) || !integer(value.duplicateRowCount, 0, MAX_ROWS)
      || rawRows.length + value.nonTargetRowCount + value.duplicateRowCount > MAX_ROWS) throw new Error("INVALID_MARKET_EVIDENCE_COUNTS");
  const rows: CboeOptionQuoteRow[] = [];
  const indexed = new Map<string, string>();
  const contractUnderlyings = new Map<string, string>();
  for (const raw of rawRows) {
    exactRecord(raw, ROW_KEYS, "INVALID_MARKET_EVIDENCE_ROW_FIELDS");
    const row = validateCboeOptionQuoteRow(raw);
    const priorUnderlying = contractUnderlyings.get(row.contractKey);
    if (priorUnderlying !== undefined && priorUnderlying !== row.underlyingSymbol) throw new Error("MARKET_CONTRACT_UNDERLYING_CONFLICT");
    contractUnderlyings.set(row.contractKey, row.underlyingSymbol);
    if (metadata.origin === "OWNER_PROVIDED_FILE" && row.snapshotAt > value.importedAt) throw new Error("MARKET_SNAPSHOT_AFTER_IMPORT");
    const key = `${row.contractKey}:${row.snapshotAt}`;
    const fingerprint = marketEvidenceFingerprint(row);
    if (indexed.has(key)) throw new Error(indexed.get(key) === fingerprint ? "DUPLICATE_NORMALIZED_MARKET_SNAPSHOT" : "CONFLICTING_NORMALIZED_MARKET_SNAPSHOT");
    indexed.set(key, fingerprint); rows.push(row);
  }
  return freeze({ schemaVersion: "1.0", adapterVersion: "CBOE_OPTION_QUOTES_CSV_V1", metadata,
    importedAt: value.importedAt, sourceFileSha256: value.sourceFileSha256, rows,
    nonTargetRowCount: value.nonTargetRowCount, duplicateRowCount: value.duplicateRowCount });
}

function uniqueSorted(values: readonly string[]): string[] { return [...new Set(values)].sort(); }
function compareCodeUnits(left: string, right: string): number { return left < right ? -1 : left > right ? 1 : 0; }

/** Format inspection never becomes a live quotation, historical fill, decision signal or proven trade outcome. */
export function qualifyOptionsMarketEvidence(input: OptionsMarketEvidence): OptionsMarketEvidenceQualification {
  const evidence = validateOptionsMarketEvidence(input);
  const grouped = new Map<string, CboeOptionQuoteRow[]>();
  for (const row of evidence.rows) { const path = grouped.get(row.contractKey) ?? []; path.push(row); grouped.set(row.contractKey, path); }
  const datasetBlockers: string[] = [...COMMON_REPLAY_BLOCKERS];
  if (evidence.metadata.origin === "SYNTHETIC_FIXTURE") datasetBlockers.push("SYNTHETIC_DATA_NOT_MARKET_EVIDENCE");
  if (evidence.metadata.usageDeclaration === "UNKNOWN") datasetBlockers.push("LOCAL_USAGE_DECLARATION_UNKNOWN");
  datasetBlockers.push(evidence.metadata.delivery === "INTRADAY_15_MIN_DELAYED" ? "DECLARED_15_MINUTE_DELAY" : "HISTORICAL_DELIVERY_AVAILABILITY_UNKNOWN");
  if (evidence.rows.length === 0) datasetBlockers.push("NO_TARGET_OPTION_ROWS");
  const contractPaths = [...grouped.entries()].sort(([left], [right]) => compareCodeUnits(left, right)).map(([contractKey, rawRows]): OptionsMarketContractPath => {
    const rows = [...rawRows].sort((left, right) => compareCodeUnits(left.snapshotAt, right.snapshotAt));
    const first = rows[0]!, last = rows.at(-1)!;
    const missingFields = NULLABLE_ROW_KEYS.filter((key) => rows.some((row) => row[key] === null));
    const blockers: string[] = [...COMMON_REPLAY_BLOCKERS];
    const gaps = rows.slice(1).map((row, index) => (Date.parse(row.snapshotAt) - Date.parse(rows[index]!.snapshotAt)) / 60_000);
    const gapCount = gaps.filter((minutes) => minutes > evidence.metadata.intervalMinutes).length;
    if (rows.length === 1) blockers.push("SINGLE_SNAPSHOT_ONLY");
    if (gapCount > 0) blockers.push("DECLARED_INTERVAL_GAPS");
    if (rows.some((row) => row.root !== row.underlyingSymbol)) blockers.push("ADJUSTED_OR_NONSTANDARD_ROOT_UNVERIFIED");
    if (rows.some((row) => row.quoteDatetimeEt.slice(0, 10) > row.expirationDate)) blockers.push("CONTRACT_EXPIRED_AT_SNAPSHOT");
    if (evidence.metadata.origin === "OWNER_PROVIDED_FILE" && evidence.metadata.delivery === "INTRADAY_15_MIN_DELAYED"
      && rows.some((row) => Date.parse(evidence.importedAt) - Date.parse(row.snapshotAt) < 15 * 60_000)) {
      blockers.push("DECLARED_DELAY_INCONSISTENT_WITH_IMPORT_CLOCK");
    }
    if (missingFields.includes("bidCents") || missingFields.includes("askCents")) blockers.push("OPTION_PRICES_MISSING");
    if (missingFields.includes("bidSizeContracts") || missingFields.includes("askSizeContracts")) blockers.push("DISPLAYED_SIZES_UNKNOWN");
    if (missingFields.includes("underlyingBidCents") || missingFields.includes("underlyingAskCents")) blockers.push("UNDERLYING_PRICES_MISSING");
    if (missingFields.includes("impliedVolatility")) blockers.push("IMPLIED_VOLATILITY_UNAVAILABLE");
    if (rows.some((row) => row.bidCents === 0 || row.askCents === 0)) blockers.push("ZERO_OPTION_PRICE");
    if (rows.some((row) => row.bidSizeContracts === 0 || row.askSizeContracts === 0)) blockers.push("ZERO_DISPLAYED_SIZE");
    const modernCount = rows.filter((row) => row.quoteDatetimeEt.slice(0, 10) >= SIZE_SEMANTICS_CHANGE_ET).length;
    const sizeSemantics = modernCount === 0 ? "PRE_2026_06_22_INTERVAL_END" : modernCount === rows.length ? "LAST_PRICE_CHANGE_MAY_BE_STALE" : "MIXED";
    if (modernCount > 0) blockers.push("SIZES_MAY_REFLECT_LAST_PRICE_CHANGE");
    datasetBlockers.push(...blockers);
    return { contractKey, underlyingSymbol: first.underlyingSymbol, root: first.root, optionType: first.optionType,
      expirationDate: first.expirationDate, strikeCents: first.strikeCents, observationCount: rows.length,
      firstSnapshotAt: first.snapshotAt, lastSnapshotAt: last.snapshotAt,
      pathShape: rows.length === 1 ? "SINGLE_SNAPSHOT" : "INTERVAL_SAMPLED_PATH", missingFields,
      gapCount, maximumGapMinutes: gaps.length ? Math.max(...gaps) : null, sizeSemantics, blockers: uniqueSorted(blockers) };
  });
  return freeze({ schemaVersion: "1.0", datasetId: evidence.metadata.datasetId, origin: evidence.metadata.origin,
    metadata: evidence.metadata,
    importedAt: evidence.importedAt, sourceFileSha256: evidence.sourceFileSha256, rowCount: evidence.rows.length,
    nonTargetRowCount: evidence.nonTargetRowCount, duplicateRowCount: evidence.duplicateRowCount, contractPaths,
    blockers: uniqueSorted(datasetBlockers), decision: "NO_REPLAY", realPriceReplayReady: false,
    tradesExecuted: 0, executionAllowed: false, winProbability: null });
}

/** As-of selection uses actual ingestion only; it never pretends the imported file was previously available. */
export function buildOptionsMarketEvidenceReport(inputs: readonly OptionsMarketEvidence[], asOf?: string): OptionsMarketEvidenceReport {
  if (asOf !== undefined && !utc(asOf)) throw new Error("INVALID_MARKET_EVIDENCE_REPORT_AS_OF");
  const evidences = array(inputs, MAX_DATASETS, "INVALID_MARKET_EVIDENCE_COLLECTION").map(validateOptionsMarketEvidence);
  const distinct = new Map<string, OptionsMarketEvidence>();
  for (const evidence of evidences) {
    const previous = distinct.get(evidence.metadata.datasetId);
    if (previous && marketEvidenceFingerprint(previous) !== marketEvidenceFingerprint(evidence)) throw new Error("MARKET_EVIDENCE_DATASET_ID_CONFLICT");
    distinct.set(evidence.metadata.datasetId, evidence);
  }
  const available = [...distinct.values()].filter((evidence) => asOf === undefined || evidence.importedAt <= asOf)
    .sort((left, right) => compareCodeUnits(left.importedAt, right.importedAt) || compareCodeUnits(left.metadata.datasetId, right.metadata.datasetId));
  const datasets = available.map(qualifyOptionsMarketEvidence);
  return freeze({ schemaVersion: "1.0", asOf: asOf ?? null, datasetCount: datasets.length,
    excludedAfterAsOfCount: distinct.size - datasets.length, rowCount: datasets.reduce((total, dataset) => total + dataset.rowCount, 0),
    origins: { SYNTHETIC_FIXTURE: datasets.filter((dataset) => dataset.origin === "SYNTHETIC_FIXTURE").length,
      OWNER_PROVIDED_FILE: datasets.filter((dataset) => dataset.origin === "OWNER_PROVIDED_FILE").length },
    datasets, decision: "NO_REPLAY", realPriceReplayReady: false, tradesExecuted: 0, executionAllowed: false, winProbability: null,
    limitations: [
      "A supported local file layout and its checksum do not authenticate the publisher or establish data rights.",
      "Snapshots retain interval-end Eastern and UTC timestamps; actual local import time is a separate availability boundary.",
      "Intraday delivery is declared 15-minute delayed. Historical row-level availability is unknown; neither delivery is a verified live feed.",
      "Interval snapshots do not reveal tick order. Gap counts include elapsed time across unknown exchange sessions and cannot prove a complete trade path.",
      "On or after 2026-06-22 ET, reported sizes may reflect the last price change in the interval instead of contemporaneous liquidity.",
      "Unknown prices, sizes and model analytics remain unknown. Source-model IV zero is unavailable.",
      "Open interest is beginning-of-day OCC information, not a measurement of current intraday positions or flows.",
      "Contract terms, exchange calendars, point-in-time availability, fees, slippage and fill assumptions require independent qualification before replay.",
      "No source-format import enters the v1 paper account, changes existing trade reviews, creates a win rate or authorizes a brokerage operation.",
    ] });
}
