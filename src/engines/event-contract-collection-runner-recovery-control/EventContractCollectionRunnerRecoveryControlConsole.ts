import { createHash } from "node:crypto";
import { lstatSync, readFileSync } from "node:fs";
import { basename, resolve } from "node:path";

import type {
  CollectionRunnerRecoveryAssessmentInput,
} from "../../contracts";
import { EventContractCollectionRunnerSqliteStore } from "../../repositories/EventContractCollectionRunnerSqliteStore";
import {
  type CollectionRunnerLocalOwnerVerifierRecord,
  type ExecuteCollectionRunnerOwnerCommand,
  EventContractCollectionRunnerRecoveryControlOperator,
  ScryptCollectionRunnerLocalOwnerVerifier,
} from "./EventContractCollectionRunnerRecoveryControlOperator";
import { EventContractCollectionRunnerRecoveryControlEngine } from "./EventContractCollectionRunnerRecoveryControlEngine";

export const COLLECTION_RUNNER_RECOVERY_CONTROL_USAGE =
  "Usage: collection-runner-recovery-control owner-decision --request=<json> --verifier=<json> --store-dir=<directory> [--store-id=<id>] --build-fingerprint=<fingerprint> --as-of=<UTC>";

export const COLLECTION_RUNNER_RECOVERY_CONTROL_HELP = [
  COLLECTION_RUNNER_RECOVERY_CONTROL_USAGE,
  "",
  "The owner secret must be supplied through standard input. It is never accepted as an argument, file field, environment option, output, or durable record.",
  "The command is local-only and performs no network, provider, scheduler, worker, model, recommendation, broker, order, or trading operation.",
].join("\n");

type AssessmentTemplate = Omit<
  CollectionRunnerRecoveryAssessmentInput,
  | "storeId"
  | "storePathIdentity"
  | "schemaCatalogChecksum"
  | "recoveryReportFingerprint"
  | "inspectedAtUtc"
>;

type OwnerCommandTemplate = Omit<
  ExecuteCollectionRunnerOwnerCommand,
  | "assessmentId"
  | "expectedAssessmentFingerprint"
  | "currentRecoveryReportFingerprint"
  | "currentStorePathIdentity"
  | "currentSchemaCatalogChecksum"
>;

export interface CollectionRunnerOwnerCommandRequest {
  readonly schemaVersion: "1.0";
  readonly assessment: AssessmentTemplate;
  readonly command: OwnerCommandTemplate;
}

export interface CollectionRunnerRecoveryControlConsoleDependencies {
  readonly loadJson: (path: string) => unknown;
  readonly readOwnerSecret: () => string;
  readonly openStore: typeof EventContractCollectionRunnerSqliteStore.open;
}

const DEFAULT_DEPENDENCIES: CollectionRunnerRecoveryControlConsoleDependencies =
  {
    loadJson: (path) => loadLocalControlJson(path),
    readOwnerSecret: () =>
      (
        readFileSync as unknown as (
          descriptor: number,
          encoding: string,
        ) => string
      )(0, "utf8").replace(/\r?\n$/u, ""),
    openStore: EventContractCollectionRunnerSqliteStore.open,
  };

export function loadLocalControlJson(path: string): unknown {
  const target = resolve(path);
  const status = lstatSync(target);
  if (!status.isFile() || status.isSymbolicLink()) {
    throw new Error(
      "Recovery-control input must be an existing regular non-symlink file.",
    );
  }
  return JSON.parse(readFileSync(target, "utf8"));
}

function canonicalSha256(value: string): string {
  return `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`;
}

function parseOptions(args: readonly string[]): Map<string, string> {
  const options = new Map<string, string>();
  for (const argument of args) {
    const match = /^--([a-z][a-z0-9-]*)=(.+)$/u.exec(argument);
    if (match === null) throw new Error("Invalid recovery-control option.");
    const name = match[1];
    const value = match[2];
    if (name === undefined || value === undefined || options.has(name)) {
      throw new Error("Duplicate or invalid recovery-control option.");
    }
    options.set(name, value);
  }
  return options;
}

function required(options: ReadonlyMap<string, string>, name: string): string {
  const value = options.get(name);
  if (value === undefined || value.length === 0) {
    throw new Error(`Missing required --${name} option.`);
  }
  return value;
}

function validateOptionNames(options: ReadonlyMap<string, string>): void {
  const requiredNames = [
    "request",
    "verifier",
    "store-dir",
    "build-fingerprint",
    "as-of",
  ];
  const allowed = new Set([...requiredNames, "store-id"]);
  for (const name of options.keys()) {
    if (!allowed.has(name)) throw new Error(`Unknown option --${name}.`);
  }
  for (const name of requiredNames) required(options, name);
}

function ownerRequest(value: unknown): CollectionRunnerOwnerCommandRequest {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.keys(value).sort().join(",") !==
      "assessment,command,schemaVersion" ||
    (value as { readonly schemaVersion?: unknown }).schemaVersion !== "1.0"
  ) {
    throw new Error("Owner-command request envelope is invalid.");
  }
  return structuredClone(value) as CollectionRunnerOwnerCommandRequest;
}

export function runCollectionRunnerRecoveryControlConsole(
  args: readonly string[],
  dependencies: CollectionRunnerRecoveryControlConsoleDependencies =
    DEFAULT_DEPENDENCIES,
): string {
  if (args.length === 1 && args[0] === "--help") {
    return COLLECTION_RUNNER_RECOVERY_CONTROL_HELP;
  }
  if (args[0] !== "owner-decision") {
    throw new Error(COLLECTION_RUNNER_RECOVERY_CONTROL_USAGE);
  }
  const options = parseOptions(args.slice(1));
  validateOptionNames(options);
  const request = ownerRequest(
    dependencies.loadJson(required(options, "request")),
  );
  const verifierRecord = dependencies.loadJson(
    required(options, "verifier"),
  ) as CollectionRunnerLocalOwnerVerifierRecord;
  const storeId = options.get("store-id");
  const storeOptions = {
    rootDirectory: required(options, "store-dir"),
    applicationBuildFingerprint: required(options, "build-fingerprint"),
    appliedAtUtc: required(options, "as-of"),
    recoveryInspectedAtUtc: required(options, "as-of"),
    ...(storeId === undefined ? {} : { storeId }),
  };
  const store = dependencies.openStore(storeOptions);
  try {
    const recovery = store.getStartupRecoveryReport();
    const readiness = store.getReadiness();
    const storePathIdentity = canonicalSha256(resolve(store.getStorePath()));
    const assessment =
      new EventContractCollectionRunnerRecoveryControlEngine()
        .createRecoveryAssessment({
          ...request.assessment,
          storeId: basename(store.getStorePath(), ".sqlite3"),
          storePathIdentity,
          schemaCatalogChecksum: readiness.schemaCatalogChecksum,
          recoveryReportFingerprint: recovery.fingerprint,
          inspectedAtUtc: recovery.inspectedAtUtc,
        });
    const repository = store.createRecoveryControlRepository();
    repository.persistRecoveryAssessment({
      assessment,
      recordedAtUtc: assessment.assessedAtUtc,
    });
    const operator =
      new EventContractCollectionRunnerRecoveryControlOperator(
        repository,
        new ScryptCollectionRunnerLocalOwnerVerifier(verifierRecord),
      );
    const receipt = operator.executeOwnerCommand(
      {
        ...request.command,
        assessmentId: assessment.assessmentId,
        expectedAssessmentFingerprint: assessment.fingerprint,
        currentRecoveryReportFingerprint: recovery.fingerprint,
        currentStorePathIdentity: storePathIdentity,
        currentSchemaCatalogChecksum: readiness.schemaCatalogChecksum,
      },
      dependencies.readOwnerSecret(),
    );
    return JSON.stringify(receipt, null, 2);
  } finally {
    store.close();
  }
}
