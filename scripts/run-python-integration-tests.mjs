import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

const root = resolve(process.cwd());
const dependencyRoot = resolve(dirname(process.execPath), "..", "..");
const candidates = [
  process.env.ALPHA_PYTHON_EXECUTABLE,
  resolve(dependencyRoot, "python", "python.exe"),
  resolve(dependencyRoot, "python", "bin", "python"),
  "python",
  "python3"
].filter((value) => typeof value === "string" && value.length > 0);

const python = candidates.find((candidate) =>
  candidate === "python" || candidate === "python3" || existsSync(candidate)
);

if (python === undefined) {
  console.error("No Python executable is available for the integration tests.");
  process.exit(1);
}

const result = spawnSync(
  python,
  ["-m", "unittest", "discover", "-s", "tests", "-p", "test_python_integration.py", "-v"],
  { cwd: root, shell: false, stdio: "inherit", windowsHide: true }
);

if (result.error !== undefined) {
  console.error("Unable to start the Python integration test process.");
  process.exit(1);
}
process.exit(result.status ?? 1);
