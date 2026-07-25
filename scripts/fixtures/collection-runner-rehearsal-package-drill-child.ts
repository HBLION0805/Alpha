import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import process, { cwd } from "node:process";

import {
  CollectionRunnerRehearsalPackageError,
  EventContractCollectionRunnerFixtureRehearsalPackageBuilder,
  type CollectionRunnerRehearsalPackageBuildRequest,
} from "../../src/engines/event-contract-collection-runner-fixture-rehearsal/EventContractCollectionRunnerFixtureRehearsalPackage";

const [mode, root, requestPath] = process.argv.slice(2);
if (
  (
    mode !== "after-artifacts" &&
    mode !== "after-commit" &&
    mode !== "stop-before-package" &&
    mode !== "leakage-before-package"
  ) ||
  root === undefined ||
  requestPath === undefined
) {
  throw new Error("Invalid fixture rehearsal package drill arguments.");
}

const parsed = JSON.parse(
  readFileSync(requestPath, "utf8"),
) as CollectionRunnerRehearsalPackageBuildRequest;
const request = mode === "stop-before-package"
  ? { ...parsed, stopBarrierTripped: true }
  : mode === "leakage-before-package"
    ? {
        ...parsed,
        stepResults: [{
          ...parsed.stepResults[0]!,
          terminalReport: {
            ...parsed.stepResults[0]!.terminalReport,
            secret: "forbidden",
          },
        }],
      } as CollectionRunnerRehearsalPackageBuildRequest
    : parsed;
const target = mode === "after-artifacts"
  ? "ARTIFACTS_DURABLE"
  : "PACKAGE_COMMITTED";

const block = (value: string): never => {
  writeFileSync(join(root, `checkpoint-${mode}`), `${value}\n`, {
    encoding: "utf8",
    flag: "wx",
  });
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0);
  throw new Error("Unreachable process-drill checkpoint.");
};

try {
  new EventContractCollectionRunnerFixtureRehearsalPackageBuilder(
  cwd(),
  [{ packageRootId: request.packageRootId, path: root }],
  { verifyBoundEvidence: () => true },
  undefined,
  {
    reached: (checkpoint) => {
      if (checkpoint === target) {
        block(checkpoint);
      }
    },
  },
  ).build(request);
} catch (error) {
  if (
    (mode === "stop-before-package" || mode === "leakage-before-package") &&
    error instanceof CollectionRunnerRehearsalPackageError
  ) {
    block(error.code);
  }
  throw error;
}
