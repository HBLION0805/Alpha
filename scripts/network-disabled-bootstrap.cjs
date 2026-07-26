"use strict";

if (process.env.ALPHA_NETWORK_DISABLED !== "1") {
  throw new Error("Alpha network guard requires the fixed disabled policy.");
}

const deny = () => {
  throw new Error("Network access is disabled by the Alpha validation policy.");
};

const childProcess = require("node:child_process");
const originalSpawn = childProcess.spawn;
const originalSpawnSync = childProcess.spawnSync;
const originalExecFile = childProcess.execFile;
const originalExecFileSync = childProcess.execFileSync;
const fs = require("node:fs");
const path = require("node:path");
const allowedGitAction = new Set(["diff", "ls-files", "rev-parse", "status"]);
const fixedExecutables = new Map([
  ["node", process.env.ALPHA_ALLOWED_NODE_EXECUTABLE],
  ["python", process.env.ALPHA_ALLOWED_PYTHON_EXECUTABLE],
  ["git", process.env.ALPHA_ALLOWED_GIT_EXECUTABLE],
]);

const canonicalExecutable = (command) => {
  const value = String(command);
  if (!path.isAbsolute(value)) deny();
  try {
    return fs.realpathSync(value).toLocaleLowerCase();
  } catch {
    deny();
  }
};

const assertChildPolicy = (command, args, options) => {
  if (options?.shell === true) deny();
  const executable = canonicalExecutable(command);
  const role = [...fixedExecutables.entries()].find(([, value]) => {
    if (typeof value !== "string" || !path.isAbsolute(value)) return false;
    try {
      return fs.realpathSync(value).toLocaleLowerCase() === executable;
    } catch {
      return false;
    }
  })?.[0];
  if (role === undefined) deny();
  const values = Array.isArray(args) ? args.map(String) : [];
  if (role === "git" && !allowedGitAction.has(values[0] ?? "")) {
    deny();
  }
  if (
    role === "python" &&
    values.some((value) => ["-S", "-E", "-I"].includes(value))
  ) deny();
  const effectiveEnvironment = options?.env ?? process.env;
  if (
    effectiveEnvironment.ALPHA_NETWORK_DISABLED !== "1" ||
    typeof effectiveEnvironment.NODE_OPTIONS !== "string" ||
    !effectiveEnvironment.NODE_OPTIONS.includes("network-disabled-bootstrap.cjs")
  ) deny();
  if (
    role === "python" &&
    (
      typeof effectiveEnvironment.PYTHONPATH !== "string" ||
      !effectiveEnvironment.PYTHONPATH.includes("network-disabled-python")
    )
  ) deny();
};

childProcess.spawn = function guardedSpawn(command, args, options) {
  assertChildPolicy(command, args, options);
  return originalSpawn.call(this, command, args, options);
};
childProcess.spawnSync = function guardedSpawnSync(command, args, options) {
  assertChildPolicy(command, args, options);
  return originalSpawnSync.call(this, command, args, options);
};
childProcess.execFile = function guardedExecFile(file, args, options, callback) {
  assertChildPolicy(file, args, options);
  return originalExecFile.call(this, file, args, options, callback);
};
childProcess.execFileSync = function guardedExecFileSync(file, args, options) {
  assertChildPolicy(file, args, options);
  return originalExecFileSync.call(this, file, args, options);
};
childProcess.exec = deny;
childProcess.execSync = deny;

const workerThreads = require("node:worker_threads");
workerThreads.Worker = class DisabledWorker {
  constructor() {
    deny();
  }
};

for (const moduleName of [
  "node:http",
  "node:https",
  "node:net",
  "node:tls",
  "node:dgram",
  "node:dns",
]) {
  const target = require(moduleName);
  for (const key of [
    "request",
    "get",
    "connect",
    "createConnection",
    "createServer",
    "createSocket",
    "lookup",
    "resolve",
    "resolve4",
    "resolve6",
  ]) {
    if (typeof target[key] === "function") target[key] = deny;
  }
}

globalThis.fetch = deny;
globalThis.WebSocket = class DisabledWebSocket {
  constructor() {
    deny();
  }
};
process.env.ALPHA_NETWORK_GUARD_ACTIVE = "1";
process.env.ALPHA_SUBPROCESS_GUARD_ACTIVE = "1";
