import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import type {
  EventContractShadowHistory,
  FrozenForwardShadowCollectionPlan,
} from "../../contracts";
import { LocalNdjsonEventContractShadowLedgerRepository } from "../../repositories/LocalNdjsonEventContractShadowLedgerRepository";
import { EventContractShadowLedgerService } from "../event-contract-shadow-ledger";
import { ForwardShadowCollectionControlEngine } from "./ForwardShadowCollectionControlEngine";

export const FORWARD_SHADOW_COLLECTION_USAGE = "Usage: forward-shadow-collection <freeze-plan|progress> [options]";
export const FORWARD_SHADOW_COLLECTION_HELP = [
  FORWARD_SHADOW_COLLECTION_USAGE,
  "",
  "freeze-plan --input=<request.json> --output=<frozen-plan.json>",
  "progress --plan=<frozen-plan.json> --store-dir=<ledger-directory> [--store-id=<id>] --as-of=<UTC> --audit-id=<id>",
  "",
  "The command is local and explicit. It performs no network access, polling, model inference, recommendation, or trading.",
].join("\n");

const STORE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/u;

export interface ForwardShadowCollectionConsoleDependencies {
  readonly loadJson: (path: string) => unknown;
  readonly savePlanExclusive: (path: string, plan: FrozenForwardShadowCollectionPlan) => void;
  readonly loadHistories: (storeDirectory: string, storeId: string) => readonly EventContractShadowHistory[];
}

export function runForwardShadowCollectionConsole(
  args: readonly string[],
  dependencies: ForwardShadowCollectionConsoleDependencies = DEFAULT_DEPENDENCIES,
): string {
  if (args.length === 1 && args[0] === "--help") return FORWARD_SHADOW_COLLECTION_HELP;
  const command = args[0];
  if (command !== "freeze-plan" && command !== "progress") throw new Error(FORWARD_SHADOW_COLLECTION_USAGE);
  const options = parseOptions(args.slice(1));
  const engine = new ForwardShadowCollectionControlEngine();

  if (command === "freeze-plan") {
    exactOptionNames(options, ["input", "output"]);
    const plan = engine.createPlan(dependencies.loadJson(required(options, "input")));
    dependencies.savePlanExclusive(required(options, "output"), plan);
    return JSON.stringify(plan, null, 2);
  }

  exactOptionNames(options, ["plan", "store-dir", "store-id", "as-of", "audit-id"], ["store-id"]);
  const artifact = engine.verifyPlanArtifact(dependencies.loadJson(required(options, "plan")));
  const histories = dependencies.loadHistories(required(options, "store-dir"), options.get("store-id") ?? "event-contract-shadow-v1");
  return JSON.stringify(engine.auditProgress({
    schemaVersion: artifact.schemaVersion,
    auditId: required(options, "audit-id"),
    asOfTime: required(options, "as-of"),
    collectionPlan: artifact.collectionPlan,
    histories,
  }), null, 2);
}

export function loadJsonFile(path: string): unknown {
  return JSON.parse(readFileSync(resolve(path), "utf8"));
}

export function saveFrozenPlanExclusive(path: string, plan: FrozenForwardShadowCollectionPlan): void {
  const target = resolve(path);
  mkdirSync(dirname(target), { recursive: true });
  let descriptor: number;
  try { descriptor = openSync(target, "wx"); }
  catch { throw new Error("Frozen plan output already exists or cannot be created."); }
  try {
    writeFileSync(descriptor, `${JSON.stringify(plan, null, 2)}\n`);
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}

export function loadExistingShadowHistories(storeDirectory: string, storeId: string): readonly EventContractShadowHistory[] {
  if (!STORE_ID.test(storeId)) throw new Error("Invalid shadow-ledger store ID.");
  const root = resolve(storeDirectory);
  const file = resolve(root, `${storeId}.ndjson`);
  if (!file.startsWith(`${root}${sep}`) || !existsSync(file)) throw new Error("Existing shadow-ledger file is required; progress is read-only.");
  const repository = new LocalNdjsonEventContractShadowLedgerRepository(root, storeId);
  return new EventContractShadowLedgerService(repository).query();
}

const DEFAULT_DEPENDENCIES: ForwardShadowCollectionConsoleDependencies = {
  loadJson: loadJsonFile,
  savePlanExclusive: saveFrozenPlanExclusive,
  loadHistories: loadExistingShadowHistories,
};

function parseOptions(args: readonly string[]): Map<string, string> {
  const options = new Map<string, string>();
  for (const argument of args) {
    const match = /^--([a-z][a-z0-9-]*)=(.+)$/u.exec(argument);
    if (match === null) throw new Error(`Invalid option: ${argument}`);
    const [, name, value] = match;
    if (name === undefined || value === undefined || options.has(name)) throw new Error(`Duplicate or invalid option: ${argument}`);
    options.set(name, value);
  }
  return options;
}

function exactOptionNames(options: ReadonlyMap<string, string>, names: readonly string[], optional: readonly string[] = []): void {
  const allowed = new Set(names);
  for (const name of options.keys()) if (!allowed.has(name)) throw new Error(`Unknown option: --${name}`);
  for (const name of names) if (!optional.includes(name) && !options.has(name)) throw new Error(`Missing required --${name}=... option.`);
}

function required(options: ReadonlyMap<string, string>, name: string): string {
  const value = options.get(name);
  if (value === undefined || value.length === 0) throw new Error(`Missing required --${name}=... option.`);
  return value;
}
