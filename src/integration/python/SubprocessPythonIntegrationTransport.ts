import { spawnSync } from "node:child_process";
import type { PythonIntegrationRequest, PythonIntegrationTransport } from "../../contracts";
import { AlphaIntegrationError } from "./AlphaIntegrationError";

const PYTHON_MODULE = "app.integration.entrypoint";
const DEFAULT_TIMEOUT_MS = 5_000;
const DEFAULT_MAXIMUM_OUTPUT_BYTES = 1_048_576;

export interface SubprocessPythonIntegrationOptions {
  readonly projectRoot: string;
  readonly pythonExecutable?: string;
  readonly timeoutMs?: number;
  readonly maximumOutputBytes?: number;
}

function nonEmpty(value: string | undefined, name: string): string {
  if (value === undefined || value.trim().length === 0) {
    throw AlphaIntegrationError.validation(`${name} must be a non-empty string.`);
  }
  return value;
}

function positiveInteger(value: number | undefined, fallback: number, name: string): number {
  const selected = value ?? fallback;
  if (!Number.isSafeInteger(selected) || selected <= 0) {
    throw AlphaIntegrationError.validation(`${name} must be a positive safe integer.`);
  }
  return selected;
}

export class SubprocessPythonIntegrationTransport
  implements PythonIntegrationTransport {
  private readonly projectRoot: string;
  private readonly pythonExecutable: string;
  private readonly timeoutMs: number;
  private readonly maximumOutputBytes: number;

  constructor(options: Readonly<SubprocessPythonIntegrationOptions>) {
    this.projectRoot = nonEmpty(options.projectRoot, "projectRoot");
    this.pythonExecutable = nonEmpty(options.pythonExecutable ?? "python", "pythonExecutable");
    this.timeoutMs = positiveInteger(options.timeoutMs, DEFAULT_TIMEOUT_MS, "timeoutMs");
    this.maximumOutputBytes = positiveInteger(
      options.maximumOutputBytes,
      DEFAULT_MAXIMUM_OUTPUT_BYTES,
      "maximumOutputBytes",
    );
  }

  send(request: Readonly<PythonIntegrationRequest>): unknown {
    const result = spawnSync(
      this.pythonExecutable,
      ["-m", PYTHON_MODULE],
      {
        cwd: this.projectRoot,
        input: JSON.stringify(request),
        encoding: "utf8",
        shell: false,
        timeout: this.timeoutMs,
        maxBuffer: this.maximumOutputBytes,
        windowsHide: true,
        killSignal: "SIGTERM",
      },
    );

    if (result.error !== undefined) {
      const code = result.error.code;
      if (code === "ETIMEDOUT") {
        throw AlphaIntegrationError.timeout("The Python integration request timed out.");
      }
      if (code === "ENOBUFS") {
        throw AlphaIntegrationError.protocol("The Python integration response exceeded the output limit.");
      }
      throw AlphaIntegrationError.transport("The Python integration process could not be started.");
    }
    if (result.status !== 0) {
      throw AlphaIntegrationError.transport("The Python integration process exited unsuccessfully.");
    }

    const output = result.stdout.trim();
    if (output.length === 0) {
      throw AlphaIntegrationError.protocol("The Python integration process returned no response.");
    }
    try {
      return JSON.parse(output) as unknown;
    } catch {
      throw AlphaIntegrationError.protocol("The Python integration process returned invalid JSON.");
    }
  }
}
