import {
  CollectionRunnerRehearsalOperationPhase,
  CollectionRunnerRehearsalOperationStopMode,
  EVENT_CONTRACT_COLLECTION_RUNNER_REHEARSAL_OPERATION_CONTROL_SCHEMA_VERSION,
  type CollectionRunnerRehearsalOperationPhaseCommandInput,
  type CollectionRunnerRehearsalOperationStopCommandInput,
} from "../../contracts";
import {
  EventContractCollectionRunnerRehearsalOperationPhaseGate,
} from "./EventContractCollectionRunnerRehearsalOperationControlEngine";

export const COLLECTION_RUNNER_REHEARSAL_OPERATION_CONTROL_USAGE = [
  "Usage:",
  "  rehearsal-operation preflight <closed identity options>",
  "  rehearsal-operation status <closed identity options>",
  "  rehearsal-operation phase <closed identity options>",
  "  rehearsal-operation stop <closed Stop options>",
].join("\n");

export const COLLECTION_RUNNER_REHEARSAL_OPERATION_CONTROL_HELP = [
  COLLECTION_RUNNER_REHEARSAL_OPERATION_CONTROL_USAGE,
  "",
  "The Owner secret is read from standard input only for phase and stop.",
  "No path, URL, executable, environment override, payload, retry, schedule,",
  "provider, probability, recommendation, order, or capital option is accepted.",
  "Every phase invocation performs one closed foreground phase and exits.",
].join("\n");

export interface CollectionRunnerRehearsalOperationConsoleDependencies {
  readonly gate: EventContractCollectionRunnerRehearsalOperationPhaseGate;
  readonly readOwnerSecret: () => string;
  readonly bootIdentity: () => string;
  readonly mintProcessSessionId: () => string;
  readonly invokedAtUtc: () => string;
}

function parseOptions(args: readonly string[]): ReadonlyMap<string, string> {
  const options = new Map<string, string>();
  for (const argument of args) {
    const match = /^--([a-z][a-z0-9-]*)=(.+)$/u.exec(argument);
    if (match === null || match[1] === undefined || match[2] === undefined) {
      throw new Error("Invalid rehearsal-operation option.");
    }
    if (options.has(match[1])) {
      throw new Error("Duplicate rehearsal-operation option.");
    }
    options.set(match[1], match[2]);
  }
  return options;
}

function required(options: ReadonlyMap<string, string>, key: string): string {
  const value = options.get(key);
  if (value === undefined || value.length === 0) {
    throw new Error(`Missing required --${key} option.`);
  }
  return value;
}

const COMMON = [
  "operation-id", "manifest-fingerprint", "alpha-commit",
  "root-registry-fingerprint", "command-id", "created-at", "expires-at",
  "nonce",
] as const;
const PHASE = [
  ...COMMON, "phase", "expected-lifecycle-version", "expected-ordinal",
  "expected-recovery-fingerprint",
] as const;
const STOP = [...COMMON, "mode", "reason-code"] as const;

function exactOptions(
  options: ReadonlyMap<string, string>,
  names: readonly string[],
): void {
  if (
    options.size !== names.length ||
    names.some((name) => !options.has(name)) ||
    [...options.keys()].some((name) => !names.includes(name))
  ) {
    throw new Error("Rehearsal-operation options do not match the closed command.");
  }
}

function phaseCommand(
  options: ReadonlyMap<string, string>,
  dependencies: CollectionRunnerRehearsalOperationConsoleDependencies,
): CollectionRunnerRehearsalOperationPhaseCommandInput {
  exactOptions(options, PHASE);
  const ordinal = required(options, "expected-ordinal");
  const lifecycleVersion = Number(required(options, "expected-lifecycle-version"));
  return {
    schemaVersion:
      EVENT_CONTRACT_COLLECTION_RUNNER_REHEARSAL_OPERATION_CONTROL_SCHEMA_VERSION,
    commandId: required(options, "command-id"),
    operationId: required(options, "operation-id"),
    manifestFingerprint: required(options, "manifest-fingerprint"),
    phase: required(options, "phase") as CollectionRunnerRehearsalOperationPhase,
    expectedLifecycleVersion: lifecycleVersion,
    expectedInvocationOrdinal: ordinal === "null" ? null : Number(ordinal),
    expectedRecoveryFingerprint: required(
      options,
      "expected-recovery-fingerprint",
    ),
    alphaCommit: required(options, "alpha-commit"),
    rootRegistryFingerprint: required(options, "root-registry-fingerprint"),
    bootIdentity: dependencies.bootIdentity(),
    processSessionId: dependencies.mintProcessSessionId(),
    createdAtUtc: required(options, "created-at"),
    expiresAtUtc: required(options, "expires-at"),
    challengeNonce: required(options, "nonce"),
  };
}

function stopCommand(
  options: ReadonlyMap<string, string>,
): CollectionRunnerRehearsalOperationStopCommandInput {
  exactOptions(options, STOP);
  return {
    schemaVersion:
      EVENT_CONTRACT_COLLECTION_RUNNER_REHEARSAL_OPERATION_CONTROL_SCHEMA_VERSION,
    commandId: required(options, "command-id"),
    operationId: required(options, "operation-id"),
    manifestFingerprint: required(options, "manifest-fingerprint"),
    alphaCommit: required(options, "alpha-commit"),
    rootRegistryFingerprint: required(options, "root-registry-fingerprint"),
    mode: required(options, "mode") as CollectionRunnerRehearsalOperationStopMode,
    reasonCode: required(options, "reason-code"),
    createdAtUtc: required(options, "created-at"),
    expiresAtUtc: required(options, "expires-at"),
    challengeNonce: required(options, "nonce"),
  };
}

export function runCollectionRunnerRehearsalOperationControlConsole(
  args: readonly string[],
  dependencies: CollectionRunnerRehearsalOperationConsoleDependencies,
): string {
  if (args.length === 0 || (args.length === 1 && args[0] === "--help")) {
    return COLLECTION_RUNNER_REHEARSAL_OPERATION_CONTROL_HELP;
  }
  const action = args[0];
  if (!["preflight", "status", "phase", "stop"].includes(action ?? "")) {
    throw new Error(COLLECTION_RUNNER_REHEARSAL_OPERATION_CONTROL_USAGE);
  }
  const options = parseOptions(args.slice(1));
  const invokedAtUtc = dependencies.invokedAtUtc();
  if (action === "stop") {
    const receipt = dependencies.gate.requestStop(
      stopCommand(options),
      dependencies.readOwnerSecret(),
      invokedAtUtc,
    );
    return JSON.stringify(receipt, null, 2);
  }
  const command = phaseCommand(options, dependencies);
  if (action === "preflight") {
    return JSON.stringify(dependencies.gate.preflight(command), null, 2);
  }
  if (action === "status") {
    return JSON.stringify(dependencies.gate.status(command), null, 2);
  }
  return JSON.stringify(
    dependencies.gate.executeOne(
      command,
      dependencies.readOwnerSecret(),
      invokedAtUtc,
    ),
    null,
    2,
  );
}
