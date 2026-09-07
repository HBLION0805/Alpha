import type { OptionsResearchSample, OptionsSamplePartitionInput, OptionsSamplePartitionName } from "../../contracts/OptionsSamplePartition";
import { exchangeLocalDate } from "../market-calendar/MarketCalendarValidation";
import { readinessClock, readinessFingerprint } from "../options-readiness/OptionsReadinessEngine";
import { freezePaper } from "../options-paper/OptionsPaperTradingEngine";

export const SAMPLE_PARTITIONS: readonly OptionsSamplePartitionName[] = Object.freeze(["TRAIN", "VALIDATION", "HOLDOUT"]);
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
function fail(code: string): never { throw Error("SAMPLE_PARTITION_" + code); }
function exact(value: unknown, keys: readonly string[]) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) fail("SHAPE");
  const descriptors = Object.getOwnPropertyDescriptors(value), own = Reflect.ownKeys(value);
  if (own.length !== keys.length || own.some(k => typeof k !== "string" || !keys.includes(k) || !("value" in descriptors[k]!) || !descriptors[k]!.enumerable)) fail("SHAPE");
}
function identifier(value: unknown) {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/.test(value)) fail("IDENTIFIER");
}
function hash(value: unknown) { if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) fail("HASH"); }
function list(value: unknown, min: number, max: number) {
  if (!Array.isArray(value) || value.length < min || value.length > max) fail("ARRAY_LIMIT");
  for (let i = 0; i < value.length; i++) if (!Object.hasOwn(value, i)) fail("ARRAY_HOLE");
}
function validate(value: unknown): OptionsSamplePartitionInput {
  exact(value, ["version", "datasetId", "origin", "protocol", "windows", "minimumGapMs", "samples"]);
  const input = value as OptionsSamplePartitionInput;
  if (input.version !== "OPTIONS_SAMPLE_PARTITION_INPUT_V1" || !["SYNTHETIC_FIXTURE", "UNVERIFIED_IMPORT"].includes(input.origin)) fail("SCOPE");
  identifier(input.datasetId); exact(input.protocol, ["reference", "sha256"]); identifier(input.protocol.reference); hash(input.protocol.sha256);
  if (!Number.isSafeInteger(input.minimumGapMs) || Object.is(input.minimumGapMs, -0) || input.minimumGapMs < 0 || input.minimumGapMs > 31 * 86400000) fail("GAP");
  exact(input.windows, SAMPLE_PARTITIONS);
  let end: string | null = null;
  for (const name of SAMPLE_PARTITIONS) {
    const window = input.windows[name]; exact(window, ["startAt", "endAt"]); readinessClock(window.startAt); readinessClock(window.endAt);
    if (window.startAt >= window.endAt) fail("WINDOW_ORDER");
    if (end !== null && Date.parse(window.startAt) - Date.parse(end) < input.minimumGapMs) fail("WINDOW_GAP");
    end = window.endAt;
  }
  list(input.samples, 0, 2000); const ids = new Set<string>();
  for (const sample of input.samples) {
    exact(sample, ["sampleId", "symbol", "episodeId", "strategyVersion", "evidenceSha256", "observationKeys", "featureWindowStartAt", "decisionAt", "featuresKnownAt", "outcomeState", "outcomeKnownAt"]);
    for (const v of [sample.sampleId, sample.episodeId, sample.strategyVersion]) identifier(v);
    if (ids.has(sample.sampleId)) fail("DUPLICATE_SAMPLE_ID"); ids.add(sample.sampleId);
    if (!["GLD", "IBIT"].includes(sample.symbol) || !["CLOSED", "NO_ENTRY", "UNRESOLVED"].includes(sample.outcomeState)) fail("SAMPLE_SCOPE");
    hash(sample.evidenceSha256); readinessClock(sample.decisionAt);
    for (const v of [sample.featureWindowStartAt, sample.featuresKnownAt, sample.outcomeKnownAt]) if (v !== null) readinessClock(v);
    list(sample.observationKeys, 1, 64); sample.observationKeys.forEach(identifier);
    if (new Set(sample.observationKeys).size !== sample.observationKeys.length) fail("DUPLICATE_OBSERVATION_KEY");
  }
  // Stable membership and fingerprints do not depend on a caller's row order.
  return freezePaper({ ...structuredClone(input), samples: input.samples.map(s => ({ ...structuredClone(s), observationKeys: [...s.observationKeys].sort(compare) }))
    .sort((a, b) => compare(a.decisionAt, b.decisionAt) || compare(a.sampleId, b.sampleId)) });
}

type Disposition = "ASSIGNED" | "PURGED" | "BLOCKED" | "UNASSIGNED";
interface SampleAudit {
  sample: OptionsResearchSample;
  nominalPartition: OptionsSamplePartitionName | null;
  decisionDateNewYork: string;
  disposition: Disposition;
  reasons: string[];
}
function assessSample(input: OptionsSamplePartitionInput, sample: OptionsResearchSample): SampleAudit {
  const nominalPartition = SAMPLE_PARTITIONS.find(name => sample.decisionAt >= input.windows[name].startAt && sample.decisionAt < input.windows[name].endAt) ?? null;
  const reasons: string[] = [];
  let disposition: Disposition = nominalPartition ? "ASSIGNED" : "UNASSIGNED";
  const block = (code: string) => { reasons.push(code); disposition = "BLOCKED"; };
  if (sample.featureWindowStartAt === null || sample.featuresKnownAt === null) block("FEATURE_TIMING_UNKNOWN");
  if (sample.featureWindowStartAt !== null && sample.featureWindowStartAt > sample.decisionAt) block("FEATURE_INTERVAL_AFTER_DECISION");
  if (sample.featuresKnownAt !== null && sample.featuresKnownAt > sample.decisionAt) block("FEATURES_LEARNED_AFTER_DECISION");
  if (sample.featureWindowStartAt !== null && sample.featuresKnownAt !== null && sample.featuresKnownAt < sample.featureWindowStartAt) block("FEATURE_KNOWLEDGE_BEFORE_INTERVAL");
  if (sample.outcomeKnownAt !== null && sample.outcomeKnownAt < sample.decisionAt) block("OUTCOME_BEFORE_DECISION");
  if (sample.outcomeState === "UNRESOLVED" && sample.outcomeKnownAt !== null) block("UNRESOLVED_WITH_KNOWN_OUTCOME");
  if (!nominalPartition) reasons.push("OUTSIDE_DECLARED_WINDOWS");
  else {
    const window = input.windows[nominalPartition];
    const purge = (code: string) => { reasons.push(code); if (disposition !== "BLOCKED") disposition = "PURGED"; };
    if (sample.featureWindowStartAt !== null && sample.featureWindowStartAt < window.startAt) purge("FEATURE_LOOKBACK_CROSSES_WINDOW_START");
    if (sample.outcomeState === "UNRESOLVED" || sample.outcomeKnownAt === null) purge("OUTCOME_UNRESOLVED_OR_TIME_UNKNOWN");
    if (sample.outcomeKnownAt !== null && sample.outcomeKnownAt >= window.endAt) purge("OUTCOME_REACHES_WINDOW_END");
  }
  return { sample, nominalPartition, decisionDateNewYork: exchangeLocalDate(sample.decisionAt, "America/New_York"), disposition, reasons };
}

/** Descriptive declarations only. No model fitting, test-set sealing or strategy authority. */
export function auditOptionsSamplePartitions(value: unknown) {
  const input = validate(value), cases = input.samples.map(sample => assessSample(input, sample));
  const dependence = new Map<string, { kind: string; key: string; members: SampleAudit[] }>();
  for (const row of cases.filter(r => r.disposition === "ASSIGNED")) {
    const keys = [["NEW_YORK_DATE", row.decisionDateNewYork], ["EPISODE", row.sample.episodeId], ["EXACT_EVIDENCE", row.sample.evidenceSha256],
      ...row.sample.observationKeys.map(key => ["OBSERVATION", key])];
    for (const [kind, key] of keys as [string, string][]) {
      const identity = kind + ":" + key, bucket = dependence.get(identity) ?? { kind, key, members: [] };
      bucket.members.push(row); dependence.set(identity, bucket);
    }
  }
  const reuse = [...dependence.values()].filter(g => g.members.length > 1).map(group => {
    const partitions = SAMPLE_PARTITIONS.filter(name => group.members.some(m => m.nominalPartition === name));
    if (partitions.length > 1) for (const member of group.members) {
      member.disposition = "BLOCKED";
      const code = "CROSS_PARTITION_" + group.kind + "_REUSE";
      if (!member.reasons.includes(code)) member.reasons.push(code);
    }
    return { kind: group.kind, key: group.key, sampleIds: group.members.map(m => m.sample.sampleId), partitions, crossesPartitions: partitions.length > 1 };
  }).sort((a, b) => compare(a.kind, b.kind) || compare(a.key, b.key));
  for (const row of cases) row.reasons.sort(compare);
  const partitions = SAMPLE_PARTITIONS.map(name => {
    const nominal = cases.filter(c => c.nominalPartition === name), assigned = nominal.filter(c => c.disposition === "ASSIGNED");
    return { name, window: input.windows[name], nominalSampleIds: nominal.map(c => c.sample.sampleId), assignedSampleIds: assigned.map(c => c.sample.sampleId),
      assignedCount: assigned.length, closedCount: assigned.filter(c => c.sample.outcomeState === "CLOSED").length,
      noEntryCount: assigned.filter(c => c.sample.outcomeState === "NO_ENTRY").length,
      distinctDecisionDatesNewYork: [...new Set(assigned.map(c => c.decisionDateNewYork))].sort(compare),
      symbols: ["GLD", "IBIT"].filter(symbol => assigned.some(c => c.sample.symbol === symbol)) };
  });
  const counts = { total: cases.length, assigned: 0, purged: 0, blocked: 0, unassigned: 0 };
  for (const row of cases) counts[row.disposition.toLowerCase() as "assigned" | "purged" | "blocked" | "unassigned"]++;
  const blockers = partitions.filter(p => !p.assignedCount).map(p => "EMPTY_" + p.name);
  if (counts.blocked) blockers.push("SAMPLE_INTEGRITY_BLOCKERS");
  const body = { version: "OPTIONS_SAMPLE_PARTITION_REPORT_V1", datasetId: input.datasetId, origin: input.origin,
    inputSha256: readinessFingerprint(input), protocol: input.protocol, minimumGapMs: input.minimumGapMs,
    status: blockers.length ? "DECLARED_PARTITION_BLOCKED" : "DECLARED_PARTITION_AUDITED", blockers, counts, partitions, cases, reuse,
    selectionBasis: "RETROSPECTIVE_DECLARATION", wholeUniverseVerified: false, independentSampleCount: null,
    heldOutAccessSealed: false, modelEvaluated: false, calibrated: false, winProbability: null, marketValidated: false,
    executionAllowed: false, sizeEscalationAllowed: false, automaticStrategyChanges: false,
    limitations: ["A declared partition audit does not authenticate evidence, prove all cases were supplied or establish statistical independence.",
      "Information intervals and declared dependence keys are conservative exclusions; omitted or false metadata cannot be discovered from hashes alone.",
      "Sample and date counts do not prove statistical power, profitability or an 80% success probability.",
      "No test data are sealed, model choices frozen, preprocessing fitted or holdout performance evaluated by this report.",
      "Every supplied sample is retained, including unresolved, no-entry, purged and blocked cases. No PnL or favorable-outcome selection is performed."] };
  return freezePaper({ ...body, reportSha256: readinessFingerprint(body) });
}
