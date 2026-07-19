import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import { HistoricalPatternErrorCategory, canonicalizeHistoricalValue } from "../contracts";
import { InMemoryHistoricalPatternRepository } from "./InMemoryHistoricalPatternRepository";
import type { HistoricalRepositoryEvent } from "./HistoricalPatternRepository";

const STORE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;
export class HistoricalPatternRepositoryCorruptionError extends Error { readonly category = HistoricalPatternErrorCategory.RepositoryCorrupt; constructor(message: string) { super(message); this.name = "HistoricalPatternRepositoryCorruptionError"; } }
export class HistoricalPatternRepositoryPathError extends Error { readonly category = HistoricalPatternErrorCategory.InvalidPath; constructor(message: string) { super(message); this.name = "HistoricalPatternRepositoryPathError"; } }

function safePath(rootDirectory: string, storeId: string): string { if (!STORE_ID_PATTERN.test(storeId)) throw new HistoricalPatternRepositoryPathError("Invalid historical-pattern store ID: path traversal is forbidden."); const root = resolve(rootDirectory); const file = resolve(root, `${storeId}.ndjson`); if (!file.startsWith(`${root}${sep}`)) throw new HistoricalPatternRepositoryPathError("Invalid historical-pattern path: resolved path escaped root."); return file; }
function loadEvents(rootDirectory: string, storeId: string): { readonly filePath: string; readonly events: ReadonlyArray<HistoricalRepositoryEvent> } {
  const filePath = safePath(rootDirectory, storeId); mkdirSync(resolve(rootDirectory), { recursive: true });
  if (!existsSync(filePath)) { const descriptor = openSync(filePath, "a"); try { fsyncSync(descriptor); } finally { closeSync(descriptor); } return { filePath, events: [] }; }
  const content = readFileSync(filePath, "utf8"); if (content.length === 0) return { filePath, events: [] }; if (!content.endsWith("\n")) throw new HistoricalPatternRepositoryCorruptionError("Corrupt historical-pattern repository: truncated final record.");
  const events: HistoricalRepositoryEvent[] = []; const lines = content.slice(0, -1).split("\n");
  for (let index = 0; index < lines.length; index += 1) { const line = lines[index]; if (line === undefined || line.length === 0) throw new HistoricalPatternRepositoryCorruptionError(`Corrupt historical-pattern repository: empty line ${String(index + 1)}.`); let parsed: unknown; try { parsed = JSON.parse(line); } catch { throw new HistoricalPatternRepositoryCorruptionError(`Corrupt historical-pattern repository: malformed JSON at line ${String(index + 1)}.`); } if (canonicalizeHistoricalValue(parsed) !== line) throw new HistoricalPatternRepositoryCorruptionError(`Corrupt historical-pattern repository: non-canonical line ${String(index + 1)}.`); const event = parsed as HistoricalRepositoryEvent; if (event.schemaVersion !== "1.0" || event.sequence !== index + 1) throw new HistoricalPatternRepositoryCorruptionError(`Corrupt historical-pattern repository: invalid envelope at line ${String(index + 1)}.`); events.push(event); }
  return { filePath, events };
}

export class LocalNdjsonHistoricalPatternRepository extends InMemoryHistoricalPatternRepository {
  private readonly filePath: string;
  constructor(rootDirectory: string, storeId = "historical-pattern-library-v1") { const loaded = loadEvents(rootDirectory, storeId); super(loaded.events); this.filePath = loaded.filePath; }
  getStoragePath(): string { return this.filePath; }
  protected override persistEvent(event: Readonly<HistoricalRepositoryEvent>): void { const descriptor = openSync(this.filePath, "a"); try { writeFileSync(descriptor, `${canonicalizeHistoricalValue(event)}\n`); fsyncSync(descriptor); } finally { closeSync(descriptor); } }
}
