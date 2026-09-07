import { appendFileSync, closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, realpathSync, unlinkSync } from "node:fs";
import { resolve, sep } from "node:path";
import type { OptionsPaperScenario } from "../contracts/OptionsPaperTrading";
import { appendOptionsPaperScenario, paperFingerprint, replayOptionsPaperAccount } from "../engines/options-paper/OptionsPaperTradingEngine";

const MAX_BYTES = 16 * 1024 * 1024;
type Report = ReturnType<typeof replayOptionsPaperAccount>;
function within(root: string, candidate: string) {
  if (candidate !== root && !candidate.startsWith(root + sep)) throw new Error("PAPER_STORE_PATH_ESCAPE");
}
export interface OptionsPaperRepository {
  readReport(): Report;
  readScenario(scenarioId: string): OptionsPaperScenario | undefined;
  append(input: unknown): { readonly changed: boolean; readonly report: Report };
  readonly directory: string;
}

/** One bounded single-writer local simulation journal. Every stored result is replay-checked. */
export function withOptionsPaperRepository<T>(workspace: string, operation: (repository: OptionsPaperRepository) => T): T {
  const root = realpathSync(workspace);
  let directory = root;
  for (const part of ["data", "runtime", "options-paper"]) {
    directory = resolve(directory, part); within(root, directory);
    if (existsSync(directory)) {
      if (lstatSync(directory).isSymbolicLink() || !lstatSync(directory).isDirectory()) throw new Error("UNSAFE_PAPER_DIRECTORY");
    } else mkdirSync(directory);
    within(root, realpathSync(directory));
  }
  const path = resolve(directory, "sessions.ndjson"), lock = resolve(directory, "writer.lock");
  const lockFd = openSync(lock, "wx");
  let active = true, uncertainWrite = false;
  const requireActive = () => {
    if (!active) throw new Error("PAPER_REPOSITORY_SCOPE_CLOSED");
    if (uncertainWrite) throw new Error("PAPER_WRITE_UNCERTAIN_REOPEN_REQUIRED");
  };
  try {
    let source = "";
    if (existsSync(path)) {
      const stat = lstatSync(path);
      if (stat.isSymbolicLink() || !stat.isFile() || stat.size > MAX_BYTES) throw new Error("UNSAFE_OR_OVERSIZED_PAPER_JOURNAL");
      source = readFileSync(path, "utf8");
      if (source && !source.endsWith("\n")) throw new Error("TRUNCATED_PAPER_JOURNAL_REQUIRES_REVIEW");
    }
    let scenarios: readonly OptionsPaperScenario[] = [], previousFingerprint: string | null = null, sequence = 0;
    let report = replayOptionsPaperAccount([]);
    for (const line of source ? source.trimEnd().split("\n") : []) {
      const batch = JSON.parse(line);
      if (!batch || typeof batch !== "object" || Array.isArray(batch)) throw new Error("INVALID_PAPER_BATCH");
      const { fingerprint, ...body } = batch;
      if (Object.keys(body).length !== 6 || body.schemaVersion !== "1.0" || body.sequence !== sequence + 1
        || body.previousFingerprint !== previousFingerprint || fingerprint !== paperFingerprint(body)) throw new Error("PAPER_BATCH_INTEGRITY_FAILURE");
      const update = appendOptionsPaperScenario(scenarios, body.scenario);
      if (!update.changed) throw new Error("REDUNDANT_PAPER_BATCH");
      const recomputed = replayOptionsPaperAccount(update.scenarios);
      if (body.resultFingerprint !== paperFingerprint(recomputed) || paperFingerprint(body.result) !== body.resultFingerprint) throw new Error("PAPER_REPLAY_MISMATCH_REQUIRES_REVIEW");
      scenarios = update.scenarios; report = recomputed; previousFingerprint = fingerprint; sequence++;
      if (sequence > 2000) throw new Error("PAPER_JOURNAL_BATCH_LIMIT");
    }
    const repository: OptionsPaperRepository = {
      directory,
      readReport: () => { requireActive(); return report; },
      readScenario: (scenarioId) => { requireActive(); return scenarios.find((scenario) => scenario.scenarioId === scenarioId); },
      append: (input) => {
        requireActive();
        const update = appendOptionsPaperScenario(scenarios, input);
        if (!update.changed) return { changed: false, report };
        if (sequence >= 2000) throw new Error("PAPER_JOURNAL_BATCH_LIMIT");
        const nextReport = replayOptionsPaperAccount(update.scenarios);
        const scenario = update.scenarios.at(-1)!;
        const body = { schemaVersion: "1.0", sequence: sequence + 1, previousFingerprint,
          scenario, resultFingerprint: paperFingerprint(nextReport), result: nextReport };
        const fingerprint = paperFingerprint(body);
        const data = JSON.stringify({ ...body, fingerprint }) + "\n";
        if ((existsSync(path) ? lstatSync(path).size : 0) + new TextEncoder().encode(data).byteLength > MAX_BYTES) throw new Error("PAPER_JOURNAL_ROTATION_REQUIRED");
        uncertainWrite = true;
        appendFileSync(path, data, { encoding: "utf8" });
        const fd = openSync(path, "r+"); try { fsyncSync(fd); } finally { closeSync(fd); }
        scenarios = update.scenarios; report = nextReport; previousFingerprint = fingerprint; sequence++;
        uncertainWrite = false;
        return { changed: true, report };
      },
    };
    const result = operation(repository);
    if (result && (typeof result === "object" || typeof result === "function") && "then" in result) throw new Error("PAPER_REPOSITORY_REQUIRES_SYNCHRONOUS_CALLBACK");
    return result;
  } finally { active = false; closeSync(lockFd); unlinkSync(lock); }
}
