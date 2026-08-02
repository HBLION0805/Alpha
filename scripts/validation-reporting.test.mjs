import { extractValidationCounts, ValidationReporter, ValidationStatus } from "./validation-reporting.mjs";

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, received ${String(actual)}.`);
  }
}

function assertDeepEqual(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}: values differ.`);
  }
}

const tests = [
  {
    name: "extracts standard TypeScript pass counts",
    run: () => assertDeepEqual(
      extractValidationCounts("Router: 21/21 tests passed.", true),
      { testsExecuted: 21, passed: 21, failed: 0 },
      "TypeScript counts",
    ),
  },
  {
    name: "extracts alternate existing pass-count format",
    run: () => assertDeepEqual(
      extractValidationCounts("AI Reservation Manager tests passed: 46/46", true),
      { testsExecuted: 46, passed: 46, failed: 0 },
      "alternate counts",
    ),
  },
  {
    name: "counts the D3A qualification component in the unified report",
    run: () => assertDeepEqual(
      extractValidationCounts(
        "Alpaca Bars limit qualification: 20/20 tests passed.",
        true,
      ),
      { testsExecuted: 20, passed: 20, failed: 0 },
      "D3A qualification counts",
    ),
  },
  {
    name: "extracts process-drill pass counts",
    run: () => assertDeepEqual(
      extractValidationCounts(
        "Durable Fixture Rehearsal process drills passed: 14/14.",
        true,
      ),
      { testsExecuted: 14, passed: 14, failed: 0 },
      "process drill counts",
    ),
  },
  {
    name: "extracts Python unittest counts",
    run: () => assertDeepEqual(
      extractValidationCounts("Ran 11 tests in 0.001s\n\nOK", true),
      { testsExecuted: 11, passed: 11, failed: 0 },
      "Python counts",
    ),
  },
  {
    name: "fails closed when a failed command has no counts",
    run: () => assertDeepEqual(
      extractValidationCounts("process failed", false),
      { testsExecuted: 1, passed: 0, failed: 1 },
      "fallback failure",
    ),
  },
  {
    name: "produces one normalized overall report",
    run: () => {
      const reporter = new ValidationReporter();
      reporter.recordCommand({
        component: "Prediction Engine",
        command: "node prediction.test.ts",
        exitCode: 0,
        durationMs: 12,
        output: "Prediction Engine: 27/27 tests passed.",
      });
      reporter.recordCheck({ component: "Markdown validation", passed: true });
      reporter.addWarning("Working tree has changes.");
      const report = reporter.build();
      assertEqual(report.overall.status, ValidationStatus.Passed, "overall status");
      assertEqual(report.overall.testsExecuted, 27, "test total");
      assertEqual(report.overall.componentCount, 2, "component count");
      assertEqual(report.overall.warnings.length, 1, "warning count");
    },
  },
];

let passed = 0;
for (const test of tests) {
  test.run();
  passed += 1;
  console.log(`PASS ${test.name}`);
}
console.log(`Validation Reporting tests: ${String(passed)}/${String(tests.length)} passed.`);
