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
const crypto = require("node:crypto");
const repositoryRoot = fs.realpathSync(
  process.env.ALPHA_VALIDATION_REPOSITORY_ROOT ?? "",
);
const exactGitInvocations = new Set([
  JSON.stringify(["rev-parse", "HEAD"]),
  JSON.stringify(["status", "--porcelain", "--untracked-files=all"]),
  JSON.stringify(["status", "--short"]),
  JSON.stringify(["ls-files", "-z"]),
  JSON.stringify(["ls-files", "--others", "--exclude-standard", "-z"]),
  JSON.stringify(["diff", "--no-ext-diff", "--no-textconv", "--name-only", "HEAD", "--"]),
  JSON.stringify(["diff", "--no-ext-diff", "--no-textconv", "--check"]),
  JSON.stringify(["diff", "--no-ext-diff", "--no-textconv", "--cached", "--check"]),
]);
const fixedExecutables = new Map([
  ["node", {
    path: process.env.ALPHA_ALLOWED_NODE_EXECUTABLE,
    fingerprint: process.env.ALPHA_ALLOWED_NODE_FINGERPRINT,
  }],
  ["python", {
    path: process.env.ALPHA_ALLOWED_PYTHON_EXECUTABLE,
    fingerprint: process.env.ALPHA_ALLOWED_PYTHON_FINGERPRINT,
  }],
  ["git", {
    path: process.env.ALPHA_ALLOWED_GIT_EXECUTABLE,
    fingerprint: process.env.ALPHA_ALLOWED_GIT_FINGERPRINT,
  }],
]);

const fingerprint = (file) =>
  `sha256:${crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")}`;

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
  const role = [...fixedExecutables.entries()].find(([, identity]) => {
    const value = identity.path;
    if (
      typeof value !== "string" ||
      typeof identity.fingerprint !== "string" ||
      !path.isAbsolute(value)
    ) return false;
    try {
      const canonical = fs.realpathSync(value);
      return (
        canonical.toLocaleLowerCase() === executable &&
        fingerprint(canonical) === identity.fingerprint
      );
    } catch {
      return false;
    }
  })?.[0];
  if (role === undefined) deny();
  const values = Array.isArray(args) ? args.map(String) : [];
  if (role === "git" && !exactGitInvocations.has(JSON.stringify(values))) {
    deny();
  }
  if (role === "node") {
    const entry = values[0];
    const candidate =
      typeof entry === "string" ? path.resolve(repositoryRoot, entry) : "";
    const relative = path.relative(repositoryRoot, candidate).replaceAll("\\", "/");
    if (
      typeof entry !== "string" ||
      relative.startsWith("../") ||
      path.isAbsolute(relative) ||
      !fs.realpathSync(candidate).startsWith(`${repositoryRoot}${path.sep}`)
    ) deny();
    if (
      relative === "node_modules/typescript/bin/tsc" &&
      JSON.stringify(values.slice(1)) !==
        JSON.stringify(["--project", "tsconfig.json"])
    ) deny();
    else if (
      relative === "node_modules/tsx/dist/cli.mjs" &&
      (
        values.length !== 2 ||
        !/^src\/[A-Za-z0-9_./-]+\.test\.ts$/u.test(
          values[1].replaceAll("\\", "/"),
        )
      )
    ) deny();
    else if (
      ![
        "node_modules/typescript/bin/tsc",
        "node_modules/tsx/dist/cli.mjs",
        "scripts/run-python-integration-tests.mjs",
        "scripts/validation-reporting.test.mjs",
      ].includes(relative) ||
      (
        relative.startsWith("scripts/") &&
        values.length !== 1
      )
    ) deny();
  }
  if (
    role === "python" &&
    JSON.stringify(values) !== JSON.stringify([
      "-m", "unittest", "discover", "-s", "tests",
      "-p", "test_python_integration.py", "-v",
    ])
  ) deny();
  const effectiveEnvironment = options?.env ?? process.env;
  if (
    role === "git" &&
    (
      fs.realpathSync(options?.cwd ?? process.cwd()) !== repositoryRoot ||
      Object.keys(effectiveEnvironment).some((key) =>
        /^GIT_/iu.test(key) &&
        ![
          "GIT_CONFIG_NOSYSTEM",
          "GIT_CONFIG_GLOBAL",
        ].includes(key)
      ) ||
      effectiveEnvironment.GIT_CONFIG_NOSYSTEM !== "1" ||
      effectiveEnvironment.GIT_CONFIG_GLOBAL !== "NUL"
    )
  ) deny();
  if (
    effectiveEnvironment.ALPHA_NETWORK_DISABLED !== "1" ||
    typeof effectiveEnvironment.NODE_OPTIONS !== "string" ||
    effectiveEnvironment.NODE_OPTIONS !==
      `--require=${process.env.ALPHA_NODE_GUARD_PATH}` ||
    fingerprint(process.env.ALPHA_NODE_GUARD_PATH) !==
      process.env.ALPHA_NODE_GUARD_FINGERPRINT
  ) deny();
  if (
    role === "python" &&
    (
      typeof effectiveEnvironment.PYTHONPATH !== "string" ||
      effectiveEnvironment.PYTHONPATH !==
        path.dirname(process.env.ALPHA_PYTHON_GUARD_PATH) ||
      fingerprint(process.env.ALPHA_PYTHON_GUARD_PATH) !==
        process.env.ALPHA_PYTHON_GUARD_FINGERPRINT
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
