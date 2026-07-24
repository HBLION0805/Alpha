import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  FORWARD_SHADOW_COLLECTION_CONTROL_SCHEMA_VERSION,
  type EventContractShadowHistory,
  type FrozenForwardShadowCollectionPlan,
} from "../../contracts";
import {
  ForwardShadowCollectionControlEngine,
  ForwardShadowCollectionControlValidationError,
} from "./ForwardShadowCollectionControlEngine";
import {
  FORWARD_SHADOW_COLLECTION_HELP,
  loadExistingShadowHistories,
  runForwardShadowCollectionConsole,
  saveFrozenPlanExclusive,
  type ForwardShadowCollectionConsoleDependencies,
} from "./ForwardShadowCollectionControlConsole";

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) throw new Error(`${label}: expected ${String(expected)}, received ${String(actual)}.`);
}
function assertTrue(value: boolean, label: string): void {
  if (!value) throw new Error(`${label}: expected true.`);
}
function expectError(run: () => unknown, fragment?: string): void {
  try { run(); }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (fragment !== undefined && !message.includes(fragment)) throw new Error(`Expected error containing ${fragment}, received ${message}.`);
    return;
  }
  throw new Error("Expected error.");
}

function request() {
  return {
    schemaVersion: FORWARD_SHADOW_COLLECTION_CONTROL_SCHEMA_VERSION,
    planId: "collection-plan:btc-15m:operator:001",
    planVersion: "1.0",
    createdAt: "2026-07-24T12:00:00.000Z",
    firstCutoffAt: "2026-07-24T12:15:00.000Z",
    eventCount: 1,
  } as const;
}

function artifact(): FrozenForwardShadowCollectionPlan {
  return new ForwardShadowCollectionControlEngine().createPlan(request());
}

function dependencies(overrides: Partial<ForwardShadowCollectionConsoleDependencies> = {}): ForwardShadowCollectionConsoleDependencies {
  return {
    loadJson: () => request(),
    savePlanExclusive: () => {},
    loadHistories: () => [],
    ...overrides,
  };
}

const tests: ReadonlyArray<readonly [string, () => void]> = [
  ["help is explicit and local-only", () => {
    const output = runForwardShadowCollectionConsole(["--help"]);
    assertEqual(output, FORWARD_SHADOW_COLLECTION_HELP, "help");
    assertTrue(output.includes("no network access"), "network boundary");
  }],
  ["freeze-plan creates and saves one verified artifact", () => {
    let saved: FrozenForwardShadowCollectionPlan | undefined;
    const output = runForwardShadowCollectionConsole(
      ["freeze-plan", "--input=request.json", "--output=plan.json"],
      dependencies({ savePlanExclusive: (_path, plan) => { saved = plan; } }),
    );
    assertEqual(saved?.collectionPlan.plannedEvents.length, 1, "saved events");
    assertEqual(JSON.parse(output).fingerprint, saved?.fingerprint, "output fingerprint");
  }],
  ["progress verifies artifact and audits injected histories", () => {
    const frozen = artifact();
    const deps = dependencies({
      loadJson: () => frozen,
      loadHistories: () => [] as readonly EventContractShadowHistory[],
    });
    const output = JSON.parse(runForwardShadowCollectionConsole([
      "progress",
      "--plan=plan.json",
      "--store-dir=ledger",
      "--as-of=2026-07-24T12:05:00.000Z",
      "--audit-id=progress:001",
    ], deps));
    assertEqual(output.metrics.plannedCount, 1, "planned count");
    assertEqual(output.events[0].status, "UPCOMING", "event status");
  }],
  ["tampered frozen artifact is rejected before ledger read", () => {
    const frozen = structuredClone(artifact()) as unknown as Record<string, unknown>;
    (frozen["collectionPlan"] as Record<string, unknown>)["frozenAt"] = "2026-07-24T11:59:00.000Z";
    let ledgerReads = 0;
    expectError(() => runForwardShadowCollectionConsole([
      "progress",
      "--plan=plan.json",
      "--store-dir=ledger",
      "--as-of=2026-07-24T12:05:00.000Z",
      "--audit-id=progress:001",
    ], dependencies({ loadJson: () => frozen, loadHistories: () => { ledgerReads += 1; return []; } })));
    assertEqual(ledgerReads, 0, "ledger reads");
  }],
  ["unknown duplicate and missing options fail closed", () => {
    expectError(() => runForwardShadowCollectionConsole(["freeze-plan", "--input=a", "--output=b", "--model=x"], dependencies()), "Unknown option");
    expectError(() => runForwardShadowCollectionConsole(["freeze-plan", "--input=a", "--input=b", "--output=c"], dependencies()), "Duplicate");
    expectError(() => runForwardShadowCollectionConsole(["freeze-plan", "--input=a"], dependencies()), "Missing required");
  }],
  ["exclusive writer creates one durable plan and refuses overwrite", () => {
    const directory = mkdtempSync(join(tmpdir(), "alpha-forward-plan-"));
    const path = join(directory, "plan.json");
    try {
      saveFrozenPlanExclusive(path, artifact());
      assertTrue(readFileSync(path, "utf8").endsWith("\n"), "newline");
      expectError(() => saveFrozenPlanExclusive(path, artifact()), "already exists");
    } finally { rmSync(directory, { recursive: true, force: true }); }
  }],
  ["missing ledger remains read-only and is not created", () => {
    const directory = join(tmpdir(), `alpha-missing-ledger-${String(Date.now())}`);
    assertEqual(existsSync(directory), false, "precondition");
    expectError(() => loadExistingShadowHistories(directory, "event-contract-shadow-v1"), "Existing shadow-ledger");
    assertEqual(existsSync(directory), false, "directory not created");
  }],
  ["invalid store identity is rejected", () => {
    expectError(() => loadExistingShadowHistories(tmpdir(), "../escape"), "Invalid shadow-ledger store ID");
  }],
  ["corrupt existing ledger fails closed", () => {
    const directory = mkdtempSync(join(tmpdir(), "alpha-corrupt-ledger-"));
    try {
      writeFileSync(join(directory, "event-contract-shadow-v1.ndjson"), "{\"bad\":true}\n");
      expectError(() => loadExistingShadowHistories(directory, "event-contract-shadow-v1"), "REPOSITORY_CORRUPT");
    } finally { rmSync(directory, { recursive: true, force: true }); }
  }],
  ["artifact validator returns a deeply immutable verified copy", () => {
    const verified = new ForwardShadowCollectionControlEngine().verifyPlanArtifact(structuredClone(artifact()));
    assertTrue(Object.isFrozen(verified) && Object.isFrozen(verified.collectionPlan.plannedEvents), "immutable");
    try {
      new ForwardShadowCollectionControlEngine().verifyPlanArtifact({ ...verified, probability: 0.9 });
    } catch (error) {
      assertTrue(error instanceof ForwardShadowCollectionControlValidationError, "typed artifact error");
      return;
    }
    throw new Error("Expected artifact validation error.");
  }],
];

for (const [name, run] of tests) run();
console.log(`Forward Shadow Collection Control Console tests passed: ${tests.length}/${tests.length}.`);
