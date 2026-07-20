export const ValidationStatus = Object.freeze({
  Passed: "PASSED",
  Failed: "FAILED",
  Warning: "WARNING",
});

function nonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

export function extractValidationCounts(output, succeeded) {
  const text = typeof output === "string" ? output : "";
  const fractionMatches = [
    ...text.matchAll(/(\d+)\s*\/\s*(\d+)\s*(?:tests?\s*)?passed/giu),
    ...text.matchAll(/tests?\s+passed:\s*(\d+)\s*\/\s*(\d+)/giu),
  ];
  const fraction = fractionMatches.at(-1);
  if (fraction !== undefined) {
    const passed = Number(fraction[1]);
    const executed = Number(fraction[2]);
    if (nonNegativeInteger(passed) && nonNegativeInteger(executed) && passed <= executed) {
      return { testsExecuted: executed, passed, failed: executed - passed };
    }
  }

  const unittest = /Ran\s+(\d+)\s+tests?/iu.exec(text);
  if (unittest !== null) {
    const executed = Number(unittest[1]);
    if (nonNegativeInteger(executed)) {
      return succeeded
        ? { testsExecuted: executed, passed: executed, failed: 0 }
        : { testsExecuted: executed, passed: 0, failed: executed };
    }
  }

  return succeeded
    ? { testsExecuted: 0, passed: 0, failed: 0 }
    : { testsExecuted: 1, passed: 0, failed: 1 };
}

function outputWarnings(output) {
  return String(output)
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => /^warning:/iu.test(line) || /^\[warn(?:ing)?\]/iu.test(line));
}

export class ValidationReporter {
  #components = [];
  #warnings = [];

  recordCommand({ component, command, exitCode, durationMs, output = "" }) {
    const succeeded = exitCode === 0;
    const counts = extractValidationCounts(output, succeeded);
    this.#components.push({
      component,
      status: succeeded ? ValidationStatus.Passed : ValidationStatus.Failed,
      testsExecuted: counts.testsExecuted,
      passed: counts.passed,
      failed: counts.failed,
      durationMs: nonNegativeInteger(durationMs),
      warnings: outputWarnings(output),
      command,
    });
  }

  recordCheck({ component, passed, durationMs = 0, warnings = [] }) {
    this.#components.push({
      component,
      status: passed ? ValidationStatus.Passed : ValidationStatus.Failed,
      testsExecuted: 0,
      passed: 0,
      failed: passed ? 0 : 1,
      durationMs: nonNegativeInteger(durationMs),
      warnings: [...warnings],
    });
  }

  addWarning(warning) {
    if (typeof warning === "string" && warning.trim().length > 0) {
      this.#warnings.push(warning);
    }
  }

  build() {
    const totals = this.#components.reduce(
      (summary, component) => ({
        testsExecuted: summary.testsExecuted + component.testsExecuted,
        passed: summary.passed + component.passed,
        failed: summary.failed + component.failed,
        durationMs: summary.durationMs + component.durationMs,
      }),
      { testsExecuted: 0, passed: 0, failed: 0, durationMs: 0 },
    );
    const warnings = [
      ...this.#warnings,
      ...this.#components.flatMap((component) => component.warnings),
    ];
    return {
      overall: {
        status: totals.failed === 0 ? ValidationStatus.Passed : ValidationStatus.Failed,
        componentCount: this.#components.length,
        ...totals,
        warnings,
      },
      components: this.#components,
    };
  }
}
