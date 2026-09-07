import type { OptionsResearchProtocolDeclaration } from "../../contracts/OptionsResearchProtocol";
import { assessOptionsResearchProtocol as assess, PROTOCOL_DEFINITION_MAX_CHARACTERS } from "./OptionsResearchProtocol";
import { auditOptionsSamplePartitions } from "./OptionsSamplePartitionEngine";
import { readinessFingerprint } from "../options-readiness/OptionsReadinessEngine";

const assert = {
  equal(a: unknown, b: unknown) { if (!Object.is(a, b)) throw Error("Expected equal values"); },
  notEqual(a: unknown, b: unknown) { if (Object.is(a, b)) throw Error("Expected distinct values"); },
  deepEqual(a: unknown, b: unknown) { if (JSON.stringify(a) !== JSON.stringify(b)) throw Error("Expected equal structured values"); },
  ok(value: unknown) { if (!value) throw Error("Expected truthy value"); },
  throws(work: () => unknown, code?: RegExp) { let caught; try { work(); } catch (error) { caught = error; } if (!(caught instanceof Error) || code && !code.test(caught.message)) throw Error("Expected failure " + String(code)); },
};

const before = "2026-09-07T20:00:00.000Z";
function fixture(): OptionsResearchProtocolDeclaration {
  return { version: "OPTIONS_RESEARCH_PROTOCOL_DECLARATION_V1", protocolId: "synthetic-protocol-1", datasetId: "synthetic-dataset-1", origin: "SYNTHETIC_FIXTURE", strategyVersion: "synthetic-strategy-v1", symbols: ["GLD", "IBIT"],
    featureDefinition: { reference: "synthetic-feature-definition", content: "Synthetic test definition only. Full feature lineage is not demonstrated." },
    outcomeDefinition: { reference: "synthetic-outcome-definition", content: "Retain all no-entry, unresolved and closed cases. No actual outcomes exist." },
    windows: { TRAIN: { startAt: "2026-09-08T13:30:00.000Z", endAt: "2026-09-09T00:00:00.000Z" }, VALIDATION: { startAt: "2026-09-10T13:30:00.000Z", endAt: "2026-09-11T00:00:00.000Z" }, HOLDOUT: { startAt: "2026-09-12T13:30:00.000Z", endAt: "2026-09-13T00:00:00.000Z" } }, minimumGapMs: 86400000 };
}
const run = (input = fixture(), at = before) => assess(input, at);
let passed = 0;
function test(name: string, fn: () => void) { fn(); passed++; console.log(`PASS ${name}`); }
test("valid declarations preserve complete definitions and original empty-window audit", () => {
  const r = run(); assert.equal(r.timing, "DECLARED_BEFORE_FIRST_WINDOW");
  assert.equal(r.declarationSha256, readinessFingerprint(r.declaration));
  assert.equal(r.featureDefinitionSha256, readinessFingerprint(r.declaration.featureDefinition));
  assert.equal(r.outcomeDefinitionSha256, readinessFingerprint(r.declaration.outcomeDefinition));
  assert.deepEqual(r.partitionAudit, auditOptionsSamplePartitions({ version: "OPTIONS_SAMPLE_PARTITION_INPUT_V1", datasetId: r.declaration.datasetId, origin: r.declaration.origin, protocol: { reference: r.declaration.protocolId, sha256: r.declarationSha256 }, windows: r.declaration.windows, minimumGapMs: r.declaration.minimumGapMs, samples: [] }));
  assert.deepEqual(r.partitionAudit.blockers, ["EMPTY_TRAIN", "EMPTY_VALIDATION", "EMPTY_HOLDOUT"]); assert.equal(r.partitionAudit.counts.total, 0);
});
test("registration exactly at first window or later is retained as late", () => {
  const input = fixture(); for (const at of [input.windows.TRAIN.startAt, "2026-09-08T13:30:00.001Z", "2026-09-14T00:00:00.000Z"]) {
    const r = run(input, at); assert.equal(r.timing, "DECLARED_AT_OR_AFTER_FIRST_WINDOW"); assert.deepEqual(r.timingReasons, ["DECLARED_REGISTRATION_NOT_BEFORE_FIRST_WINDOW"]); assert.equal(r.declaredRegistrationAt, at);
  }
});
test("one millisecond before first window is distinct from equality", () => {
  assert.equal(run(fixture(), "2026-09-08T13:29:59.999Z").timing, "DECLARED_BEFORE_FIRST_WINDOW");
});
test("registration clock does not alter frozen declaration identity", () => {
  const a = run(), b = run(fixture(), "2026-09-14T00:00:00.000Z"); assert.equal(a.declarationSha256, b.declarationSha256); assert.notEqual(a.artifactSha256, b.artifactSha256);
});
test("definition strategy and window changes each alter declaration identity", () => {
  const initial = run(); for (const change of [(v: any) => v.featureDefinition.content += " Different feature.", (v: any) => v.outcomeDefinition.reference += "-v2", (v: any) => v.strategyVersion += "-v2", (v: any) => v.windows.HOLDOUT.endAt = "2026-09-14T00:00:00.000Z"]) {
    const v = fixture(); change(v); assert.notEqual(run(v).declarationSha256, initial.declarationSha256);
  }
});
test("symbol order is canonical but duplicates and unrelated instruments are rejected", () => {
  assert.deepEqual(run({ ...fixture(), symbols: ["IBIT", "GLD"] }), run());
  for (const symbols of [["GLD"], ["GLD", "GLD"], ["GLD", "BTC"], ["GLD", "IBIT", "GLD"]]) assert.throws(() => run({ ...fixture(), symbols } as OptionsResearchProtocolDeclaration), /SYMBOL_SCOPE/);
});
test("existing window ordering and minimum gap bounds remain enforced", () => {
  for (const change of [(v: any) => v.windows.TRAIN.endAt = v.windows.TRAIN.startAt, (v: any) => v.windows.VALIDATION.startAt = v.windows.TRAIN.endAt, (v: any) => v.minimumGapMs = -1, (v: any) => v.minimumGapMs = 32 * 86400000]) {
    const v = fixture(); change(v); assert.throws(() => run(v), /SAMPLE_PARTITION_/);
  }
});
test("original origin identifier and canonical clock rules are preserved", () => {
  for (const change of [(v: any) => v.origin = "VERIFIED_MARKET", (v: any) => v.datasetId = "bad\nvalue", (v: any) => v.protocolId = "", (v: any) => v.windows.TRAIN.startAt = "2026-09-08"]) { const v = fixture(); change(v); assert.throws(() => run(v)); }
  assert.throws(() => run(fixture(), "yesterday"), /CLOCK/);
});
test("blank control-containing and oversized definition text is rejected", () => {
  for (const content of [" ", "bad\u0000text", "bad\u007ftext", "\uD800", "x".repeat(PROTOCOL_DEFINITION_MAX_CHARACTERS + 1)]) assert.throws(() => run({ ...fixture(), featureDefinition: { reference: "test", content } }), /DEFINITION_TEXT/);
  assert.equal(run({ ...fixture(), featureDefinition: { reference: "test", content: "Line one\nLine two\tvalue" } }).declaration.featureDefinition.content, "Line one\nLine two\tvalue");
});
test("unknown authority fields and nested definition fields are rejected", () => {
  assert.throws(() => run({ ...fixture(), executionAllowed: true } as OptionsResearchProtocolDeclaration), /SHAPE/);
  assert.throws(() => run({ ...fixture(), featureDefinition: { ...fixture().featureDefinition, approved: true } } as OptionsResearchProtocolDeclaration), /SHAPE/);
});
test("nested window and symbol getters are rejected without execution", () => {
  let calls = 0; const a = fixture(); Object.defineProperty(a.windows.TRAIN, "startAt", { enumerable: true, get: () => { calls++; return "2026-09-08T13:30:00.000Z"; } }); assert.throws(() => run(a), /SHAPE/);
  const b = fixture(); Object.defineProperty(b.symbols, 0, { enumerable: true, get: () => { calls++; return "GLD"; } }); assert.throws(() => run(b), /SYMBOL_SCOPE/); assert.equal(calls, 0);
});
test("the review is deterministic immutable and grants no registration or sampling authority", () => {
  const v = fixture(), original = JSON.stringify(v), r = run(v); assert.deepEqual(run(v), r); assert.equal(JSON.stringify(v), original); assert.ok(Object.isFrozen(r.declaration.featureDefinition)); assert.ok(!Object.isFrozen(v));
  const { artifactSha256, ...body } = r; assert.equal(artifactSha256, readinessFingerprint(body));
  assert.equal(r.registrationClockBasis, "DECLARED_UNVERIFIED"); assert.equal(r.registrationReceiptVerified, false); assert.equal(r.registered, false); assert.equal(r.featureCompletenessProven, false); assert.equal(r.heldOutAccessSealed, false); assert.equal(r.sampleInputGenerated, false); assert.equal(r.executionAllowed, false); assert.equal(r.winProbability, null);
});
console.log(`${passed}/${passed} tests passed.`);
