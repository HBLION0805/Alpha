import { BarFreshnessStatus, BarInterval, BarSessionType } from "../../../contracts/CanonicalBar";
import { MarketDataIssueCode } from "../../../contracts/MarketData";
import { TwelveDataTransportKind, TwelveDataVolumeEvidenceStatus, type TwelveDataValidatedResponse } from "../../../contracts/TwelveDataAdapter";
import { normalizeTwelveDataBars } from "./TwelveDataBarNormalizer";
import { TWELVE_DATA_AAPL_FIXTURE_MAPPING } from "./TwelveDataProvider";
import { fixturePolicy, fixtureRequest, FIXTURE_NORMALIZED_AT, FIXTURE_RECEIVED_AT } from "./TwelveDataTestFixtures";

function assertTrue(value: boolean, label: string): void { if (!value) throw new Error(`${label}: expected true.`); }
function assertEqual<T>(actual: T, expected: T, label: string): void { if (actual !== expected) throw new Error(`${label}: expected ${String(expected)}, received ${String(actual)}.`); }

function response(values: TwelveDataValidatedResponse["values"] = [
  { datetime: "2026-07-20 14:30:00", open: "224.1000", high: "224.5000", low: "224.0000", close: "224.3000", volume: "12500" },
  { datetime: "2026-07-20 14:35:00", open: "224.3000", high: "224.6000", low: "224.2000", close: "224.5500", volume: "8400" },
]): TwelveDataValidatedResponse {
  return { status: "ok", meta: { symbol: "AAPL", interval: "5min", currency: "USD", exchange: "NASDAQ", mic_code: "XNAS", type: "Common Stock" }, values };
}
function normalize(overrides: Record<string, unknown> = {}) {
  return normalizeTwelveDataBars({
    request: fixtureRequest(), mapping: TWELVE_DATA_AAPL_FIXTURE_MAPPING, response: response(),
    receivedAt: FIXTURE_RECEIVED_AT, normalizedAt: FIXTURE_NORMALIZED_AT,
    transportKind: TwelveDataTransportKind.Fixture, policy: fixturePolicy(), ...overrides,
  });
}

const tests: ReadonlyArray<readonly [string, () => void]> = [
  ["valid fixture rows become Canonical Bars", () => { const result = normalize(); assertEqual(result.status, "NORMALIZED", "status"); assertEqual(result.bars.length, 2, "bar count"); }],
  ["fixed-decimal precision is preserved", () => { const bar = normalize().bars[0]!; assertEqual(bar.value.open.atomicValue, "2241000", "atomic"); assertEqual(bar.value.open.scale, 4, "scale"); }],
  ["interval start and half-open end are deterministic", () => { const bar = normalize().bars[0]!; assertEqual(bar.intervalStart, "2026-07-20T14:30:00.000Z", "start"); assertEqual(bar.intervalEnd, "2026-07-20T14:35:00.000Z", "end"); }],
  ["provider publication time is not fabricated", () => assertTrue(normalize().bars.every((bar) => bar.providerPublishedAt === undefined), "publication omitted")],
  ["unverified live volume fails closed", () => { const result = normalize({ transportKind: TwelveDataTransportKind.Live }); assertEqual(result.status, "REJECTED", "status"); assertEqual(result.blockers[0]?.code, MarketDataIssueCode.AmbiguousUnits, "issue"); }],
  ["unreviewed fixture volume fails closed", () => { const result = normalize({ policy: fixturePolicy({ volumeEvidenceStatus: TwelveDataVolumeEvidenceStatus.Unresolved }) }); assertEqual(result.status, "REJECTED", "status"); }],
  ["officially verified live volume can normalize", () => { const result = normalize({ transportKind: TwelveDataTransportKind.Live, policy: fixturePolicy({ volumeEvidenceStatus: TwelveDataVolumeEvidenceStatus.OfficiallyVerified }) }); assertEqual(result.status, "NORMALIZED", "status"); }],
  ["open or closure-buffer bars are rejected", () => { const result = normalize({ response: response([{ datetime: "2026-07-20 14:44:00", open: "1", high: "1", low: "1", close: "1", volume: "1" }]), request: fixtureRequest({ interval: BarInterval.OneMinute, endTime: "2026-07-20T14:44:00.000Z" }) }); assertEqual(result.status, "REJECTED", "status"); }],
  ["rows outside request window are rejected", () => { const result = normalize({ request: fixtureRequest({ startTime: "2026-07-20T14:35:00.000Z" }) }); assertEqual(result.status, "REJECTED", "status"); }],
  ["invalid OHLC fails canonical validation", () => { const result = normalize({ response: response([{ datetime: "2026-07-20 14:30:00", open: "5", high: "4", low: "3", close: "4", volume: "1" }]) }); assertEqual(result.status, "REJECTED", "status"); }],
  ["exact duplicate rows deduplicate deterministically", () => { const row = response().values[0]!; const result = normalize({ response: response([row, row]) }); assertEqual(result.bars.length, 1, "deduplicated"); }],
  ["conflicting duplicate logical rows fail", () => { const row = response().values[0]!; const result = normalize({ response: response([row, { ...row, close: "224.4000" }]) }); assertEqual(result.status, "REJECTED", "status"); assertEqual(result.blockers[0]?.code, MarketDataIssueCode.ConflictingFields, "conflict"); }],
  ["output ordering is chronological", () => { const rows = [...response().values].reverse(); const result = normalize({ response: response(rows) }); assertTrue(result.bars[0]!.intervalStart < result.bars[1]!.intervalStart, "ordered"); }],
  ["staleness is deterministic", () => { const result = normalize({ request: fixtureRequest({ evaluatedAt: "2026-07-20T18:00:00.000Z" }) }); assertEqual(result.bars[0]?.quality.freshness, BarFreshnessStatus.Stale, "freshness"); }],
  ["unknown session avoids unsupported calendar claims", () => assertEqual(normalize().bars[0]?.session.sessionType, BarSessionType.Unknown, "session")],
  ["provider-native fields never appear", () => { const serialized = JSON.stringify(normalize()); assertTrue(!serialized.includes("mic_code"), "MIC absent"); assertTrue(!serialized.includes("exchange_timezone"), "timezone absent"); }],
  ["source reference excludes OHLCV content", () => { const first = normalize().bars[0]!; const changed = normalize({ response: response([{ ...response().values[0]!, close: "224.4000" }]) }).bars[0]!; assertEqual(first.source.sourceReference, changed.source.sourceReference, "source identity"); assertTrue(first.fingerprint !== changed.fingerprint, "fingerprint changes"); }],
  ["result and Bars are deeply immutable", () => { const result = normalize(); assertTrue(Object.isFrozen(result), "result frozen"); assertTrue(Object.isFrozen(result.bars[0]?.value), "bar value frozen"); }],
  ["repeated input is deterministic", () => assertEqual(JSON.stringify(normalize()), JSON.stringify(normalize()), "repeat")],
];

let passed = 0;
for (const [name, run] of tests) {
  try { run(); passed += 1; console.log(`PASS ${name}`); } catch (error: unknown) { console.error(`FAIL ${name}`); throw error; }
}
console.log(`Twelve Data Bar Normalizer tests passed: ${String(passed)}/${String(tests.length)}.`);
