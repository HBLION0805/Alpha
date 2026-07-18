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
  AICostLedgerErrorCategory,
  AICostLedgerRepositoryType,
  canonicalizeAICostLedgerValue,
  validateAICostLedgerEntry,
  type AICostLedgerEntry,
} from "../contracts";
import { InMemoryAICostLedgerRepository } from "./InMemoryAICostLedgerRepository";

const LEDGER_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;

export class AICostLedgerRepositoryCorruptionError extends Error {
  readonly category = AICostLedgerErrorCategory.CorruptRepository;

  constructor(message: string) {
    super(message);
    this.name = "AICostLedgerRepositoryCorruptionError";
  }
}

export class AICostLedgerRepositoryPathError extends Error {
  readonly category = AICostLedgerErrorCategory.InvalidPath;

  constructor(message: string) {
    super(message);
    this.name = "AICostLedgerRepositoryPathError";
  }
}

function safeLedgerPath(rootDirectory: string, ledgerId: string): string {
  if (!LEDGER_ID_PATTERN.test(ledgerId)) {
    throw new AICostLedgerRepositoryPathError(
      "Invalid ledger ID: path traversal or unsupported characters are forbidden.",
    );
  }
  const root = resolve(rootDirectory);
  const file = resolve(root, `${ledgerId}.ndjson`);
  if (!file.startsWith(`${root}${sep}`)) {
    throw new AICostLedgerRepositoryPathError(
      "Invalid ledger path: resolved path escaped the configured root.",
    );
  }
  return file;
}

function loadEntries(rootDirectory: string, ledgerId: string): {
  readonly filePath: string;
  readonly entries: ReadonlyArray<AICostLedgerEntry>;
} {
  const filePath = safeLedgerPath(rootDirectory, ledgerId);
  mkdirSync(resolve(rootDirectory), { recursive: true });
  if (!existsSync(filePath)) {
    const descriptor = openSync(filePath, "a");
    try {
      fsyncSync(descriptor);
    } finally {
      closeSync(descriptor);
    }
    return { filePath, entries: [] };
  }
  const serialized = readFileSync(filePath, "utf8");
  if (serialized.length === 0) return { filePath, entries: [] };
  if (!serialized.endsWith("\n")) {
    throw new AICostLedgerRepositoryCorruptionError(
      "Corrupt ledger: final record is truncated or missing its newline terminator.",
    );
  }
  const lines = serialized.slice(0, -1).split("\n");
  const entries: AICostLedgerEntry[] = [];
  const entryIds = new Set<string>();
  const operationIds = new Set<string>();
  const idempotencyKeys = new Set<string>();
  const executionSettlements = new Set<string>();
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line === undefined || line.length === 0) {
      throw new AICostLedgerRepositoryCorruptionError(
        `Corrupt ledger: empty record at line ${index + 1}.`,
      );
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      throw new AICostLedgerRepositoryCorruptionError(
        `Corrupt ledger: malformed JSON at line ${index + 1}.`,
      );
    }
    try {
      validateAICostLedgerEntry(parsed as AICostLedgerEntry);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new AICostLedgerRepositoryCorruptionError(
        `Corrupt ledger record at line ${index + 1}: ${message}`,
      );
    }
    if (canonicalizeAICostLedgerValue(parsed) !== line) {
      throw new AICostLedgerRepositoryCorruptionError(
        `Corrupt ledger: non-canonical serialization at line ${index + 1}.`,
      );
    }
    const entry = parsed as AICostLedgerEntry;
    if (entry.sequence !== index + 1) {
      throw new AICostLedgerRepositoryCorruptionError(
        `Corrupt ledger: sequence mismatch at line ${index + 1}.`,
      );
    }
    if (
      entryIds.has(entry.entryId) ||
      operationIds.has(entry.operationId) ||
      idempotencyKeys.has(entry.idempotencyKey)
    ) {
      throw new AICostLedgerRepositoryCorruptionError(
        `Corrupt ledger: duplicate immutable identity at line ${index + 1}.`,
      );
    }
    if (
      entry.executionId !== undefined &&
      ["USAGE_PARTIALLY_COMMITTED", "USAGE_COMMITTED"].includes(
        entry.entryType,
      )
    ) {
      if (executionSettlements.has(entry.executionId)) {
        throw new AICostLedgerRepositoryCorruptionError(
          `Corrupt ledger: duplicate execution settlement at line ${index + 1}.`,
        );
      }
      executionSettlements.add(entry.executionId);
    }
    entryIds.add(entry.entryId);
    operationIds.add(entry.operationId);
    idempotencyKeys.add(entry.idempotencyKey);
    entries.push(entry);
  }
  return { filePath, entries };
}

export class LocalNdjsonAICostLedgerRepository extends InMemoryAICostLedgerRepository {
  override readonly repositoryType = AICostLedgerRepositoryType.LocalNdjson;
  private readonly filePath: string;

  constructor(rootDirectory: string, ledgerId = "ai-cost-ledger-v1") {
    const loaded = loadEntries(rootDirectory, ledgerId);
    super(loaded.entries);
    this.filePath = loaded.filePath;
  }

  getStoragePath(): string {
    return this.filePath;
  }

  protected override persistEntry(entry: Readonly<AICostLedgerEntry>): void {
    const descriptor = openSync(this.filePath, "a");
    try {
      writeFileSync(
        descriptor,
        `${canonicalizeAICostLedgerValue(entry)}\n`,
      );
      fsyncSync(descriptor);
    } finally {
      closeSync(descriptor);
    }
  }
}
