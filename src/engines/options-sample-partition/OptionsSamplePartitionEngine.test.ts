import { auditOptionsSamplePartitions as audit, SAMPLE_PARTITIONS } from "./OptionsSamplePartitionEngine";
import { samplePartitionFixture, samplePartitionDemo } from "./OptionsSamplePartitionFixtures";
import { readinessFingerprint } from "../options-readiness/OptionsReadinessEngine";
const assert = {
  equal(a: unknown, b: unknown) { if (!Object.is(a, b)) throw Error(`Expected ${String(b)}, received ${String(a)}`); },
  deepEqual(a: unknown, b: unknown) { if (JSON.stringify(a) !== JSON.stringify(b)) throw Error("Expected equal structured values"); },
  ok(value: unknown) { if (!value) throw Error("Expected truthy"); },
  throws(work: () => unknown, code?: RegExp) { let caught; try { work(); } catch (error) { caught = error; } if (!(caught instanceof Error) || code && !code.test(caught.message)) throw Error("Expected failure " + String(code)); },
};
const fixture = (): any => structuredClone(samplePartitionFixture());
let passed = 0;
function test(name: string, work: () => void) { work(); passed++; console.log("PASS " + name); }
function row(input: any, index = 0) { return audit(input).cases.find(c => c.sample.sampleId === input.samples[index].sampleId)!; }

test("three chronological groups retain six cases and both ETFs", () => {
  const r = audit(fixture()); assert.equal(r.status, "DECLARED_PARTITION_AUDITED"); assert.deepEqual(r.counts, { total: 6, assigned: 6, purged: 0, blocked: 0, unassigned: 0 });
  assert.deepEqual(r.partitions.map(p => p.assignedCount), [2, 2, 2]); assert.deepEqual(r.partitions.map(p => p.symbols), [["GLD", "IBIT"], ["GLD", "IBIT"], ["GLD", "IBIT"]]);
  assert.equal(r.partitions[1]!.noEntryCount, 1); assert.equal(r.independentSampleCount, null);
});
for (const [index, name] of SAMPLE_PARTITIONS.entries()) test(name + " uses half-open decisions and excludes label end equality", () => {
  const v = fixture(), i = index * 2, w = v.windows[name];
  Object.assign(v.samples[i], { decisionAt: w.startAt, featureWindowStartAt: w.startAt, featuresKnownAt: w.startAt, outcomeKnownAt: w.startAt });
  assert.equal(row(v, i).disposition, "ASSIGNED");
  v.samples[i].outcomeKnownAt = w.endAt; assert.ok(row(v, i).reasons.includes("OUTCOME_REACHES_WINDOW_END"));
  Object.assign(v.samples[i], { decisionAt: w.endAt, featureWindowStartAt: w.endAt, featuresKnownAt: w.endAt, outcomeKnownAt: w.endAt });
  assert.equal(row(v, i).nominalPartition, null); assert.equal(row(v, i).disposition, "UNASSIGNED");
});
test("declared gaps reject overlap or too-short separation and allow exact gap", () => {
  const v = fixture(); v.minimumGapMs = 4 * 86400000; assert.equal(audit(v).minimumGapMs, v.minimumGapMs);
  v.minimumGapMs++; assert.throws(() => audit(v), /WINDOW_GAP/); v.minimumGapMs = 0; v.windows.VALIDATION.startAt = v.windows.TRAIN.startAt; assert.throws(() => audit(v), /WINDOW_GAP/);
});
test("unknown feature clocks are retained and block assignment", () => {
  for (const key of ["featureWindowStartAt", "featuresKnownAt"]) { const v = fixture(); v.samples[0][key] = null; assert.equal(row(v).disposition, "BLOCKED"); assert.ok(row(v).reasons.includes("FEATURE_TIMING_UNKNOWN")); }
});
test("future feature knowledge and backwards feature intervals block the sample", () => {
  const v = fixture(); v.samples[0].featuresKnownAt = "2026-09-08T14:00:00.001Z"; assert.ok(row(v).reasons.includes("FEATURES_LEARNED_AFTER_DECISION"));
  v.samples[0].featureWindowStartAt = "2026-09-08T14:00:00.002Z"; assert.ok(row(v).reasons.includes("FEATURE_INTERVAL_AFTER_DECISION")); assert.ok(row(v).reasons.includes("FEATURE_KNOWLEDGE_BEFORE_INTERVAL"));
});
test("feature lookback crossing a boundary is purged, not silently truncated", () => {
  const v = fixture(); v.samples[2].featureWindowStartAt = "2026-09-14T23:59:59.999Z";
  assert.equal(row(v, 2).disposition, "PURGED"); assert.ok(row(v, 2).reasons.includes("FEATURE_LOOKBACK_CROSSES_WINDOW_START")); assert.equal(audit(v).counts.total, 6);
});
test("unresolved and missing outcome clocks cannot become completed samples", () => {
  const v = fixture(); v.samples[0].outcomeState = "UNRESOLVED"; v.samples[0].outcomeKnownAt = null;
  v.samples[1].outcomeKnownAt = null; assert.equal(audit(v).counts.purged, 2); assert.ok(audit(v).blockers.includes("EMPTY_TRAIN"));
});
test("contradictory outcome chronology blocks without dropping the case", () => {
  const v = fixture(); v.samples[0].outcomeState = "UNRESOLVED"; assert.ok(row(v).reasons.includes("UNRESOLVED_WITH_KNOWN_OUTCOME"));
  v.samples[1].outcomeKnownAt = "2026-09-09T13:00:00.000Z"; assert.ok(row(v, 1).reasons.includes("OUTCOME_BEFORE_DECISION"));
});
test("completed no-entry cases do not change clock-based membership", () => {
  const v = fixture(), before = audit(v).partitions.map(p => p.assignedSampleIds); v.samples.forEach((s: any) => s.outcomeState = "NO_ENTRY");
  const after = audit(v); assert.deepEqual(after.partitions.map(p => p.assignedSampleIds), before); assert.ok(after.partitions.every(p => p.closedCount === 0 && p.noEntryCount === 2));
});
for (const [key, code] of [["episodeId", "EPISODE"], ["evidenceSha256", "EXACT_EVIDENCE"], ["observationKeys", "OBSERVATION"]]) test("cross-partition " + code + " reuse blocks every participant", () => {
  const v = fixture(); v.samples[5][key!] = v.samples[0][key!];
  const r = audit(v); assert.equal(r.counts.blocked, 2); assert.equal(row(v).disposition, "BLOCKED"); assert.equal(row(v, 5).disposition, "BLOCKED");
  assert.ok(r.reuse.some(g => g.kind === code && g.crossesPartitions && g.sampleIds.length === 2));
});
test("same New York date cannot span partitions even across GLD and IBIT", () => {
  const v = fixture(); v.minimumGapMs = 0; v.windows.TRAIN.endAt = "2026-09-09T16:00:00.000Z"; v.windows.VALIDATION.startAt = v.windows.TRAIN.endAt;
  Object.assign(v.samples[2], { featureWindowStartAt: "2026-09-09T16:00:00.000Z", decisionAt: "2026-09-09T17:00:00.000Z", featuresKnownAt: "2026-09-09T16:30:00.000Z", outcomeKnownAt: "2026-09-09T18:00:00.000Z" });
  const r = audit(v); assert.equal(r.counts.blocked, 2); assert.ok(r.reuse.some(g => g.kind === "NEW_YORK_DATE" && g.crossesPartitions));
});
test("within-partition reuse is disclosed without claiming independence", () => {
  const v = fixture(); v.samples[1].episodeId = v.samples[0].episodeId; v.samples[1].observationKeys = v.samples[0].observationKeys;
  const r = audit(v); assert.equal(r.counts.assigned, 6); assert.equal(r.reuse.length, 2); assert.ok(r.reuse.every(g => !g.crossesPartitions)); assert.equal(r.independentSampleCount, null);
});
test("already purged samples do not contaminate a partition that cannot use them", () => {
  const v = fixture(); v.samples[0].episodeId = v.samples[4].episodeId; v.samples[0].outcomeKnownAt = v.windows.TRAIN.endAt;
  assert.equal(row(v).disposition, "PURGED"); assert.equal(row(v, 4).disposition, "ASSIGNED"); assert.equal(audit(v).reuse.length, 0);
});
test("transitive conflicts are evaluated before any participants are removed", () => {
  const v = fixture(); v.samples[0].episodeId = v.samples[2].episodeId; v.samples[2].observationKeys = v.samples[4].observationKeys;
  assert.equal(audit(v).counts.blocked, 3); assert.equal(audit(v).reuse.filter(g => g.crossesPartitions).length, 2);
});
test("outside-window metadata failures stay visible", () => {
  const v = fixture(); v.samples[0].decisionAt = "2026-09-07T14:00:00.000Z";
  assert.equal(row(v).nominalPartition, null); assert.equal(row(v).disposition, "BLOCKED"); assert.ok(row(v).reasons.includes("OUTSIDE_DECLARED_WINDOWS"));
});
test("all-case conservation holds across the mixed demo", () => {
  const r = audit(samplePartitionDemo()[1]); assert.deepEqual(r.counts, { total: 6, assigned: 1, purged: 2, blocked: 3, unassigned: 0 });
  assert.equal(r.cases.length, r.counts.assigned + r.counts.purged + r.counts.blocked + r.counts.unassigned); assert.equal(r.status, "DECLARED_PARTITION_BLOCKED");
});
test("empty manifest stays blocked without inventing a sample", () => {
  const v = fixture(); v.samples = []; const r = audit(v); assert.deepEqual(r.blockers, ["EMPTY_TRAIN", "EMPTY_VALIDATION", "EMPTY_HOLDOUT"]); assert.equal(r.counts.total, 0);
});
test("input and observation ordering do not change canonical report fingerprints", () => {
  const v = fixture(); v.samples[0].observationKeys.push("additional-observation"); const r = audit(v);
  v.samples.reverse(); v.samples.forEach((s: any) => s.observationKeys.reverse()); assert.deepEqual(audit(v), r);
});
test("all reports and inputs remain immutable with an independently recomputed hash", () => {
  const v = fixture(), before = readinessFingerprint(v), r = audit(v); assert.equal(readinessFingerprint(v), before); assert.ok(Object.isFrozen(r.cases[0]!.sample.observationKeys));
  const { reportSha256, ...body } = r; assert.equal(readinessFingerprint(body), reportSha256);
});
test("neither imported origin nor audited partitions promote market authority", () => {
  const v = fixture(); v.origin = "UNVERIFIED_IMPORT"; const r = audit(v); assert.equal(r.origin, "UNVERIFIED_IMPORT");
  for (const key of ["heldOutAccessSealed", "modelEvaluated", "calibrated", "marketValidated", "executionAllowed", "sizeEscalationAllowed", "automaticStrategyChanges", "wholeUniverseVerified"] as const) assert.equal(r[key], false);
  assert.equal(r.winProbability, null); assert.equal(r.selectionBasis, "RETROSPECTIVE_DECLARATION");
});
test("malformed scopes, hashes, IDs and timestamps are rejected", () => {
  for (const edit of [(v: any) => v.origin = "REAL", (v: any) => v.samples[0].symbol = "BTC", (v: any) => v.samples[0].evidenceSha256 = "abc", (v: any) => v.samples[0].sampleId = "bad\nvalue", (v: any) => v.samples[0].decisionAt = "2026-09-08", (v: any) => v.samples[0].outcomeState = "PROFIT"]) { const v = fixture(); edit(v); assert.throws(() => audit(v)); }
});
test("duplicate sample IDs and observation keys cannot inflate evidence", () => {
  const v = fixture(); v.samples[1].sampleId = v.samples[0].sampleId; assert.throws(() => audit(v), /DUPLICATE_SAMPLE_ID/);
  const w = fixture(); w.samples[0].observationKeys.push(w.samples[0].observationKeys[0]); assert.throws(() => audit(w), /DUPLICATE_OBSERVATION_KEY/);
});
test("array and gap bounds reject excessive, fractional and negative values", () => {
  for (const gap of [-0, -1, 0.1, NaN, Infinity, 32 * 86400000]) { const v = fixture(); v.minimumGapMs = gap; assert.throws(() => audit(v), /GAP/); }
  const v = fixture(); v.samples = Array(2001).fill(v.samples[0]); assert.throws(() => audit(v), /ARRAY_LIMIT/);
  const w = fixture(); w.samples[0].observationKeys = []; assert.throws(() => audit(w), /ARRAY_LIMIT/);
  const x = fixture(); x.samples[0].observationKeys = Array.from({ length: 65 }, (_, i) => "key-" + i); assert.throws(() => audit(x), /ARRAY_LIMIT/);
});
test("unknown fields, accessors and sparse arrays cannot introduce hidden authority", () => {
  const v = fixture(); v.winProbability = 0.9; assert.throws(() => audit(v), /SHAPE/);
  const w = fixture(); w.samples[0].netPnlCents = 100; assert.throws(() => audit(w), /SHAPE/);
  const x = fixture(); Object.defineProperty(x, "datasetId", { get: () => "unexpected" }); assert.throws(() => audit(x), /SHAPE/);
  const y = fixture(); delete y.samples[0]; assert.throws(() => audit(y), /ARRAY_HOLE/);
});
test("decision date uses New York even when the UTC date differs", () => {
  const v = fixture(); Object.assign(v.samples[0], { featureWindowStartAt: "2026-09-09T00:00:00.000Z", featuresKnownAt: "2026-09-09T00:30:00.000Z", decisionAt: "2026-09-09T01:00:00.000Z", outcomeKnownAt: "2026-09-09T02:00:00.000Z" });
  assert.equal(row(v).decisionDateNewYork, "2026-09-08");
});
console.log(`${passed}/${passed} tests passed.`);
