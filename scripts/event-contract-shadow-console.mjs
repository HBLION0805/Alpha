import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { EventContractShadowLedgerService } from "../src/engines/event-contract-shadow-ledger/index.ts";
import { LocalNdjsonEventContractShadowLedgerRepository } from "../src/repositories/LocalNdjsonEventContractShadowLedgerRepository.ts";

function option(name) {
  const prefix = `--${name}=`;
  return process.argv.slice(3).find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

function required(name) {
  const value = option(name);
  if (value === undefined || value.length === 0) throw new Error(`Missing required --${name}=... option.`);
  return value;
}

function loadJson(path) {
  return JSON.parse(readFileSync(resolve(path), "utf8"));
}

const command = process.argv[2];
const rootDirectory = resolve(option("store-dir") ?? "data/runtime/event-contract-shadow");
const repository = new LocalNdjsonEventContractShadowLedgerRepository(rootDirectory);
const service = new EventContractShadowLedgerService(repository);
let result;

if (command === "capture") result = service.capture(loadJson(required("input")), required("accepted-at"));
else if (command === "settle") result = service.settle(loadJson(required("input")), required("accepted-at"));
else if (command === "summary") result = service.summary();
else throw new Error("Command must be capture, settle, or summary.");

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
