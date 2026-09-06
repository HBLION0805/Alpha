import { appendFileSync, closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, realpathSync, unlinkSync } from "node:fs";
import { resolve, sep } from "node:path";
import { buildOptionsMarketEvidenceReport, marketEvidenceFingerprint, qualifyOptionsMarketEvidence, validateOptionsMarketEvidence } from "../engines/options-market-evidence/OptionsMarketEvidenceEngine";
import type { OptionsMarketEvidence } from "../engines/options-market-evidence/OptionsMarketEvidenceEngine";

const MAX_BYTES = 16 * 1024 * 1024;
const MAX_BATCHES = 1000;
type Report = ReturnType<typeof buildOptionsMarketEvidenceReport>;
function within(root: string, candidate: string) {
  if (candidate !== root && !candidate.startsWith(root + sep)) throw new Error("MARKET_STORE_PATH_ESCAPE");
}
function identity(evidence: OptionsMarketEvidence) {
  const { importedAt: _firstSeen, ...payload } = evidence;
  return marketEvidenceFingerprint(payload);
}
export interface OptionsMarketEvidenceRepository {
  readReport(asOf?: string): Report;
  readEvidence(datasetId: string): OptionsMarketEvidence | undefined;
  append(input: unknown): { readonly changed: boolean; readonly report: Report };
  readonly directory: string;
}

/** Local integrity history; hashes do not authenticate publisher identity or data rights. */
export function withOptionsMarketEvidenceRepository<T>(workspace: string, operation: (repository: OptionsMarketEvidenceRepository) => T): T {
  const root = realpathSync(workspace);
  let directory = root;
  for (const part of ["data", "runtime", "options-market-evidence"]) {
    directory = resolve(directory, part); within(root, directory);
    if (existsSync(directory)) {
      const stat = lstatSync(directory);
      if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error("MARKET_UNSAFE_DIRECTORY");
    } else mkdirSync(directory);
    within(root, realpathSync(directory));
  }
  const path = resolve(directory, "imports.ndjson"), lock = resolve(directory, "writer.lock");
  const lockFd = openSync(lock, "wx");
  let active = true, uncertainWrite = false;
  const requireActive = () => {
    if (!active) throw new Error("MARKET_REPOSITORY_SCOPE_CLOSED");
    if (uncertainWrite) throw new Error("MARKET_WRITE_UNCERTAIN_REOPEN_REQUIRED");
  };
  const checkFile = () => {
    if (!existsSync(path)) return 0;
    const stat = lstatSync(path);
    if (stat.isSymbolicLink() || !stat.isFile() || stat.size > MAX_BYTES) throw new Error("MARKET_UNSAFE_OR_OVERSIZED_JOURNAL");
    return stat.size;
  };
  try {
    checkFile();
    const source = existsSync(path) ? readFileSync(path, "utf8") : "";
    if (source && !source.endsWith("\n")) throw new Error("MARKET_TRUNCATED_JOURNAL_REQUIRES_REVIEW");
    let evidences: readonly OptionsMarketEvidence[] = [], previousFingerprint: string | null = null, sequence = 0;
    const lines = source ? source.slice(0, -1).split("\n") : [];
    if (lines.length > MAX_BATCHES) throw new Error("MARKET_JOURNAL_BATCH_LIMIT");
    for (const line of lines) {
      const batch = JSON.parse(line);
      if (!batch || typeof batch !== "object" || Array.isArray(batch)) throw new Error("MARKET_INVALID_BATCH");
      const { fingerprint, ...body } = batch;
      const keys = ["schemaVersion", "sequence", "previousFingerprint", "evidence", "qualification", "qualificationFingerprint"];
      if (Object.keys(body).length !== keys.length || keys.some((key) => !Object.hasOwn(body, key))
        || body.schemaVersion !== "1.0" || body.sequence !== sequence + 1 || body.previousFingerprint !== previousFingerprint
        || fingerprint !== marketEvidenceFingerprint(body)) throw new Error("MARKET_BATCH_INTEGRITY_FAILURE");
      const evidence = validateOptionsMarketEvidence(body.evidence);
      if (evidences.some((existing) => existing.metadata.datasetId === evidence.metadata.datasetId)) throw new Error("MARKET_REDUNDANT_OR_CONFLICTING_DATASET");
      if (evidences.length && evidence.importedAt < evidences.at(-1)!.importedAt) throw new Error("MARKET_IMPORT_CLOCK_REGRESSION");
      const qualification = qualifyOptionsMarketEvidence(evidence);
      if (body.qualificationFingerprint !== marketEvidenceFingerprint(qualification)
        || marketEvidenceFingerprint(body.qualification) !== body.qualificationFingerprint) throw new Error("MARKET_QUALIFICATION_REPLAY_MISMATCH");
      evidences = [...evidences, evidence]; previousFingerprint = fingerprint; sequence++;
    }
    const repository: OptionsMarketEvidenceRepository = {
      directory,
      readReport: (asOf) => { requireActive(); return buildOptionsMarketEvidenceReport(evidences, asOf); },
      readEvidence: (datasetId) => { requireActive(); return evidences.find((evidence) => evidence.metadata.datasetId === datasetId); },
      append: (input) => {
        requireActive();
        const evidence = validateOptionsMarketEvidence(input);
        const existing = evidences.find((item) => item.metadata.datasetId === evidence.metadata.datasetId);
        if (existing) {
          if (identity(existing) !== identity(evidence)) throw new Error("MARKET_DATASET_ID_CONFLICT");
          return { changed: false, report: buildOptionsMarketEvidenceReport(evidences) };
        }
        if (sequence >= MAX_BATCHES) throw new Error("MARKET_JOURNAL_BATCH_LIMIT");
        if (evidences.length && evidence.importedAt < evidences.at(-1)!.importedAt) throw new Error("MARKET_IMPORT_CLOCK_REGRESSION");
        const qualification = qualifyOptionsMarketEvidence(evidence);
        const body = { schemaVersion: "1.0", sequence: sequence + 1, previousFingerprint, evidence,
          qualification, qualificationFingerprint: marketEvidenceFingerprint(qualification) };
        const fingerprint = marketEvidenceFingerprint(body), data = JSON.stringify({ ...body, fingerprint }) + "\n";
        if (checkFile() + new TextEncoder().encode(data).byteLength > MAX_BYTES) throw new Error("MARKET_JOURNAL_ROTATION_REQUIRED");
        // A failed append/fsync may already have changed disk. A caught failure
        // must not allow another append against stale in-memory sequence state.
        uncertainWrite = true;
        appendFileSync(path, data, { encoding: "utf8" });
        const fd = openSync(path, "r+"); try { fsyncSync(fd); } finally { closeSync(fd); }
        uncertainWrite = false;
        evidences = [...evidences, evidence]; previousFingerprint = fingerprint; sequence++;
        return { changed: true, report: buildOptionsMarketEvidenceReport(evidences) };
      },
    };
    const result = operation(repository);
    if (result && (typeof result === "object" || typeof result === "function") && "then" in result) throw new Error("MARKET_REPOSITORY_REQUIRES_SYNCHRONOUS_CALLBACK");
    return result;
  } finally { active = false; closeSync(lockFd); unlinkSync(lock); }
}
