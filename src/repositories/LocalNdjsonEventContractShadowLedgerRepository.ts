import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import { EventContractShadowErrorCategory } from "../contracts";
import {
  EventContractShadowLedgerError,
  canonicalizeEventContractShadowValue,
} from "../engines/event-contract-shadow-ledger";
import type { EventContractShadowRepositoryEvent } from "./EventContractShadowLedgerRepository";
import { InMemoryEventContractShadowLedgerRepository } from "./InMemoryEventContractShadowLedgerRepository";

const STORE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/u;

function fail(category: EventContractShadowErrorCategory, message: string): never {
  throw new EventContractShadowLedgerError(category, message);
}

function safePath(rootDirectory: string, storeId: string): string {
  if (!STORE_ID.test(storeId)) fail(EventContractShadowErrorCategory.InvalidPath, "Invalid shadow-ledger store ID: path traversal is forbidden.");
  const root = resolve(rootDirectory);
  const file = resolve(root, `${storeId}.ndjson`);
  if (!file.startsWith(`${root}${sep}`)) fail(EventContractShadowErrorCategory.InvalidPath, "Resolved shadow-ledger path escaped its root.");
  return file;
}

function load(rootDirectory: string, storeId: string): { filePath: string; events: readonly EventContractShadowRepositoryEvent[] } {
  const filePath = safePath(rootDirectory, storeId);
  mkdirSync(resolve(rootDirectory), { recursive: true });
  if (!existsSync(filePath)) {
    const descriptor = openSync(filePath, "a");
    try { fsyncSync(descriptor); } finally { closeSync(descriptor); }
    return { filePath, events: [] };
  }
  const content = readFileSync(filePath, "utf8");
  if (content.length === 0) return { filePath, events: [] };
  if (!content.endsWith("\n")) fail(EventContractShadowErrorCategory.RepositoryCorrupt, "Shadow ledger contains a truncated final record.");
  const events: EventContractShadowRepositoryEvent[] = [];
  for (const [index, line] of content.slice(0, -1).split("\n").entries()) {
    if (line.length === 0) fail(EventContractShadowErrorCategory.RepositoryCorrupt, `Shadow ledger contains an empty line ${String(index + 1)}.`);
    let parsed: unknown;
    try { parsed = JSON.parse(line); } catch { fail(EventContractShadowErrorCategory.RepositoryCorrupt, `Shadow ledger contains malformed JSON at line ${String(index + 1)}.`); }
    if (canonicalizeEventContractShadowValue(parsed) !== line) fail(EventContractShadowErrorCategory.RepositoryCorrupt, `Shadow ledger line ${String(index + 1)} is not canonical.`);
    if (typeof parsed !== "object" || parsed === null || (parsed as { schemaVersion?: unknown }).schemaVersion !== "1.0" || (parsed as { sequence?: unknown }).sequence !== index + 1) {
      fail(EventContractShadowErrorCategory.RepositoryCorrupt, `Shadow ledger envelope is invalid at line ${String(index + 1)}.`);
    }
    events.push(parsed as EventContractShadowRepositoryEvent);
  }
  return { filePath, events };
}

export class LocalNdjsonEventContractShadowLedgerRepository extends InMemoryEventContractShadowLedgerRepository {
  readonly #filePath: string;

  public constructor(rootDirectory: string, storeId = "event-contract-shadow-v1") {
    const loaded = load(rootDirectory, storeId);
    super(loaded.events);
    this.#filePath = loaded.filePath;
  }

  public getStoragePath(): string { return this.#filePath; }

  protected override persistEvent(event: Readonly<EventContractShadowRepositoryEvent>): void {
    const descriptor = openSync(this.#filePath, "a");
    try {
      writeFileSync(descriptor, `${canonicalizeEventContractShadowValue(event)}\n`);
      fsyncSync(descriptor);
    } finally {
      closeSync(descriptor);
    }
  }
}
