import type { OptionsResearchProtocolDeclaration } from "../../contracts/OptionsResearchProtocol";
import { auditOptionsSamplePartitions } from "./OptionsSamplePartitionEngine";
import { readinessClock, readinessFingerprint } from "../options-readiness/OptionsReadinessEngine";
import { freezePaper } from "../options-paper/OptionsPaperTradingEngine";

export const PROTOCOL_DEFINITION_MAX_CHARACTERS = 16_384;
function fail(code: string): never { throw Error("RESEARCH_PROTOCOL_" + code); }
function exact(value: unknown, keys: readonly string[]) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) fail("SHAPE");
  const descriptors = Object.getOwnPropertyDescriptors(value), own = Reflect.ownKeys(value);
  if (own.length !== keys.length || own.some(k => typeof k !== "string" || !keys.includes(k) || !("value" in descriptors[k]!) || !descriptors[k]!.enumerable)) fail("SHAPE");
}
function identifier(value: unknown) {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/.test(value)) fail("IDENTIFIER");
}
function definition(value: OptionsResearchProtocolDeclaration["featureDefinition"]) {
  exact(value, ["reference", "content"]); identifier(value.reference);
  if (typeof value.content !== "string" || !value.content.trim() || value.content.length > PROTOCOL_DEFINITION_MAX_CHARACTERS ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value.content) || /[\uD800-\uDFFF]/u.test(value.content)) fail("DEFINITION_TEXT");
}

/** Declared chronology only. Actual registration requires a separately verified post-write receipt. */
export function assessOptionsResearchProtocol(input: OptionsResearchProtocolDeclaration, declaredRegistrationAt: string) {
  exact(input, ["version", "protocolId", "datasetId", "origin", "strategyVersion", "symbols", "featureDefinition", "outcomeDefinition", "windows", "minimumGapMs"]);
  if (input.version !== "OPTIONS_RESEARCH_PROTOCOL_DECLARATION_V1") fail("VERSION");
  identifier(input.protocolId); identifier(input.strategyVersion); definition(input.featureDefinition); definition(input.outcomeDefinition);
  if (!Array.isArray(input.symbols) || Object.getPrototypeOf(input.symbols) !== Array.prototype || input.symbols.length !== 2 ||
    Reflect.ownKeys(input.symbols).length !== 3 || ["0", "1"].some(k => {
      const descriptor = Object.getOwnPropertyDescriptor(input.symbols, k); return !descriptor || !("value" in descriptor) || !descriptor.enumerable;
    }) || [...input.symbols].sort().join() !== "GLD,IBIT") fail("SYMBOL_SCOPE");
  readinessClock(declaredRegistrationAt);
  // Validate original window descriptors before cloning/hashing can normalize them.
  // This discarded zero-sample validation pass never becomes evidence or a registration.
  const partitionInput = { version: "OPTIONS_SAMPLE_PARTITION_INPUT_V1" as const, datasetId: input.datasetId,
    origin: input.origin, protocol: { reference: input.protocolId, sha256: "0".repeat(64) },
    windows: input.windows, minimumGapMs: input.minimumGapMs, samples: [] };
  auditOptionsSamplePartitions(partitionInput);
  const declaration = { ...structuredClone(input), symbols: ["GLD", "IBIT"] as const };
  const declarationSha256 = readinessFingerprint(declaration);
  // Reuse the existing window/gap validator. Empty partitions intentionally stay blocked.
  const partitionAudit = auditOptionsSamplePartitions({ ...partitionInput, protocol: { reference: declaration.protocolId, sha256: declarationSha256 } });
  const firstWindowStartAt = declaration.windows.TRAIN.startAt;
  const precedesFirstWindow = declaredRegistrationAt < firstWindowStartAt;
  const body = { version: "OPTIONS_RESEARCH_PROTOCOL_ASSESSMENT_V1", declaration, declarationSha256,
    featureDefinitionSha256: readinessFingerprint(declaration.featureDefinition), outcomeDefinitionSha256: readinessFingerprint(declaration.outcomeDefinition),
    declaredRegistrationAt, firstWindowStartAt,
    timing: precedesFirstWindow ? "DECLARED_BEFORE_FIRST_WINDOW" : "DECLARED_AT_OR_AFTER_FIRST_WINDOW",
    timingReasons: precedesFirstWindow ? [] : ["DECLARED_REGISTRATION_NOT_BEFORE_FIRST_WINDOW"],
    registrationClockBasis: "DECLARED_UNVERIFIED", registrationReceiptVerified: false,
    partitionAudit, registered: false, featureCompletenessProven: false, heldOutAccessSealed: false,
    sampleInputGenerated: false, historicalDecisionProven: false, winProbability: null, executionAllowed: false };
  return freezePaper({ ...body, artifactSha256: readinessFingerprint(body) });
}
