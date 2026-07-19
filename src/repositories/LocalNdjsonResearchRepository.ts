import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import { ResearchErrorCategory, canonicalizeResearchValue } from "../contracts";
import { InMemoryResearchRepository } from "./InMemoryResearchRepository";
import type { ResearchRepositoryEvent } from "./ResearchRepository";

const STORE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;
export class ResearchRepositoryCorruptionError extends Error { readonly category = ResearchErrorCategory.RepositoryCorrupt; constructor(message: string) { super(message); this.name = "ResearchRepositoryCorruptionError"; } }
export class ResearchRepositoryPathError extends Error { readonly category = ResearchErrorCategory.InvalidPath; constructor(message: string) { super(message); this.name = "ResearchRepositoryPathError"; } }

function safePath(rootDirectory: string, storeId: string): string {
  if (!STORE_ID_PATTERN.test(storeId)) throw new ResearchRepositoryPathError("Invalid research store ID: path traversal is forbidden.");
  const root = resolve(rootDirectory); const file = resolve(root, `${storeId}.ndjson`); if (!file.startsWith(`${root}${sep}`)) throw new ResearchRepositoryPathError("Invalid research path: resolved path escaped root."); return file;
}

function loadEvents(rootDirectory: string, storeId: string): { readonly filePath: string; readonly events: ReadonlyArray<ResearchRepositoryEvent> } {
  const filePath = safePath(rootDirectory, storeId); mkdirSync(resolve(rootDirectory), { recursive: true });
  if (!existsSync(filePath)) { const descriptor = openSync(filePath, "a"); try { fsyncSync(descriptor); } finally { closeSync(descriptor); } return { filePath, events: [] }; }
  const content = readFileSync(filePath, "utf8"); if (content.length === 0) return { filePath, events: [] }; if (!content.endsWith("\n")) throw new ResearchRepositoryCorruptionError("Corrupt research repository: truncated final record.");
  const events: ResearchRepositoryEvent[] = []; const lines = content.slice(0, -1).split("\n");
  for (let index = 0; index < lines.length; index += 1) { const line = lines[index]; if (line === undefined || line.length === 0) throw new ResearchRepositoryCorruptionError(`Corrupt research repository: empty line ${String(index + 1)}.`); let parsed: unknown; try { parsed = JSON.parse(line); } catch { throw new ResearchRepositoryCorruptionError(`Corrupt research repository: malformed JSON at line ${String(index + 1)}.`); } if (canonicalizeResearchValue(parsed) !== line) throw new ResearchRepositoryCorruptionError(`Corrupt research repository: non-canonical line ${String(index + 1)}.`); const event = parsed as ResearchRepositoryEvent; if (event.schemaVersion !== "1.0" || event.sequence !== index + 1) throw new ResearchRepositoryCorruptionError(`Corrupt research repository: invalid envelope at line ${String(index + 1)}.`); events.push(event); }
  return { filePath, events };
}

export class LocalNdjsonResearchRepository extends InMemoryResearchRepository {
  private readonly filePath: string;
  constructor(rootDirectory: string, storeId = "research-lab-v1") { const loaded = loadEvents(rootDirectory, storeId); super(loaded.events); this.filePath = loaded.filePath; }
  getStoragePath(): string { return this.filePath; }
  protected override persistEvent(event: Readonly<ResearchRepositoryEvent>): void { const descriptor = openSync(this.filePath, "a"); try { writeFileSync(descriptor, `${canonicalizeResearchValue(event)}\n`); fsyncSync(descriptor); } finally { closeSync(descriptor); } }
}
