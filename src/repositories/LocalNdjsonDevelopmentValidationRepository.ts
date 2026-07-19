import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import { DevelopmentValidationErrorCategory, canonicalizeDevelopmentValue, type DevelopmentValidationRecord } from "../contracts";
import { InMemoryDevelopmentValidationRepository } from "./InMemoryDevelopmentValidationRepository";

const STORE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;

export class DevelopmentValidationRepositoryCorruptionError extends Error {
  readonly category = DevelopmentValidationErrorCategory.RepositoryCorrupt;
  constructor(message: string) { super(message); this.name = "DevelopmentValidationRepositoryCorruptionError"; }
}

export class DevelopmentValidationRepositoryPathError extends Error {
  readonly category = DevelopmentValidationErrorCategory.InvalidPath;
  constructor(message: string) { super(message); this.name = "DevelopmentValidationRepositoryPathError"; }
}

function safePath(rootDirectory: string, storeId: string): string {
  if (!STORE_ID_PATTERN.test(storeId)) throw new DevelopmentValidationRepositoryPathError("Invalid development validation store ID: path traversal is forbidden.");
  const root = resolve(rootDirectory); const file = resolve(root, `${storeId}.ndjson`);
  if (!file.startsWith(`${root}${sep}`)) throw new DevelopmentValidationRepositoryPathError("Invalid development validation path: resolved path escaped root.");
  return file;
}

function loadRecords(rootDirectory: string, storeId: string): { readonly filePath: string; readonly records: ReadonlyArray<DevelopmentValidationRecord> } {
  const filePath = safePath(rootDirectory, storeId); mkdirSync(resolve(rootDirectory), { recursive: true });
  if (!existsSync(filePath)) { const descriptor = openSync(filePath, "a"); try { fsyncSync(descriptor); } finally { closeSync(descriptor); } return { filePath, records: [] }; }
  const content = readFileSync(filePath, "utf8"); if (content.length === 0) return { filePath, records: [] };
  if (!content.endsWith("\n")) throw new DevelopmentValidationRepositoryCorruptionError("Corrupt development validation repository: truncated final record.");
  const records: DevelopmentValidationRecord[] = []; const lines = content.slice(0, -1).split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]; if (line === undefined || line.length === 0) throw new DevelopmentValidationRepositoryCorruptionError(`Corrupt development validation repository: empty line ${String(index + 1)}.`);
    let parsed: unknown; try { parsed = JSON.parse(line); } catch { throw new DevelopmentValidationRepositoryCorruptionError(`Corrupt development validation repository: malformed JSON at line ${String(index + 1)}.`); }
    if (canonicalizeDevelopmentValue(parsed) !== line) throw new DevelopmentValidationRepositoryCorruptionError(`Corrupt development validation repository: noncanonical line ${String(index + 1)}.`);
    const record = parsed as DevelopmentValidationRecord; if (record.schemaVersion !== "1.0" || record.sequence !== index + 1) throw new DevelopmentValidationRepositoryCorruptionError(`Corrupt development validation repository: invalid envelope at line ${String(index + 1)}.`);
    records.push(record);
  }
  return { filePath, records };
}

export class LocalNdjsonDevelopmentValidationRepository extends InMemoryDevelopmentValidationRepository {
  private readonly filePath: string;
  constructor(rootDirectory: string, storeId = "development-validation-v1") { const loaded = loadRecords(rootDirectory, storeId); super(loaded.records); this.filePath = loaded.filePath; }
  getStoragePath(): string { return this.filePath; }
  protected override persistRecord(record: Readonly<DevelopmentValidationRecord>): void { const descriptor = openSync(this.filePath, "a"); try { writeFileSync(descriptor, `${canonicalizeDevelopmentValue(record)}\n`); fsyncSync(descriptor); } finally { closeSync(descriptor); } }
}
