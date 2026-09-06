import { appendFileSync, closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, realpathSync, unlinkSync } from "node:fs";
import { resolve, sep } from "node:path";
import type { OptionsMarketEvidence } from "../engines/options-market-evidence/OptionsMarketEvidenceEngine";
import { marketEvidenceFingerprint } from "../engines/options-market-evidence/OptionsMarketEvidenceEngine";
import { buildHistoricalReplayReport, createHistoricalReplayRun } from "../engines/options-historical-replay/OptionsHistoricalReplayReview";
import type { HistoricalReplayRun } from "../engines/options-historical-replay/OptionsHistoricalReplayReview";

const MAX_BYTES = 16 * 1024 * 1024;
const MAX_BATCHES = 1000;
type Report = ReturnType<typeof buildHistoricalReplayReport>;
function within(root: string, candidate: string) {
  if (candidate !== root && !candidate.startsWith(root + sep)) throw new Error("HISTORICAL_STORE_PATH_ESCAPE");
}
function identity(run: HistoricalReplayRun) { return marketEvidenceFingerprint({ config: run.config, evidence: run.evidence }); }
export interface OptionsHistoricalReplayRepository {
  readReport(): Report;
  readRun(runId: string): HistoricalReplayRun | undefined;
  append(config: unknown, evidence: OptionsMarketEvidence | null, recordedAt: string): { readonly changed: boolean; readonly report: Report };
  readonly directory: string;
}

/** Independent research trials; no brokerage ledger or shared capital compounding. */
export function withOptionsHistoricalReplayRepository<T>(workspace: string, operation: (repository: OptionsHistoricalReplayRepository) => T): T {
  const root = realpathSync(workspace);
  let directory = root;
  for (const part of ["data", "runtime", "options-historical-replay"]) {
    directory = resolve(directory, part); within(root, directory);
    if (existsSync(directory)) {
      const stat = lstatSync(directory);
      if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error("HISTORICAL_UNSAFE_DIRECTORY");
    } else mkdirSync(directory);
    within(root, realpathSync(directory));
  }
  const path = resolve(directory, "runs.ndjson"), lock = resolve(directory, "writer.lock");
  const lockFd = openSync(lock, "wx");
  let active = true, uncertainWrite = false;
  const requireActive = () => {
    if (!active) throw new Error("HISTORICAL_REPOSITORY_SCOPE_CLOSED");
    if (uncertainWrite) throw new Error("HISTORICAL_WRITE_UNCERTAIN_REOPEN_REQUIRED");
  };
  const checkFile = () => {
    if (!existsSync(path)) return 0;
    const stat = lstatSync(path);
    if (stat.isSymbolicLink() || !stat.isFile() || stat.size > MAX_BYTES) throw new Error("HISTORICAL_UNSAFE_OR_OVERSIZED_JOURNAL");
    return stat.size;
  };
  try {
    checkFile();
    const source = existsSync(path) ? readFileSync(path, "utf8") : "";
    if (source && !source.endsWith("\n")) throw new Error("HISTORICAL_TRUNCATED_JOURNAL_REQUIRES_REVIEW");
    let runs: readonly HistoricalReplayRun[] = [], previousFingerprint: string | null = null, sequence = 0;
    const lines = source ? source.slice(0, -1).split("\n") : [];
    if (lines.length > MAX_BATCHES) throw new Error("HISTORICAL_JOURNAL_BATCH_LIMIT");
    for (const line of lines) {
      const batch = JSON.parse(line);
      if (!batch || typeof batch !== "object" || Array.isArray(batch)) throw new Error("HISTORICAL_INVALID_BATCH");
      const { fingerprint, ...body } = batch;
      const keys = ["schemaVersion", "sequence", "previousFingerprint", "run", "resultFingerprint", "reviewFingerprint"];
      if (Object.keys(body).length !== keys.length || keys.some((key) => !Object.hasOwn(body, key))
        || body.schemaVersion !== "1.0" || body.sequence !== sequence + 1 || body.previousFingerprint !== previousFingerprint
        || fingerprint !== marketEvidenceFingerprint(body)) throw new Error("HISTORICAL_BATCH_INTEGRITY_FAILURE");
      const saved = body.run;
      if (!saved || typeof saved !== "object" || Array.isArray(saved)) throw new Error("HISTORICAL_INVALID_RUN");
      const run = createHistoricalReplayRun(saved.config, saved.evidence, saved.recordedAt);
      if (marketEvidenceFingerprint(saved) !== marketEvidenceFingerprint(run) || body.resultFingerprint !== marketEvidenceFingerprint(run.result)
        || body.reviewFingerprint !== marketEvidenceFingerprint(run.review)) throw new Error("HISTORICAL_RUN_REPLAY_MISMATCH");
      if (runs.some((prior) => prior.config.runId === run.config.runId)) throw new Error("HISTORICAL_REDUNDANT_OR_CONFLICTING_RUN");
      if (runs.length && run.recordedAt < runs.at(-1)!.recordedAt) throw new Error("HISTORICAL_RUN_CLOCK_REGRESSION");
      runs = [...runs, run]; previousFingerprint = fingerprint; sequence++;
    }
    const repository: OptionsHistoricalReplayRepository = {
      directory,
      readReport: () => { requireActive(); return buildHistoricalReplayReport(runs); },
      readRun: (runId) => { requireActive(); return runs.find((run) => run.config.runId === runId); },
      append: (config, evidence, recordedAt) => {
        requireActive();
        const run = createHistoricalReplayRun(config, evidence, recordedAt);
        const prior = runs.find((item) => item.config.runId === run.config.runId);
        if (prior) {
          if (identity(prior) !== identity(run)) throw new Error("HISTORICAL_RUN_ID_CONFLICT");
          return { changed: false, report: buildHistoricalReplayReport(runs) };
        }
        if (sequence >= MAX_BATCHES) throw new Error("HISTORICAL_JOURNAL_BATCH_LIMIT");
        if (runs.length && run.recordedAt < runs.at(-1)!.recordedAt) throw new Error("HISTORICAL_RUN_CLOCK_REGRESSION");
        const next = [...runs, run];
        const report = buildHistoricalReplayReport(next);
        const body = { schemaVersion: "1.0", sequence: sequence + 1, previousFingerprint, run,
          resultFingerprint: marketEvidenceFingerprint(run.result), reviewFingerprint: marketEvidenceFingerprint(run.review) };
        const fingerprint = marketEvidenceFingerprint(body), data = JSON.stringify({ ...body, fingerprint }) + "\n";
        if (checkFile() + new TextEncoder().encode(data).byteLength > MAX_BYTES) throw new Error("HISTORICAL_JOURNAL_ROTATION_REQUIRED");
        uncertainWrite = true;
        appendFileSync(path, data, { encoding: "utf8" });
        const fd = openSync(path, "r+"); try { fsyncSync(fd); } finally { closeSync(fd); }
        uncertainWrite = false;
        runs = next; previousFingerprint = fingerprint; sequence++;
        return { changed: true, report };
      },
    };
    const result = operation(repository);
    if (result && (typeof result === "object" || typeof result === "function") && "then" in result) throw new Error("HISTORICAL_REPOSITORY_REQUIRES_SYNCHRONOUS_CALLBACK");
    return result;
  } finally { active = false; closeSync(lockFd); unlinkSync(lock); }
}
