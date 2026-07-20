import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, normalize, resolve, sep } from "node:path";
import { ValidationReporter } from "./validation-reporting.mjs";

const root = resolve(process.cwd());
const failures = [];
const warnings = [];
const reporter = new ValidationReporter();

const requiredFiles = [
  "AGENTS.md",
  "README.md",
  "docs/DEVELOPMENT_STANDARD.md",
  "docs/CODEX_DEVELOPMENT_STANDARD.md",
  "docs/CODEX_TASK_TEMPLATE.md",
  "docs/OWNER_REVIEW_TEMPLATE.md",
  "docs/ARCHITECTURE.md",
  "docs/CORE_PRINCIPLES.md",
  "docs/ROADMAP.md",
  "docs/HANDOFF.md",
  "docs/DECISIONS.md",
  "docs/CHANGELOG.md",
  "docs/DEVELOPMENT_VALIDATION_LOG_SPECIFICATION.md",
  "docs/HISTORICAL_PATTERN_LIBRARY_SPECIFICATION.md",
  "docs/HISTORICAL_ANALOGY_ENGINE_SPECIFICATION.md",
  "docs/EVENT_REPLAY_ARCHITECTURE_SPECIFICATION.md",
  "docs/PYTHON_TYPESCRIPT_INTEGRATION_BOUNDARY.md",
  "package.json",
  "tsconfig.json"
];

const textExtensions = new Set([
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".py",
  ".ts",
  ".txt",
  ".yaml",
  ".yml"
]);

const aggregateTestFiles = [
  "src/engines/opportunity/OpportunityScoreEngine.test.ts",
  "src/engines/prediction/PredictionEngine.test.ts",
  "src/engines/prediction-log/PredictionLog.test.ts",
  "src/engines/alpha-journal/AlphaJournal.test.ts",
  "src/engines/research-lab/ResearchLab.test.ts",
  "src/engines/strategy-versioning/StrategyVersioning.test.ts",
  "src/engines/development-validation/DevelopmentValidationLog.test.ts",
  "src/engines/historical-pattern-library/HistoricalPatternLibrary.test.ts",
  "src/engines/historical-analogy-engine/HistoricalAnalogyEngine.test.ts",
  "src/engines/event-replay/EventReplayEngine.test.ts",
  "src/engines/historical-evidence-product-surface/HistoricalEvidenceProductSurface.test.ts",
  "src/engines/cross-system-evidence-linking/CrossSystemEvidenceLinkingSurface.test.ts",
  "src/engines/evidence-engine/EvidenceEngine.test.ts",
  "src/engines/strategy-review/StrategyReviewEngine.test.ts",
  "src/integration/python/PythonIntegration.test.ts",
  "src/contracts/AIRouter.test.ts",
  "src/engines/ai-router/AIRouterEngine.test.ts",
  "src/engines/ai-cost-governor/AICostGovernor.test.ts",
  "src/engines/ai-provider-adapter/AIProviderAdapterRegistry.test.ts",
  "src/engines/ai-execution-coordinator/AIExecutionCoordinator.test.ts",
  "src/engines/ai-reservation-manager/AIReservationManager.test.ts",
  "src/engines/ai-cost-ledger/AICostLedger.test.ts",
  "src/engines/ai-audit-repository/AIAuditRepository.test.ts",
  "src/engines/ai-runtime-workflow/AIRuntimeWorkflow.test.ts"
];

const allowedPythonChangePrefixes = process.argv
  .filter((argument) => argument.startsWith("--allow-python-change-prefix="))
  .map((argument) => argument.slice("--allow-python-change-prefix=".length))
  .filter((prefix) => prefix.length > 0)
  .map((prefix) => relativePath(prefix));

function recordFailure(message) {
  failures.push(message);
}

function recordWarning(message) {
  warnings.push(message);
}

function relativePath(path) {
  return path.split(sep).join("/");
}

function output(result) {
  if (typeof result.stdout === "string" && result.stdout.length > 0) {
    process.stdout.write(result.stdout);
  }
  if (typeof result.stderr === "string" && result.stderr.length > 0) {
    process.stderr.write(result.stderr);
  }
}

function run(command, args, component = [command, ...args].join(" ")) {
  console.log(`\n> ${[command, ...args].join(" ")}`);
  const startedAt = Date.now();
  const result = spawnSync(command, args, {
    cwd: root,
    shell: false,
    encoding: "utf8"
  });
  output(result);
  reporter.recordCommand({
    component,
    command: [command, ...args].join(" "),
    exitCode: result.status ?? 1,
    durationMs: Date.now() - startedAt,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`,
  });
  if (result.status !== 0) {
    recordFailure(`${[command, ...args].join(" ")} exited with ${result.status ?? "unknown"}.`);
  }
}

function runNode(args, label) {
  console.log(`\n> ${label}`);
  const startedAt = Date.now();
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    shell: false,
    encoding: "utf8"
  });
  output(result);
  reporter.recordCommand({
    component: label,
    command: [process.execPath, ...args].join(" "),
    exitCode: result.status ?? 1,
    durationMs: Date.now() - startedAt,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`,
  });
  if (result.status !== 0) {
    recordFailure(`${label} exited with ${result.status ?? "unknown"}.`);
  }
}

function runCheck(component, check) {
  const failureCount = failures.length;
  const startedAt = Date.now();
  check();
  reporter.recordCheck({
    component,
    passed: failures.length === failureCount,
    durationMs: Date.now() - startedAt,
  });
}

function capture(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    shell: false,
    encoding: "utf8"
  });
  if (result.status !== 0) {
    recordFailure(`${[command, ...args].join(" ")} exited with ${result.status ?? "unknown"}.`);
    return "";
  }
  return result.stdout;
}

function trackedFiles() {
  const output = capture("git", ["ls-files", "-z"]);
  return output.split("\0").filter(Boolean);
}

function untrackedFiles() {
  const output = capture("git", ["ls-files", "--others", "--exclude-standard", "-z"]);
  return output.split("\0").filter(Boolean);
}

function uniqueFiles(files) {
  return [...new Set(files)].sort();
}

function changedFiles() {
  const output = capture("git", ["diff", "--name-only", "HEAD", "--"]);
  return uniqueFiles([...output.split(/\r?\n/u).filter(Boolean), ...untrackedFiles()]);
}

function readText(file) {
  return readFileSync(join(root, file), "utf8");
}

function checkRequiredFiles() {
  for (const file of requiredFiles) {
    if (!existsSync(join(root, file))) {
      recordFailure(`Required file missing: ${file}`);
    }
  }
}

function checkMarkdown(files) {
  const markdownFiles = files.filter((file) => extname(file).toLowerCase() === ".md");
  const linkPattern = /\[[^\]]+\]\(([^)]+)\)/gu;

  for (const file of markdownFiles) {
    const text = readText(file);
    const lines = text.split(/\r?\n/u);
    let backtickFenceOpen = false;
    let tildeFenceOpen = false;

    lines.forEach((line, index) => {
      if (/^\s*```/u.test(line)) {
        backtickFenceOpen = !backtickFenceOpen;
      }
      if (/^\s*~~~/u.test(line)) {
        tildeFenceOpen = !tildeFenceOpen;
      }
      if (/[ \t]+$/u.test(line)) {
        recordFailure(`${file}:${index + 1} has trailing whitespace.`);
      }
    });

    if (backtickFenceOpen) {
      recordFailure(`${file} has an unbalanced backtick code fence.`);
    }
    if (tildeFenceOpen) {
      recordFailure(`${file} has an unbalanced tilde code fence.`);
    }

    for (const match of text.matchAll(linkPattern)) {
      const target = (match[1] ?? "").trim();
      if (
        target === "" ||
        target.startsWith("#") ||
        /^[a-z][a-z0-9+.-]*:/iu.test(target)
      ) {
        continue;
      }

      const withoutTitle = target.replace(/\s+"[^"]*"$/u, "");
      const cleanTarget = withoutTitle.replace(/^<|>$/gu, "").split("#")[0]?.trim() ?? "";
      if (cleanTarget === "") {
        continue;
      }

      const candidate = normalize(join(root, dirname(file), cleanTarget));
      if (!candidate.startsWith(root + sep) && candidate !== root) {
        recordFailure(`${file} links outside repository: ${target}`);
        continue;
      }
      if (!existsSync(candidate)) {
        recordFailure(`${file} has a broken local link: ${target}`);
      }
    }
  }
}

function checkProviderSdk() {
  const packageJson = JSON.parse(readText("package.json"));
  const dependencyNames = Object.keys({
    ...(packageJson.dependencies ?? {}),
    ...(packageJson.devDependencies ?? {}),
    ...(packageJson.optionalDependencies ?? {})
  });
  const bannedPackages = [
    "openai",
    "@anthropic-ai/sdk",
    "@google/generative-ai",
    "@google/genai",
    "google-generative-ai",
    "cohere-ai",
    "@cohere-ai/sdk",
    "mistralai",
    "groq-sdk",
    "together-ai",
    "replicate"
  ];
  for (const name of dependencyNames) {
    if (bannedPackages.includes(name.toLowerCase())) {
      recordFailure(`Provider SDK dependency found: ${name}`);
    }
  }
}

function checkNetworkAndProviderCode(files) {
  const productionFiles = files.filter((file) => {
    const extension = extname(file).toLowerCase();
    return [".ts", ".js", ".mjs", ".py"].includes(extension) && !file.endsWith(".test.ts") && !relativePath(file).startsWith("scripts/");
  });

  const providerImportPattern = /\b(?:from\s+["']|import\s*\(?\s*["']|require\s*\(\s*["'])(openai|@anthropic-ai\/sdk|@google\/generative-ai|@google\/genai|google-generative-ai|cohere-ai|@cohere-ai\/sdk|mistralai|groq-sdk|together-ai|replicate)["']/iu;
  const networkPattern = /\b(fetch\s*\(|XMLHttpRequest|WebSocket|EventSource|axios|node:https|node:http|require\s*\(\s*["']https?["']|https?\.request|requests\.|urllib\.request|aiohttp|socket\.)/iu;

  for (const file of productionFiles) {
    const text = readText(file);
    if (providerImportPattern.test(text)) {
      recordFailure(`Provider SDK import found in production code: ${file}`);
    }
    if (networkPattern.test(text)) {
      recordFailure(`Network/API implementation pattern found in production code: ${file}`);
    }
  }
}

function checkSecrets(files) {
  const secretPattern = /(sk-[A-Za-z0-9_-]{20,}|AIza[0-9A-Za-z_-]{20,}|-----BEGIN (?:RSA |EC |OPENSSH |)?PRIVATE KEY-----|xox[baprs]-[0-9A-Za-z-]{20,})/u;
  for (const file of files) {
    if (!textExtensions.has(extname(file).toLowerCase())) {
      continue;
    }
    const text = readText(file);
    if (secretPattern.test(text)) {
      recordFailure(`Possible credential or private key found: ${file}`);
    }
  }
}

function checkRuntimeData(files) {
  for (const file of files) {
    if (relativePath(file).startsWith("data/runtime/")) {
      recordFailure(`Runtime data is tracked by Git: ${file}`);
    }
  }
}

function checkPythonChanges() {
  for (const file of changedFiles()) {
    const normalizedFile = relativePath(file);
    const allowed = allowedPythonChangePrefixes.some((prefix) =>
      normalizedFile.startsWith(prefix)
    );
    if (extname(file).toLowerCase() === ".py" && !allowed) {
      recordFailure(`Python file changed in working tree: ${file}`);
    }
  }
}

function checkMergeMarkers(files) {
  const markerPattern = /^(<<<<<<<|=======|>>>>>>>) /mu;
  for (const file of files) {
    if (!textExtensions.has(extname(file).toLowerCase())) {
      continue;
    }
    if (markerPattern.test(readText(file))) {
      recordFailure(`Merge marker found: ${file}`);
    }
  }
}

function checkGitStatus() {
  const status = capture("git", ["status", "--short"]);
  if (status.trim() !== "") {
    recordWarning("Working tree has changes. This is expected during an uncommitted task but must be reviewed before commit.");
  }
}

function checkFileReadability(files) {
  for (const file of files) {
    const path = join(root, file);
    if (!existsSync(path)) {
      recordFailure(`Tracked file missing from working tree: ${file}`);
      continue;
    }
    if (!statSync(path).isFile()) {
      recordFailure(`Tracked path is not a file: ${file}`);
    }
  }
}

console.log("Alpha validation bundle");
runCheck("Required files", checkRequiredFiles);
const files = uniqueFiles([...trackedFiles(), ...untrackedFiles()]);
runCheck("Tracked-file readability", () => checkFileReadability(files));

runNode(["node_modules/typescript/bin/tsc", "--project", "tsconfig.json"], "TypeScript strict typecheck");
for (const file of aggregateTestFiles) {
  runNode(["node_modules/tsx/dist/cli.mjs", file], `Focused/aggregate test: ${file}`);
}
runNode(["scripts/run-python-integration-tests.mjs"], "Focused Python integration tests");
runNode(["scripts/validation-reporting.test.mjs"], "Validation Reporting tests");

runCheck("Markdown links, paths, and fences", () => checkMarkdown(files));
runCheck("Provider SDK dependencies", checkProviderSdk);
runCheck("Provider and network code", () => checkNetworkAndProviderCode(files));
runCheck("Credential scan", () => checkSecrets(files));
runCheck("Runtime-data tracking", () => checkRuntimeData(files));
runCheck("Python change scope", checkPythonChanges);
runCheck("Merge markers", () => checkMergeMarkers(files));
run("git", ["diff", "--check"], "Git diff check");
runCheck("Working tree status", checkGitStatus);

if (warnings.length > 0) {
  console.log("\nWarnings:");
  for (const warning of warnings) {
    console.log(`- ${warning}`);
    reporter.addWarning(warning);
  }
}

reporter.recordCheck({
  component: "Validation bundle outcome",
  passed: failures.length === 0,
});
console.log("\nUnified validation report:");
console.log(JSON.stringify(reporter.build(), null, 2));

if (failures.length > 0) {
  console.error("\nFailures:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("\nAlpha validation bundle passed.");
