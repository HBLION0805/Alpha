import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { resolve, sep } from "node:path";
import {
  AIAuditRepositoryErrorCategory,
  AIAuditRepositoryType,
  canonicalizeAIAuditValue,
  validateAIAuditRecord,
  type AIAuditRecord,
} from "../contracts";
import { InMemoryAIAuditRepository } from "./InMemoryAIAuditRepository";

const STORE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;

export class AIAuditRepositoryCorruptionError extends Error {
  readonly category = AIAuditRepositoryErrorCategory.CorruptRepository;
  constructor(message: string) {
    super(message);
    this.name = "AIAuditRepositoryCorruptionError";
  }
}

export class AIAuditRepositoryPathError extends Error {
  readonly category = AIAuditRepositoryErrorCategory.InvalidPath;
  constructor(message: string) {
    super(message);
    this.name = "AIAuditRepositoryPathError";
  }
}

function safePath(rootDirectory: string, storeId: string): string {
  if (!STORE_ID_PATTERN.test(storeId)) {
    throw new AIAuditRepositoryPathError(
      "Invalid audit store ID: path traversal or unsupported characters are forbidden.",
    );
  }
  const root = resolve(rootDirectory);
  const file = resolve(root, `${storeId}.ndjson`);
  if (!file.startsWith(`${root}${sep}`)) {
    throw new AIAuditRepositoryPathError(
      "Invalid audit path: resolved path escaped the configured root.",
    );
  }
  return file;
}

function loadRecords(rootDirectory: string, storeId: string): {
  readonly filePath: string;
  readonly records: ReadonlyArray<AIAuditRecord>;
} {
  const filePath = safePath(rootDirectory, storeId);
  mkdirSync(resolve(rootDirectory), { recursive: true });
  if (!existsSync(filePath)) {
    const descriptor = openSync(filePath, "a");
    try {
      fsyncSync(descriptor);
    } finally {
      closeSync(descriptor);
    }
    return { filePath, records: [] };
  }
  const serialized = readFileSync(filePath, "utf8");
  if (serialized.length === 0) return { filePath, records: [] };
  if (!serialized.endsWith("\n")) {
    throw new AIAuditRepositoryCorruptionError(
      "Corrupt audit repository: truncated final record.",
    );
  }
  const lines = serialized.slice(0, -1).split("\n");
  const records: AIAuditRecord[] = [];
  const ids = new Set<string>();
  const idempotencyKeys = new Set<string>();
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line === undefined || line.length === 0) {
      throw new AIAuditRepositoryCorruptionError(
        `Corrupt audit repository: empty line ${index + 1}.`,
      );
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      throw new AIAuditRepositoryCorruptionError(
        `Corrupt audit repository: malformed JSON at line ${index + 1}.`,
      );
    }
    try {
      validateAIAuditRecord(parsed as AIAuditRecord);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new AIAuditRepositoryCorruptionError(
        `Corrupt audit record at line ${index + 1}: ${message}`,
      );
    }
    if (canonicalizeAIAuditValue(parsed) !== line) {
      throw new AIAuditRepositoryCorruptionError(
        `Corrupt audit repository: non-canonical line ${index + 1}.`,
      );
    }
    const record = parsed as AIAuditRecord;
    if (record.sequence !== index + 1) {
      throw new AIAuditRepositoryCorruptionError(
        `Corrupt audit repository: sequence mismatch at line ${index + 1}.`,
      );
    }
    if (ids.has(record.recordId) || idempotencyKeys.has(record.idempotencyKey)) {
      throw new AIAuditRepositoryCorruptionError(
        `Corrupt audit repository: duplicate identity at line ${index + 1}.`,
      );
    }
    ids.add(record.recordId);
    idempotencyKeys.add(record.idempotencyKey);
    records.push(record);
  }
  return { filePath, records };
}

export class LocalNdjsonAIAuditRepository extends InMemoryAIAuditRepository {
  override readonly repositoryType = AIAuditRepositoryType.LocalNdjson;
  private readonly filePath: string;

  constructor(rootDirectory: string, storeId = "ai-audit-v1") {
    const loaded = loadRecords(rootDirectory, storeId);
    super(loaded.records);
    this.filePath = loaded.filePath;
  }

  getStoragePath(): string {
    return this.filePath;
  }

  protected override persistRecord(record: Readonly<AIAuditRecord>): void {
    const descriptor = openSync(this.filePath, "a");
    try {
      writeFileSync(descriptor, `${canonicalizeAIAuditValue(record)}\n`);
      fsyncSync(descriptor);
    } finally {
      closeSync(descriptor);
    }
  }
}
