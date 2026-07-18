import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { PredictionLogEvent } from "./PredictionRepository";
import { InMemoryPredictionLogRepository } from "./InMemoryPredictionLogRepository";

function parseEvents(path: string): ReadonlyArray<PredictionLogEvent> {
  if (!existsSync(path)) return [];
  const content = readFileSync(path, "utf8");
  if (content.length === 0) return [];
  if (!content.endsWith("\n")) throw new Error("REPOSITORY_CORRUPT: prediction log contains a truncated final record.");
  return content
    .slice(0, -1)
    .split("\n")
    .map((line, index) => {
      try {
        const parsed: unknown = JSON.parse(line);
        if (parsed === null || typeof parsed !== "object" || (parsed as { schemaVersion?: unknown }).schemaVersion !== "1.0") {
          throw new Error("invalid event envelope");
        }
        if (JSON.stringify(parsed) !== line) throw new Error("event is not in canonical JSON form");
        return parsed as PredictionLogEvent;
      } catch (error: unknown) {
        throw new Error(`REPOSITORY_CORRUPT: invalid prediction event at line ${String(index + 1)}: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
}

export class LocalNdjsonPredictionLogRepository extends InMemoryPredictionLogRepository {
  readonly path: string;

  constructor(path: string) {
    const resolved = resolve(path);
    super(parseEvents(resolved));
    this.path = resolved;
  }

  protected override persistEvent(event: PredictionLogEvent): void {
    mkdirSync(dirname(this.path), { recursive: true });
    appendFileSync(this.path, `${JSON.stringify(event)}\n`, { encoding: "utf8", flag: "a" });
  }
}
