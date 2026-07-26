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
const allowedExecutable = /^(?:node(?:\.exe)?|python(?:3)?(?:\.exe)?|git(?:\.exe)?)$/iu;
const networkGitAction = /^(?:clone|fetch|pull|push|ls-remote|remote|submodule)$/u;

const executableName = (command) =>
  String(command).replaceAll("\\", "/").split("/").at(-1) ?? "";

const assertChildPolicy = (command, args, options) => {
  const name = executableName(command);
  if (!allowedExecutable.test(name) || options?.shell === true) deny();
  const values = Array.isArray(args) ? args.map(String) : [];
  if (/^git(?:\.exe)?$/iu.test(name) && networkGitAction.test(values[0] ?? "")) {
    deny();
  }
  if (
    /^python(?:3)?(?:\.exe)?$/iu.test(name) &&
    values.some((value) => ["-S", "-E", "-I"].includes(value))
  ) deny();
  if (options?.env !== undefined) {
    if (
      options.env.ALPHA_NETWORK_DISABLED !== "1" ||
      typeof options.env.NODE_OPTIONS !== "string" ||
      !options.env.NODE_OPTIONS.includes("network-disabled-bootstrap.cjs")
    ) deny();
  }
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
