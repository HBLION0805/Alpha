import { createHash } from "node:crypto";
import type { OptionsMarketImportMetadata } from "../../contracts/OptionsMarketEvidence";
import { buildOptionsMarketEvidenceReport, createOptionsMarketEvidence, marketEvidenceFingerprint, qualifyOptionsMarketEvidence, validateOptionsMarketEvidence } from "./OptionsMarketEvidenceEngine";

function deeplyEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (left === null || right === null || typeof left !== "object" || typeof right !== "object" || Array.isArray(left) !== Array.isArray(right)) return false;
  const leftRecord = left as Record<string, unknown>, rightRecord = right as Record<string, unknown>;
  const keys = Object.keys(leftRecord).sort(), otherKeys = Object.keys(rightRecord).sort();
  return keys.length === otherKeys.length && keys.every((key, index) => key === otherKeys[index] && deeplyEqual(leftRecord[key], rightRecord[key]));
}
const assert = {
  equal(actual: unknown, expected: unknown): void { if (!Object.is(actual, expected)) throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`); },
  notEqual(actual: unknown, expected: unknown): void { if (Object.is(actual, expected)) throw new Error("Expected distinct values"); },
  deepEqual(actual: unknown, expected: unknown): void { if (!deeplyEqual(actual, expected)) throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`); },
  ok(value: unknown): void { if (!value) throw new Error("Expected truthy value"); },
  throws(run: () => unknown, pattern: RegExp): void {
    try { run(); } catch (error) { if (error instanceof Error && pattern.test(error.message)) return; throw error; }
    throw new Error(`Expected rejection matching ${pattern}`);
  },
};

let passed = 0;
function test(name: string, run: () => void): void { run(); passed++; console.log(`PASS ${name}`); }
const IMPORTED_AT = "2026-09-06T22:00:00.000Z";
const META: OptionsMarketImportMetadata = { datasetId: "market-test-1", origin: "SYNTHETIC_FIXTURE", source: "CBOE_DATASHOP_OPTION_QUOTES",
  usageDeclaration: "SYNTHETIC_TEST_ONLY", intervalMinutes: 1, delivery: "HISTORICAL_FILE" };
const OWNER: OptionsMarketImportMetadata = { ...META, origin: "OWNER_PROVIDED_FILE", usageDeclaration: "OWNER_ATTESTED_LOCAL_USE" };
const HEADERS = ["underlying_symbol", "quote_datetime", "root", "expiration", "strike", "option_type", "open", "high", "low", "close", "trade_volume", "bid_size", "bid", "ask_size", "ask", "underlying_bid", "underlying_ask", "implied_volatility", "delta", "gamma", "theta", "vega", "rho", "open_interest"];
const BASE: Readonly<Record<string, string>> = { underlying_symbol: "GLD", quote_datetime: "2026-09-04 10:00:00", root: "GLD", expiration: "2026-09-25", strike: "480.00", option_type: "C",
  open: "0.20", high: "0.30", low: "0.10", close: "0.25", trade_volume: "10", bid_size: "4", bid: "0.24", ask_size: "3", ask: "0.25",
  underlying_bid: "470.00", underlying_ask: "470.01", implied_volatility: "0.3", delta: "0.2", gamma: "0.01", theta: "-0.01", vega: "0.02", rho: "0.001", open_interest: "100" };
function csv(changes: readonly Record<string, string>[] = [{}]): string {
  return [HEADERS.join(","), ...changes.map((change) => { const row = { ...BASE, ...change }; return HEADERS.map((header) => row[header] ?? "").join(","); })].join("\n") + "\n";
}
function evidence(changes: readonly Record<string, string>[] = [{}], metadata: unknown = META, importedAt = IMPORTED_AT) {
  return createOptionsMarketEvidence(csv(changes), metadata, importedAt);
}
function qualified(changes: readonly Record<string, string>[] = [{}], metadata: unknown = META) {
  return qualifyOptionsMarketEvidence(evidence(changes, metadata));
}

test("source evidence binds canonical identity, exact prices and actual independent import time", () => {
  const result = evidence();
  assert.equal(result.adapterVersion, "CBOE_OPTION_QUOTES_CSV_V1");
  assert.equal(result.rows[0]!.contractKey, "GLD:2026-09-25:CALL:48000");
  assert.equal(result.rows[0]!.snapshotAt, "2026-09-04T14:00:00.000Z");
  assert.equal(result.rows[0]!.bidCents, 24); assert.equal(result.importedAt, IMPORTED_AT);
  assert.equal(result.metadata.origin, "SYNTHETIC_FIXTURE");
});
test("metadata requires exactly six data fields and cannot grant authority", () => {
  for (const change of [{ executionAllowed: true }, { importedAt: IMPORTED_AT }, { verified: true }]) assert.throws(() => evidence([{}], { ...META, ...change }), /INVALID_MARKET_IMPORT_METADATA_FIELDS/);
  const { source: _unused, ...missing } = META;
  assert.throws(() => evidence([{}], missing), /INVALID_MARKET_IMPORT_METADATA_FIELDS/);
});
test("dataset identifiers are bounded and exclude whitespace and control characters", () => {
  for (const datasetId of ["", " bad", "bad name", "a\nb", "a".repeat(101), "-id"]) assert.throws(() => evidence([{}], { ...META, datasetId }), /INVALID_MARKET_IMPORT_METADATA/);
  assert.equal(evidence([{}], { ...META, datasetId: "a".repeat(100) }).metadata.datasetId.length, 100);
});
test("origin and usage declaration cannot impersonate an owner or real source", () => {
  for (const metadata of [{ ...META, usageDeclaration: "OWNER_ATTESTED_LOCAL_USE" }, { ...META, usageDeclaration: "UNKNOWN" },
    { ...OWNER, usageDeclaration: "SYNTHETIC_TEST_ONLY" }, { ...OWNER, usageDeclaration: "VERIFIED_LICENSE" }]) {
    assert.throws(() => evidence([{}], metadata), /MARKET_IMPORT_ORIGIN_USAGE_MISMATCH/);
  }
  for (const metadata of [{ ...META, origin: "VERIFIED_LIVE" }, { ...META, source: "ROBINHOOD" }]) assert.throws(() => evidence([{}], metadata), /INVALID_MARKET_IMPORT_METADATA/);
});
test("declared interval bounds reject unsafe fractional and missing modeling assumptions", () => {
  for (const intervalMinutes of [0, -0, 406, 1.5, NaN, Infinity, "1"]) assert.throws(() => evidence([{}], { ...META, intervalMinutes }), /INVALID_MARKET_IMPORT_METADATA/);
  assert.equal(evidence([{}], { ...META, intervalMinutes: 405 }).metadata.intervalMinutes, 405);
  assert.throws(() => evidence([{}], { ...META, delivery: "REALTIME" }), /INVALID_MARKET_IMPORT_METADATA/);
});
test("ingestion timestamps must be canonical UTC milliseconds without normalized impossible dates", () => {
  for (const importedAt of ["2026-09-06", "2026-09-06T22:00:00Z", "2026-09-06T22:00:00.000", "2026-09-06T18:00:00.000-04:00", "2026-02-30T22:00:00.000Z"]) {
    assert.throws(() => evidence([{}], META, importedAt), /INVALID_MARKET_EVIDENCE_IMPORTED_AT/);
  }
});
test("owner snapshots after the real ingestion clock reject rather than backdating receipt", () => {
  assert.throws(() => evidence([{ quote_datetime: "2026-09-08 10:00:00" }], OWNER), /MARKET_SNAPSHOT_AFTER_IMPORT/);
  const sameClock = "2026-09-04T14:00:00.000Z";
  assert.equal(evidence([{}], OWNER, sameClock).importedAt, sameClock);
});
test("future synthetic cases remain synthetic and do not receive replay authority", () => {
  const result = evidence([{ quote_datetime: "2026-09-08 10:00:00" }]);
  assert.equal(result.importedAt, IMPORTED_AT);
  assert.ok(qualifyOptionsMarketEvidence(result).blockers.includes("SYNTHETIC_DATA_NOT_MARKET_EVIDENCE"));
  assert.equal(qualifyOptionsMarketEvidence(result).realPriceReplayReady, false);
});
test("file checksum includes exact UTF-8 BOM and line endings independently of normalized rows", () => {
  const content = csv(), modified = "\uFEFF" + content.replaceAll("\n", "\r\n");
  const first = createOptionsMarketEvidence(content, META, IMPORTED_AT), second = createOptionsMarketEvidence(modified, META, IMPORTED_AT);
  assert.equal(first.sourceFileSha256, `sha256:${createHash("sha256").update(content, "utf8").digest("hex")}`);
  assert.notEqual(first.sourceFileSha256, second.sourceFileSha256); assert.deepEqual(first.rows, second.rows);
});
test("oversized source files fail before parsing", () => {
  assert.throws(() => createOptionsMarketEvidence("x".repeat(4 * 1024 * 1024 + 1), META, IMPORTED_AT), /MARKET_EVIDENCE_FILE_BYTE_LIMIT/);
});
test("stored envelope version and checksum shape cannot be silently repaired", () => {
  const original = evidence();
  for (const change of [{ schemaVersion: "2.0" }, { adapterVersion: "UNKNOWN" }]) assert.throws(() => validateOptionsMarketEvidence({ ...original, ...change }), /UNSUPPORTED_MARKET_EVIDENCE_VERSION/);
  for (const sourceFileSha256 of ["", "sha256:abc", "f".repeat(64), `sha256:${"F".repeat(64)}`]) assert.throws(() => validateOptionsMarketEvidence({ ...original, sourceFileSha256 }), /INVALID_MARKET_EVIDENCE_SOURCE_HASH/);
  assert.throws(() => validateOptionsMarketEvidence({ ...original, licenseVerified: true }), /INVALID_MARKET_EVIDENCE_FIELDS/);
});
test("a stored raw-file hash remains an integrity reference instead of publisher authentication", () => {
  const altered = validateOptionsMarketEvidence({ ...evidence(), sourceFileSha256: `sha256:${"f".repeat(64)}` });
  assert.ok(qualifyOptionsMarketEvidence(altered).blockers.includes("SOURCE_AUTHENTICITY_UNVERIFIED"));
  assert.equal(qualifyOptionsMarketEvidence(altered).executionAllowed, false);
});
test("exact duplicate source observations count once and conflicting values reject", () => {
  const result = evidence([{}, {}]);
  assert.equal(result.rows.length, 1); assert.equal(result.duplicateRowCount, 1);
  assert.throws(() => evidence([{}, { bid: "0.23" }]), /CONFLICTING_SNAPSHOT/);
});
test("normalized storage cannot add repeated or conflicting snapshots behind duplicate counts", () => {
  const original = evidence();
  assert.throws(() => validateOptionsMarketEvidence({ ...original, rows: [original.rows[0], original.rows[0]] }), /DUPLICATE_NORMALIZED_MARKET_SNAPSHOT/);
  assert.throws(() => validateOptionsMarketEvidence({ ...original, rows: [original.rows[0], { ...original.rows[0], bidCents: 23 }] }), /CONFLICTING_NORMALIZED_MARKET_SNAPSHOT/);
});
test("one root contract cannot silently change underlying across later snapshots", () => {
  const original = evidence([{}, { quote_datetime: "2026-09-04 10:01:00" }]);
  assert.throws(() => validateOptionsMarketEvidence({ ...original, rows: [original.rows[0], { ...original.rows[1], underlyingSymbol: "IBIT" }] }), /MARKET_CONTRACT_UNDERLYING_CONFLICT/);
});
test("stored row and source counters retain the bounded original row budget", () => {
  const original = evidence();
  for (const change of [{ duplicateRowCount: -1 }, { nonTargetRowCount: 1.5 }, { duplicateRowCount: 10_000 }, { duplicateRowCount: -0 }]) {
    assert.throws(() => validateOptionsMarketEvidence({ ...original, ...change }), /INVALID_MARKET_EVIDENCE_COUNTS/);
  }
  assert.throws(() => validateOptionsMarketEvidence({ ...original, rows: Array(10_001).fill(original.rows[0]) }), /INVALID_MARKET_EVIDENCE_ROWS/);
});
test("normalized clock and identity are rechecked on every qualification", () => {
  const original = evidence();
  assert.throws(() => validateOptionsMarketEvidence({ ...original, rows: [{ ...original.rows[0], snapshotAt: "2026-09-04T15:00:00.000Z" }] }), /CBOE_TIMESTAMP_MISMATCH/);
  assert.throws(() => validateOptionsMarketEvidence({ ...original, rows: [{ ...original.rows[0], contractKey: "other" }] }), /CBOE_CONTRACT_IDENTITY_MISMATCH/);
});
test("missing prices and sizes remain null rather than manufactured trading liquidity", () => {
  const original = evidence([{ bid: "", bid_size: "", ask_size: "", underlying_bid: "", implied_volatility: "0" }]);
  assert.equal(original.rows[0]!.bidCents, null); assert.equal(original.rows[0]!.askSizeContracts, null);
  assert.equal(original.rows[0]!.impliedVolatility, null);
  const path = qualifyOptionsMarketEvidence(original).contractPaths[0]!;
  for (const blocker of ["OPTION_PRICES_MISSING", "DISPLAYED_SIZES_UNKNOWN", "UNDERLYING_PRICES_MISSING", "IMPLIED_VOLATILITY_UNAVAILABLE"]) assert.ok(path.blockers.includes(blocker));
  assert.ok(path.missingFields.includes("bidSizeContracts"));
});
test("reported zero values remain distinct from unknown and cannot imply a fill", () => {
  const original = evidence([{ bid: "0", ask: "0", bid_size: "0", ask_size: "0" }]);
  assert.equal(original.rows[0]!.askCents, 0); assert.equal(original.rows[0]!.askSizeContracts, 0);
  const path = qualifyOptionsMarketEvidence(original).contractPaths[0]!;
  assert.ok(path.blockers.includes("ZERO_OPTION_PRICE")); assert.ok(path.blockers.includes("ZERO_DISPLAYED_SIZE"));
  assert.ok(!path.missingFields.includes("askSizeContracts"));
});
test("a single snapshot cannot establish an entry-to-exit path", () => {
  const result = qualified();
  assert.equal(result.contractPaths[0]!.pathShape, "SINGLE_SNAPSHOT");
  assert.equal(result.contractPaths[0]!.maximumGapMinutes, null);
  assert.ok(result.blockers.includes("SINGLE_SNAPSHOT_ONLY")); assert.equal(result.tradesExecuted, 0);
});
test("multiple interval observations retain tick-order and replay-model blockers", () => {
  const result = qualified([{}, { quote_datetime: "2026-09-04 10:01:00" }], OWNER);
  const path = result.contractPaths[0]!;
  assert.equal(path.observationCount, 2); assert.equal(path.pathShape, "INTERVAL_SAMPLED_PATH");
  assert.equal(path.gapCount, 0); assert.equal(path.maximumGapMinutes, 1);
  assert.ok(result.blockers.includes("INTERVAL_SAMPLING_NOT_TICK_PATH")); assert.equal(result.realPriceReplayReady, false);
});
test("declared-interval gaps are measured without inventing intervening prices", () => {
  const result = qualified([{ quote_datetime: "2026-09-04 10:04:00" }, {}, { quote_datetime: "2026-09-04 10:01:00" }]);
  const path = result.contractPaths[0]!;
  assert.equal(path.firstSnapshotAt, "2026-09-04T14:00:00.000Z"); assert.equal(path.lastSnapshotAt, "2026-09-04T14:04:00.000Z");
  assert.equal(path.gapCount, 1); assert.equal(path.maximumGapMinutes, 3); assert.ok(path.blockers.includes("DECLARED_INTERVAL_GAPS"));
});
test("gap calculations do not silently remove unknown holidays or overnight closures", () => {
  const result = qualified([{ quote_datetime: "2026-09-03 15:59:00" }, { quote_datetime: "2026-09-04 09:30:00" }]);
  assert.equal(result.contractPaths[0]!.gapCount, 1); assert.equal(result.contractPaths[0]!.maximumGapMinutes, 1051);
  assert.ok(result.blockers.includes("EXCHANGE_CALENDAR_UNVERIFIED"));
});
test("different GLD and IBIT contracts are summarized independently in stable order", () => {
  const result = qualified([{ underlying_symbol: "IBIT", root: "IBIT", strike: "60", option_type: "P", delta: "-0.2" }, {}]);
  assert.equal(result.contractPaths.length, 2);
  assert.deepEqual(result.contractPaths.map((path) => path.underlyingSymbol), ["GLD", "IBIT"]);
});
test("a nonstandard target root is preserved as evidence and blocks contract conversion", () => {
  const result = qualified([{ root: "GLD1" }]);
  assert.equal(result.contractPaths[0]!.root, "GLD1");
  assert.ok(result.blockers.includes("ADJUSTED_OR_NONSTANDARD_ROOT_UNVERIFIED"));
});
test("an already expired market snapshot is retained with an explicit blocker", () => {
  const result = qualified([{ expiration: "2026-09-03" }]);
  assert.ok(result.blockers.includes("CONTRACT_EXPIRED_AT_SNAPSHOT")); assert.equal(result.tradesExecuted, 0);
});
test("sizes before the source change remain interval-end evidence without a fill guarantee", () => {
  const result = qualified([{ quote_datetime: "2026-06-19 10:00:00" }]);
  assert.equal(result.contractPaths[0]!.sizeSemantics, "PRE_2026_06_22_INTERVAL_END");
  assert.ok(!result.blockers.includes("SIZES_MAY_REFLECT_LAST_PRICE_CHANGE"));
  assert.ok(result.blockers.includes("FILL_MODEL_UNQUALIFIED"));
});
test("the size semantics cutoff includes the entire 2026-06-22 Eastern date", () => {
  const result = qualified([{ quote_datetime: "2026-06-22 09:31:00" }]);
  assert.equal(result.contractPaths[0]!.sizeSemantics, "LAST_PRICE_CHANGE_MAY_BE_STALE");
  assert.ok(result.blockers.includes("SIZES_MAY_REFLECT_LAST_PRICE_CHANGE"));
});
test("paths spanning the source size change retain mixed semantics explicitly", () => {
  const result = qualified([{ quote_datetime: "2026-06-19 10:00:00" }, { quote_datetime: "2026-06-22 10:00:00" }]);
  assert.equal(result.contractPaths[0]!.sizeSemantics, "MIXED");
});
test("a delayed delivery declaration remains delayed and cannot imply live eligibility", () => {
  const result = qualified([{}], { ...OWNER, delivery: "INTRADAY_15_MIN_DELAYED" });
  assert.ok(result.blockers.includes("DECLARED_15_MINUTE_DELAY"));
  assert.ok(result.blockers.includes("POINT_IN_TIME_AVAILABILITY_UNVERIFIED")); assert.equal(result.executionAllowed, false);
});
test("source, interval, delivery and usage metadata remain visible in qualification reports", () => {
  const metadata = { ...OWNER, intervalMinutes: 15, delivery: "INTRADAY_15_MIN_DELAYED" as const };
  const report = buildOptionsMarketEvidenceReport([evidence([{}], metadata)]);
  assert.deepEqual(report.datasets[0]!.metadata, metadata);
  assert.ok(report.limitations.some((limitation) => limitation.includes("beginning-of-day OCC")));
});
test("an owner intraday file inconsistent with its declared delay is diagnosed without changing clocks", () => {
  const metadata = { ...OWNER, delivery: "INTRADAY_15_MIN_DELAYED" as const };
  const early = evidence([{}], metadata, "2026-09-04T14:14:59.999Z");
  const result = qualifyOptionsMarketEvidence(early);
  assert.ok(result.blockers.includes("DECLARED_DELAY_INCONSISTENT_WITH_IMPORT_CLOCK"));
  assert.equal(early.rows[0]!.snapshotAt, "2026-09-04T14:00:00.000Z");
  assert.equal(early.importedAt, "2026-09-04T14:14:59.999Z");
  const boundary = evidence([{}], metadata, "2026-09-04T14:15:00.000Z");
  assert.ok(!qualifyOptionsMarketEvidence(boundary).blockers.includes("DECLARED_DELAY_INCONSISTENT_WITH_IMPORT_CLOCK"));
  const historical = evidence([{}], OWNER, "2026-09-04T14:00:00.000Z");
  assert.ok(!qualifyOptionsMarketEvidence(historical).blockers.includes("DECLARED_DELAY_INCONSISTENT_WITH_IMPORT_CLOCK"));
});
test("owner use attestation is not publisher verification and unknown use stays blocked", () => {
  const result = qualified([{}], { ...OWNER, usageDeclaration: "UNKNOWN" });
  assert.ok(result.blockers.includes("LOCAL_USAGE_DECLARATION_UNKNOWN"));
  assert.ok(qualified([{}], OWNER).blockers.includes("SOURCE_AUTHENTICITY_UNVERIFIED"));
});
test("non-target rows are counted without adding another trading instrument", () => {
  const result = evidence([{ underlying_symbol: "SPY", root: "SPY" }]);
  assert.equal(result.nonTargetRowCount, 1); assert.equal(result.rows.length, 0);
  assert.ok(qualifyOptionsMarketEvidence(result).blockers.includes("NO_TARGET_OPTION_ROWS"));
});
test("reports aggregate origins and retain a deterministic no-replay decision", () => {
  const synthetic = evidence(), owner = evidence([{}], { ...OWNER, datasetId: "owner-case" });
  const report = buildOptionsMarketEvidenceReport([owner, synthetic]);
  assert.equal(report.datasetCount, 2); assert.equal(report.rowCount, 2);
  assert.deepEqual(report.origins, { SYNTHETIC_FIXTURE: 1, OWNER_PROVIDED_FILE: 1 });
  assert.equal(report.decision, "NO_REPLAY"); assert.equal(report.tradesExecuted, 0);
  assert.equal(report.executionAllowed, false); assert.equal(report.winProbability, null);
  assert.deepEqual(report, buildOptionsMarketEvidenceReport([synthetic, owner]));
});
test("mixed-case dataset IDs and adjusted contract roots use locale-independent code-unit order", () => {
  const changes = [{ root: "GLD" }, { root: "GLD1" }];
  const lower = evidence(changes, { ...META, datasetId: "a" });
  const upper = evidence(changes, { ...META, datasetId: "B" });
  const report = buildOptionsMarketEvidenceReport([lower, upper]);
  assert.deepEqual(report.datasets.map((dataset) => dataset.datasetId), ["B", "a"]);
  // In contract keys, digit '1' sorts before ':' under code-unit ordering.
  for (const dataset of report.datasets) assert.deepEqual(dataset.contractPaths.map((path) => path.root), ["GLD1", "GLD"]);
  assert.deepEqual(report, buildOptionsMarketEvidenceReport([upper, lower]));
});
test("as-of reporting excludes files not yet actually imported", () => {
  const original = evidence([{}], OWNER);
  const prior = buildOptionsMarketEvidenceReport([original], "2026-09-06T21:59:59.999Z");
  assert.equal(prior.datasetCount, 0); assert.equal(prior.rowCount, 0); assert.equal(prior.excludedAfterAsOfCount, 1);
  assert.equal(buildOptionsMarketEvidenceReport([original], IMPORTED_AT).datasetCount, 1);
  assert.throws(() => buildOptionsMarketEvidenceReport([original], "2026-09-06"), /INVALID_MARKET_EVIDENCE_REPORT_AS_OF/);
});
test("as-of reporting never rewrites market snapshots or synthetic availability", () => {
  const original = evidence([{ quote_datetime: "2026-09-08 10:00:00" }]);
  const report = buildOptionsMarketEvidenceReport([original], IMPORTED_AT);
  assert.equal(report.datasets[0]!.contractPaths[0]!.firstSnapshotAt, "2026-09-08T14:00:00.000Z");
  assert.equal(report.realPriceReplayReady, false); assert.equal(original.importedAt, IMPORTED_AT);
});
test("exact dataset duplicates do not multiply reports and conflicting IDs reject", () => {
  const original = evidence();
  assert.equal(buildOptionsMarketEvidenceReport([original, original]).datasetCount, 1);
  const changed = evidence([{ bid: "0.23" }]);
  assert.throws(() => buildOptionsMarketEvidenceReport([original, changed]), /MARKET_EVIDENCE_DATASET_ID_CONFLICT/);
});
test("an empty evidence report is explicitly unable to replay trades", () => {
  const report = buildOptionsMarketEvidenceReport([]);
  assert.equal(report.datasetCount, 0); assert.equal(report.decision, "NO_REPLAY"); assert.equal(report.asOf, null);
  assert.throws(() => buildOptionsMarketEvidenceReport(Array(1001).fill(evidence())), /INVALID_MARKET_EVIDENCE_COLLECTION/);
});
test("canonical fingerprint ignores key insertion order and binds every scalar", () => {
  assert.equal(marketEvidenceFingerprint({ a: 1, b: [2, null] }), marketEvidenceFingerprint({ b: [2, null], a: 1 }));
  assert.notEqual(marketEvidenceFingerprint({ a: 1 }), marketEvidenceFingerprint({ a: "1" }));
  assert.equal(marketEvidenceFingerprint({ a: 1 }), `sha256:${createHash("sha256").update('{"a":1}').digest("hex")}`);
});
test("non-JSON or ambiguous fingerprint values cannot hide unbound fields", () => {
  for (const value of [undefined, NaN, Infinity, -0, BigInt(1), { a: undefined }, new Date(), Array(2)]) {
    assert.throws(() => marketEvidenceFingerprint(value), /INVALID_MARKET_EVIDENCE_FINGERPRINT_INPUT/);
  }
  const cycle: Record<string, unknown> = {}; cycle.self = cycle;
  assert.throws(() => marketEvidenceFingerprint(cycle), /INVALID_MARKET_EVIDENCE_FINGERPRINT_INPUT/);
});
test("accessors, hidden fields and non-plain metadata reject without executing getters", () => {
  let called = false;
  const metadata = { ...META };
  Object.defineProperty(metadata, "datasetId", { enumerable: true, get() { called = true; return "bad"; } });
  assert.throws(() => evidence([{}], metadata), /INVALID_MARKET_IMPORT_METADATA_FIELDS/); assert.equal(called, false);
  assert.throws(() => evidence([{}], { ...META, [Symbol("permission")]: true }), /INVALID_MARKET_IMPORT_METADATA_FIELDS/);
  assert.throws(() => evidence([{}], Object.assign(Object.create({ permission: true }), META)), /INVALID_MARKET_IMPORT_METADATA_FIELDS/);
  const original = evidence(), row = { ...original.rows[0] };
  Object.defineProperty(row, "bidCents", { enumerable: true, get() { called = true; return 24; } });
  assert.throws(() => validateOptionsMarketEvidence({ ...original, rows: [row] }), /INVALID_MARKET_EVIDENCE_ROW_FIELDS/); assert.equal(called, false);
});
test("normalized evidence and reports are frozen independent copies", () => {
  const mutable = JSON.parse(JSON.stringify(evidence()));
  const restored = validateOptionsMarketEvidence(mutable);
  mutable.rows[0].bidCents = 1; mutable.metadata.datasetId = "changed";
  assert.equal(restored.rows[0]!.bidCents, 24); assert.equal(restored.metadata.datasetId, META.datasetId);
  assert.ok(Object.isFrozen(restored)); assert.ok(Object.isFrozen(restored.rows)); assert.ok(Object.isFrozen(restored.rows[0]));
  const report = buildOptionsMarketEvidenceReport([restored]);
  assert.ok(Object.isFrozen(report.datasets)); assert.ok(Object.isFrozen(report.datasets[0]!.contractPaths[0]!.blockers));
});

console.log(`Options market evidence engine: ${passed}/${passed} passed.`);
