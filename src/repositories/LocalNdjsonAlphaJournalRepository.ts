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
  AlphaJournalErrorCategory,
  canonicalizeAlphaJournalValue,
} from "../contracts";
import { InMemoryAlphaJournalRepository } from "./InMemoryAlphaJournalRepository";
import type { AlphaJournalRepositoryEvent as JournalEvent } from "./AlphaJournalRepository";

const STORE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;

export class AlphaJournalRepositoryCorruptionError extends Error {
  readonly category = AlphaJournalErrorCategory.RepositoryCorrupt;
  constructor(message: string) {
    super(message);
    this.name = "AlphaJournalRepositoryCorruptionError";
  }
}

export class AlphaJournalRepositoryPathError extends Error {
  readonly category = AlphaJournalErrorCategory.InvalidPath;
  constructor(message: string) {
    super(message);
    this.name = "AlphaJournalRepositoryPathError";
  }
}

function safePath(rootDirectory: string, storeId: string): string {
  if (!STORE_ID_PATTERN.test(storeId)) throw new AlphaJournalRepositoryPathError("Invalid journal store ID: path traversal is forbidden.");
  const root = resolve(rootDirectory);
  const file = resolve(root, `${storeId}.ndjson`);
  if (!file.startsWith(`${root}${sep}`)) throw new AlphaJournalRepositoryPathError("Invalid journal path: resolved path escaped root.");
  return file;
}

function loadEvents(rootDirectory: string, storeId: string): { readonly filePath: string; readonly events: ReadonlyArray<JournalEvent> } {
  const filePath = safePath(rootDirectory, storeId);
  mkdirSync(resolve(rootDirectory), { recursive: true });
  if (!existsSync(filePath)) {
    const descriptor = openSync(filePath, "a");
    try { fsyncSync(descriptor); } finally { closeSync(descriptor); }
    return { filePath, events: [] };
  }
  const content = readFileSync(filePath, "utf8");
  if (content.length === 0) return { filePath, events: [] };
  if (!content.endsWith("\n")) throw new AlphaJournalRepositoryCorruptionError("Corrupt journal repository: truncated final record.");
  const events: JournalEvent[] = [];
  const lines = content.slice(0, -1).split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line === undefined || line.length === 0) throw new AlphaJournalRepositoryCorruptionError(`Corrupt journal repository: empty line ${String(index + 1)}.`);
    let parsed: unknown;
    try { parsed = JSON.parse(line); } catch { throw new AlphaJournalRepositoryCorruptionError(`Corrupt journal repository: malformed JSON at line ${String(index + 1)}.`); }
    if (canonicalizeAlphaJournalValue(parsed) !== line) throw new AlphaJournalRepositoryCorruptionError(`Corrupt journal repository: non-canonical line ${String(index + 1)}.`);
    const event = parsed as JournalEvent;
    if (event.schemaVersion !== "1.0" || event.sequence !== index + 1) throw new AlphaJournalRepositoryCorruptionError(`Corrupt journal repository: invalid envelope at line ${String(index + 1)}.`);
    events.push(event);
  }
  return { filePath, events };
}

export class LocalNdjsonAlphaJournalRepository extends InMemoryAlphaJournalRepository {
  private readonly filePath: string;

  constructor(rootDirectory: string, storeId = "alpha-journal-v1") {
    const loaded = loadEvents(rootDirectory, storeId);
    super(loaded.events);
    this.filePath = loaded.filePath;
  }

  getStoragePath(): string {
    return this.filePath;
  }

  protected override persistEvent(event: Readonly<JournalEvent>): void {
    const descriptor = openSync(this.filePath, "a");
    try {
      writeFileSync(descriptor, `${canonicalizeAlphaJournalValue(event)}\n`);
      fsyncSync(descriptor);
    } finally {
      closeSync(descriptor);
    }
  }
}
