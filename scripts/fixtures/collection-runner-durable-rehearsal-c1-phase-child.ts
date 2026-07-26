import { writeFileSync } from "node:fs";
import process from "node:process";

import {
  freezeC1Phase,
  packageC1Phase,
  prepareC1Phase,
  stepC1Phase,
  validateC1Phase,
  verifyC1Phase,
} from "./collection-runner-durable-rehearsal-c1-phase-fixture";

const [mode, root, variant, resultPath] = process.argv.slice(2);

function write(value: unknown): void {
  writeFileSync(resultPath!, `${JSON.stringify(value)}\n`, {
    encoding: "utf8",
    flag: "wx",
  });
}

async function main(): Promise<void> {
  switch (mode) {
    case "prepare":
      write(prepareC1Phase(root!, variant === "b" ? "b" : "a"));
      return;
    case "step":
      write(stepC1Phase(root!));
      return;
    case "validate":
      write(validateC1Phase(root!));
      return;
    case "freeze":
      write(freezeC1Phase(root!));
      return;
    case "package":
      write({ envelopeFingerprint: await packageC1Phase(root!) });
      return;
    case "verify":
      write(verifyC1Phase(root!));
      return;
    default:
      throw new Error("Unknown C1 phase.");
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
