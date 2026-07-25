import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  DURABLE_FIXTURE_REHEARSAL_EVIDENCE_NON_AUTHORITY,
  DURABLE_FIXTURE_REHEARSAL_VALIDATION_POLICY,
  DurableFixtureRehearsalEvidenceDisposition,
} from "../../contracts";
import {
  DurableFixtureRehearsalFreshProcessVerifier,
  createDurableFixtureRehearsalBackupManifest,
  createDurableFixtureRehearsalEnvelopeManifest,
  createDurableFixtureRehearsalValidationReceipt,
} from "./EventContractCollectionRunnerDurableFixtureRehearsalEvidence";

const FP1 = `sha256:${"1".repeat(64)}`;
const FP2 = `sha256:${"2".repeat(64)}`;
const FP3 = `sha256:${"3".repeat(64)}`;
const NOW = "2026-07-25T12:00:00.000Z";

function equal(actual: unknown, expected: unknown, label: string): void {
  if (actual !== expected) throw new Error(`${label}: expected ${String(expected)}, got ${String(actual)}`);
}

function truthy(value: unknown, label: string): void {
  if (!value) throw new Error(`${label}: expected truthy`);
}

function throws(run: () => unknown): void {
  let threw = false;
  try { run(); } catch { threw = true; }
  if (!threw) throw new Error("expected throw");
}

const validationInput = {
  receiptId: "validation-1",
  rehearsalId: "rehearsal-1",
  manifestFingerprint: FP1,
  repositoryCommit: "a".repeat(40),
  validationPolicyVersion: DURABLE_FIXTURE_REHEARSAL_VALIDATION_POLICY,
  validationSuiteFingerprint: FP2,
  registeredTestTotal: 2335,
  exitStatus: 0,
  startedAtUtc: NOW,
  endedAtUtc: NOW,
  sanitizedOutputDigest: FP3,
} as const;

const tests: readonly [string, () => void][] = [
  ["validation receipt is deterministic and passing", () => {
    const first = createDurableFixtureRehearsalValidationReceipt(validationInput);
    const second = createDurableFixtureRehearsalValidationReceipt(validationInput);
    equal(first.fingerprint, second.fingerprint, "fingerprint");
    equal(first.passed, true, "passed");
    truthy(Object.isFrozen(first), "frozen");
  }],
  ["nonzero validation is a deterministic failed receipt", () => {
    const value = createDurableFixtureRehearsalValidationReceipt({
      ...validationInput, exitStatus: 1,
    });
    equal(value.passed, false, "passed");
  }],
  ["validation receipt rejects unknown fields", () =>
    throws(() => createDurableFixtureRehearsalValidationReceipt({
      ...validationInput, command: "unsafe",
    } as never))],
  ["backup manifest binds backup bytes and terminal freeze", () => {
    const value = createDurableFixtureRehearsalBackupManifest({
      backupId: "backup-1",
      rehearsalId: "rehearsal-1",
      manifestFingerprint: FP1,
      storeIdentity: FP2,
      schemaProfile: "FIXTURE_REHEARSAL_V3",
      migrationNames: [
        "001_collection_runner_core",
        "002_collection_runner_recovery_control",
        "003_fixture_rehearsal_durability",
      ],
      schemaCatalogChecksum: FP3,
      terminalFreezeFingerprint: FP2,
      sourceFileIdentity: FP1,
      backupFileIdentity: FP2,
      pageCount: 10,
      backupBytes: 4096,
      backupDigest: FP3,
      createdAtUtc: NOW,
      retentionPolicyVersion: "1.0",
      nonAuthorityDeclaration: DURABLE_FIXTURE_REHEARSAL_EVIDENCE_NON_AUTHORITY,
    });
    truthy(value.fingerprint.startsWith("sha256:"), "fingerprint");
  }],
  ["envelope manifest is deterministic", () => {
    const input = {
      envelopeId: "envelope-1",
      rehearsalId: "rehearsal-1",
      manifestFingerprint: FP1,
      evidencePlanFingerprint: FP2,
      backupManifestFingerprint: FP3,
      validationReceiptFingerprint: FP1,
      snapshotFingerprint: FP2,
      backupBytes: 4096,
      backupDigest: FP3,
      packageBytesExcludingBackup: 200,
      packageInventory: [{ relativePath: "package/snapshot.json", byteLength: 200, digest: FP1 }],
      publishedAtUtc: NOW,
      nonAuthorityDeclaration: DURABLE_FIXTURE_REHEARSAL_EVIDENCE_NON_AUTHORITY,
    } as const;
    equal(
      createDurableFixtureRehearsalEnvelopeManifest(input).fingerprint,
      createDurableFixtureRehearsalEnvelopeManifest(input).fingerprint,
      "fingerprint",
    );
  }],
  ["fresh verifier returns incomplete for missing envelope", () => {
    const root = mkdtempSync(join(tmpdir(), "alpha-evidence-"));
    try {
      const result = new DurableFixtureRehearsalFreshProcessVerifier([
        { evidenceRootId: "root-1", path: root },
      ]).verify("root-1", FP1, FP2);
      equal(result.disposition, DurableFixtureRehearsalEvidenceDisposition.Incomplete, "disposition");
      truthy(result.issueCodes.includes("ENVELOPE_MISSING"), "issue");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }],
  ["fresh verifier rejects caller-selected root identity", () => {
    const root = mkdtempSync(join(tmpdir(), "alpha-evidence-"));
    try {
      const result = new DurableFixtureRehearsalFreshProcessVerifier([
        { evidenceRootId: "root-1", path: root },
      ]).verify("unknown", FP1, FP2);
      equal(result.disposition, DurableFixtureRehearsalEvidenceDisposition.FailClosed, "disposition");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }],
];

let passed = 0;
for (const [name, run] of tests) {
  try {
    run();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}
console.log(`\nDurable Fixture Rehearsal Evidence tests passed: ${passed}/${tests.length}.`);
