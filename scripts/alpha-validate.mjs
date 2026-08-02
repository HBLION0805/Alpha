import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, normalize, resolve, sep } from "node:path";
import { ValidationReporter } from "./validation-reporting.mjs";

if (process.env.ALPHA_REHEARSAL_OPERATION_PROCESS === "1") {
  throw new Error(
    "The Alpha validation bundle cannot run inside a rehearsal-operation phase process.",
  );
}
if (
  process.env.ALPHA_FIXED_VALIDATION_PROCESS === "1" &&
  (
    process.env.ALPHA_NETWORK_DISABLED !== "1" ||
    process.env.ALPHA_NETWORK_GUARD_ACTIVE !== "1"
  )
) {
  throw new Error(
    "Fixed rehearsal validation requires the active network-disabled guard.",
  );
}

const root = resolve(process.cwd());
const gitExecutable =
  process.env.ALPHA_FIXED_VALIDATION_PROCESS === "1"
    ? process.env.ALPHA_FIXED_GIT_EXECUTABLE
    : "git";
if (
  typeof gitExecutable !== "string" ||
  gitExecutable.length === 0
) {
  throw new Error("Fixed validation requires a registered Git executable.");
}
const failures = [];
const warnings = [];
const reporter = new ValidationReporter();
const gitWhitespaceChecks = Object.freeze([
  Object.freeze({ args: Object.freeze(["diff", "--no-ext-diff", "--no-textconv", "--check"]), label: "Unstaged Git diff whitespace" }),
  Object.freeze({ args: Object.freeze(["diff", "--no-ext-diff", "--no-textconv", "--cached", "--check"]), label: "Staged Git diff whitespace" }),
]);

const requiredFiles = [
  "AGENTS.md",
  "README.md",
  "docs/DEVELOPMENT_STANDARD.md",
  "docs/CODEX_DEVELOPMENT_STANDARD.md",
  "docs/CODEX_TASK_TEMPLATE.md",
  "docs/OWNER_REVIEW_TEMPLATE.md",
  "docs/status/current.json",
  "docs/status/current.schema.json",
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
  "docs/specifications/CANONICAL_INSTRUMENT.md",
  "docs/specifications/CANONICAL_QUOTE.md",
  "docs/specifications/CANONICAL_BAR.md",
  "docs/specifications/MARKET_DATA_LAYER.md",
  "docs/specifications/PROVIDER_REGISTRY.md",
  "docs/specifications/TWELVE_DATA_ADAPTER.md",
  "docs/specifications/TWELVE_DATA_LIVE_SMOKE.md",
  "docs/specifications/PERSONAL_DAILY_SCAN_PHASE_1B_AUTHORIZATION_AND_CALENDAR.md",
  "docs/specifications/ALPACA_BARS_LIMIT_QUALIFICATION.md",
  "docs/specifications/MARKET_REGIME_ENGINE.md",
  "docs/specifications/BROAD_MARKET_EVIDENCE.md",
  "docs/specifications/EVIDENCE_FUSION.md",
  "docs/specifications/EVENT_ANALYZER_CONSOLE.md",
  "docs/specifications/CAPITAL_ALLOCATION_FRAMEWORK.md",
  "docs/specifications/EVENT_CONTRACT_OBSERVATION.md",
  "docs/specifications/EVENT_CONTRACT_SHADOW_LEDGER.md",
  "docs/specifications/RESEARCH_INTEGRITY.md",
  "docs/specifications/RESEARCH_DATASET_QUALIFICATION.md",
  "docs/specifications/RESEARCH_SHADOW_DATASET_ASSEMBLY.md",
  "docs/specifications/FORWARD_SHADOW_COLLECTION_CONTROL.md",
  "docs/specifications/FORWARD_SHADOW_COLLECTION_OPERATOR.md",
  "docs/specifications/EVENT_CONTRACT_COLLECTION_SOURCE_ARCHITECTURE.md",
  "docs/specifications/EVENT_CONTRACT_SOURCE_CONTRACTS.md",
  "docs/specifications/KALSHI_EVENT_CONTRACT_FIXTURE_ADAPTER.md",
  "docs/specifications/KALSHI_EVENT_CONTRACT_LIVE_SMOKE.md",
  "docs/specifications/EVENT_CONTRACT_COLLECTION_RUNNER_ARCHITECTURE.md",
  "docs/specifications/EVENT_CONTRACT_COLLECTION_RUNNER_CONTRACTS.md",
  "docs/specifications/EVENT_CONTRACT_COLLECTION_RUNNER_SQLITE.md",
  "docs/specifications/EVENT_CONTRACT_COLLECTION_RUNNER_RUNTIME_ASSEMBLY_RECOVERY.md",
  "docs/specifications/EVENT_CONTRACT_COLLECTION_RUNNER_OWNER_GATED_REHEARSAL_OPERATION.md",
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
  "scripts/validate-current-status.test.mjs",
  "src/engines/opportunity/OpportunityScoreEngine.test.ts",
  "src/engines/personal-decision/PersonalDecisionEngine.test.ts",
  "src/engines/personal-candidate-scan/PersonalCandidateScanEngine.test.ts",
  "src/engines/personal-watchlist-mapping/PersonalWatchlistMappingRegistry.test.ts",
  "src/engines/personal-market-data-composition/PersonalMarketDataCompositionEngine.test.ts",
  "src/engines/verified-market-snapshot/VerifiedMarketSnapshotEngine.test.ts",
  "src/engines/personal-daily-scan/PersonalDailyScanApplication.test.ts",
  "src/engines/personal-daily-scan/PersonalDailyScanLiveReadonlyPreflight.test.ts",
  "src/engines/personal-daily-scan/PersonalDailyScanLiveReadonlyMarketScope.test.ts",
  "src/engines/personal-daily-scan/AlpacaBarsLimitQualification.test.ts",
  "scripts/alpha-daily-scan.test.mjs",
  "src/engines/personal-market-data-provider-coverage/PersonalMarketDataProviderCoverageEngine.test.ts",
  "src/engines/personal-market-data-alternative-provider-qualification/PersonalMarketDataAlternativeProviderQualificationEngine.test.ts",
  "src/engines/personal-market-data-twelve-data-qualification/PersonalMarketDataTwelveDataQualificationEngine.test.ts",
  "src/engines/personal-market-data-provider-qualification-closure/PersonalMarketDataProviderQualificationClosureEngine.test.ts",
  "src/engines/personal-market-data-zero-cost-provider-screening/PersonalMarketDataZeroCostProviderScreeningEngine.test.ts",
  "src/integration/market-data/alpaca/AlpacaPersonalMarketDataAdapter.test.ts",
  "src/integration/market-data/alpaca/AlpacaPersonalMarketDataNormalizer.test.ts",
  "src/integration/market-data/alpaca/AlpacaCredentials.test.ts",
  "src/integration/market-data/alpaca/AlpacaHttpsTransport.test.ts",
  "src/integration/market-data/alpaca/AlpacaTransportDryRun.test.ts",
  "src/integration/market-data/alpaca/AlpacaPersonalMarketDataLiveSmoke.test.ts",
  "src/integration/market-data/alpaca/AlpacaPersonalMarketDataLiveSmokeCommand.test.ts",
  "src/integration/market-data/alpaca/AlpacaPersonalAssetMetadataDiagnostic.test.ts",
  "src/integration/market-data/alpaca/AlpacaPersonalAssetMetadataTransport.test.ts",
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
  "src/engines/knowledge-approval/KnowledgeApprovalService.test.ts",
  "src/engines/canonical-instrument/CanonicalInstrument.test.ts",
  "src/engines/canonical-quote/CanonicalQuote.test.ts",
  "src/engines/canonical-bar/CanonicalBar.test.ts",
  "src/engines/market-data/MarketDataService.test.ts",
  "src/engines/market-data-provider-registry/MarketDataProviderRegistry.test.ts",
  "src/engines/market-data-provider-composition/MarketDataProviderComposition.test.ts",
  "src/engines/market-regime/MarketRegimeEngine.test.ts",
  "src/engines/broad-market-evidence/BroadMarketEvidenceEngine.test.ts",
  "src/engines/evidence-fusion/EvidenceFusionEngine.test.ts",
  "src/engines/event-analyzer/EventAnalyzerEngine.test.ts",
  "src/engines/capital-allocation/CapitalAllocationFramework.test.ts",
  "src/engines/event-contract-observation/EventContractObservationEngine.test.ts",
  "src/engines/event-contract-shadow-ledger/EventContractShadowLedgerEngine.test.ts",
  "src/engines/research-integrity/ResearchIntegrityEngine.test.ts",
  "src/engines/research-dataset-qualification/ResearchDatasetQualificationEngine.test.ts",
  "src/engines/research-shadow-dataset-assembly/ResearchShadowDatasetAssemblyEngine.test.ts",
  "src/engines/forward-shadow-collection-control/ForwardShadowCollectionControlEngine.test.ts",
  "src/engines/forward-shadow-collection-control/ForwardShadowCollectionControlConsole.test.ts",
  "src/engines/event-contract-source/EventContractSourceEngine.test.ts",
  "src/engines/event-contract-collection-runner/EventContractCollectionRunnerEngine.test.ts",
  "src/repositories/EventContractCollectionRunnerSqliteStore.test.ts",
  "src/repositories/SqliteEventContractCollectionRunnerRecoveryControlRepository.test.ts",
  "src/repositories/EventContractCollectionRunnerRecoveryControlDrill.test.ts",
  "src/repositories/SqliteEventContractCollectionRunnerRepository.test.ts",
  "src/repositories/EventContractCollectionRunnerSqliteRecovery.test.ts",
  "src/engines/event-contract-collection-runner-recovery-control/EventContractCollectionRunnerRecoveryControlEngine.test.ts",
  "src/engines/event-contract-collection-runner-runtime/EventContractCollectionRunnerRuntimeFoundation.test.ts",
  "src/engines/event-contract-collection-runner-runtime/EventContractCollectionRunnerRuntimeExecution.test.ts",
  "src/engines/event-contract-collection-runner-runtime/EventContractCollectionRunnerRuntimeOperator.test.ts",
  "src/repositories/EventContractCollectionRunnerRuntimeProjectionRepository.test.ts",
  "src/engines/event-contract-collection-runner-runtime/EventContractCollectionRunnerRuntimeProcessDrill.test.ts",
  "src/engines/event-contract-collection-runner-runtime/EventContractCollectionRunnerRuntimeAssemblyPlanner.test.ts",
  "src/engines/event-contract-collection-runner-runtime/EventContractCollectionRunnerRuntimeForegroundStep.test.ts",
  "src/engines/event-contract-collection-runner-runtime/EventContractCollectionRunnerRuntimeTransactionDrill.test.ts",
  "src/engines/event-contract-collection-runner-runtime/EventContractCollectionRunnerRuntimeOwnershipRecovery.test.ts",
  "src/engines/event-contract-collection-runner-fixture-rehearsal/EventContractCollectionRunnerFixtureRehearsalEngine.test.ts",
  "src/engines/event-contract-collection-runner-fixture-rehearsal/EventContractCollectionRunnerFixtureRehearsalPreparation.test.ts",
  "src/engines/event-contract-collection-runner-fixture-rehearsal/EventContractCollectionRunnerFixtureRehearsalStep.test.ts",
  "src/engines/event-contract-collection-runner-fixture-rehearsal/EventContractCollectionRunnerFixtureRehearsalPackage.test.ts",
  "src/engines/event-contract-collection-runner-fixture-rehearsal/EventContractCollectionRunnerFixtureRehearsalPackageProcessDrill.test.ts",
  "src/engines/event-contract-collection-runner-durable-fixture-rehearsal/EventContractCollectionRunnerDurableFixtureRehearsalEngine.test.ts",
  "src/engines/event-contract-collection-runner-durable-fixture-rehearsal/EventContractCollectionRunnerDurableFixtureRehearsalCoordinator.test.ts",
  "src/engines/event-contract-collection-runner-durable-fixture-rehearsal/EventContractCollectionRunnerDurableFixtureRehearsalStepAdapter.test.ts",
  "src/engines/event-contract-collection-runner-durable-fixture-rehearsal/EventContractCollectionRunnerDurableFixtureRehearsalEvidence.test.ts",
  "src/engines/event-contract-collection-runner-durable-fixture-rehearsal/EventContractCollectionRunnerDurableFixtureRehearsalProcessDrill.test.ts",
  "src/engines/event-contract-collection-runner-durable-fixture-rehearsal/EventContractCollectionRunnerDurableFixtureRehearsalC1ProcessDrill.test.ts",
  "src/engines/event-contract-collection-runner-durable-fixture-rehearsal/EventContractCollectionRunnerDurableFixtureRehearsalC2ProcessDrill.test.ts",
  "src/engines/event-contract-collection-runner-durable-fixture-rehearsal/EventContractCollectionRunnerDurableFixtureRehearsalC3ProcessDrill.test.ts",
  "src/engines/event-contract-collection-runner-rehearsal-operation/EventContractCollectionRunnerRehearsalOperationEngine.test.ts",
  "src/engines/event-contract-collection-runner-rehearsal-operation-control/EventContractCollectionRunnerRehearsalOperationControlEngine.test.ts",
  "src/engines/event-contract-collection-runner-rehearsal-operation-control/EventContractCollectionRunnerRehearsalOperationVerification.test.ts",
  "src/engines/event-contract-collection-runner-rehearsal-operation-control/EventContractCollectionRunnerRehearsalOperationSecurityProcessDrill.test.ts",
  "src/engines/event-contract-collection-runner-rehearsal-operation-control/EventContractCollectionRunnerRehearsalOperationC3Authority.test.ts",
  "src/engines/event-contract-collection-runner-rehearsal-operation-control/EventContractCollectionRunnerRehearsalOperationC4Authority.test.ts",
  "src/repositories/EventContractCollectionRunnerFixtureRehearsalSqliteMigrationV3.test.ts",
  "src/integration/event-contract/kalshi/KalshiEventContractFixtureAdapter.test.ts",
  "src/integration/event-contract/kalshi/KalshiPublicHttpsTransport.test.ts",
  "src/integration/event-contract/kalshi/KalshiEventContractLiveSmoke.test.ts",
  "src/integration/market-data/twelve-data/TwelveDataResponseParser.test.ts",
  "src/integration/market-data/twelve-data/TwelveDataResponseValidator.test.ts",
  "src/integration/market-data/twelve-data/TwelveDataBarNormalizer.test.ts",
  "src/integration/market-data/twelve-data/TwelveDataBarAdapter.test.ts",
  "src/integration/market-data/twelve-data/TwelveDataPersonalMulsReferenceDiagnostic.test.ts",
  "src/integration/market-data/twelve-data/TwelveDataPersonalMulsReferenceErrorDiagnostic.test.ts",
  "src/integration/market-data/twelve-data/TwelveDataPersonalMulsReferenceHttpsTransport.test.ts",
  "src/integration/market-data/twelve-data/TwelveDataPersonalMulsReferenceLiveOperation.test.ts",
  "src/integration/market-data/twelve-data/TwelveDataPersonalMulsReferenceCommand.test.ts",
  "src/integration/market-data/twelve-data/TwelveDataCredentials.test.ts",
  "src/integration/market-data/twelve-data/TwelveDataHttpsTransport.test.ts",
  "src/integration/market-data/twelve-data/TwelveDataLiveSmokePolicy.test.ts",
  "src/integration/market-data/twelve-data/TwelveDataLiveSmokeDryRun.test.ts",
  "src/integration/market-data/twelve-data/TwelveDataLiveSmokeCommand.test.ts",
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
const fixedValidationPythonFiles = new Set([
  "scripts/network-disabled-python/sitecustomize.py",
]);

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
  const output = capture(gitExecutable, ["ls-files", "-z"]);
  return output.split("\0").filter(Boolean);
}

function untrackedFiles() {
  const output = capture(gitExecutable, ["ls-files", "--others", "--exclude-standard", "-z"]);
  return output.split("\0").filter(Boolean);
}

function uniqueFiles(files) {
  return [...new Set(files)].sort();
}

function changedFiles() {
  const output = capture(gitExecutable, ["diff", "--no-ext-diff", "--no-textconv", "--name-only", "HEAD", "--"]);
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
    "replicate",
    "@polygon.io/client-js",
    "@alpacahq/alpaca-trade-api",
    "finnhub",
    "twelvedata",
    "twelvedata-js"
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

  const providerImportPattern = /\b(?:from\s+["']|import\s*\(?\s*["']|require\s*\(\s*["'])(openai|@anthropic-ai\/sdk|@google\/generative-ai|@google\/genai|google-generative-ai|cohere-ai|@cohere-ai\/sdk|mistralai|groq-sdk|together-ai|replicate|@polygon\.io\/client-js|@alpacahq\/alpaca-trade-api|finnhub|twelvedata|twelvedata-js)["']/iu;
  const networkPattern = /\b(fetch\s*\(|fetchFunction\s*\(|XMLHttpRequest|WebSocket|EventSource|axios|node:https|node:http|require\s*\(\s*["']https?["']|https?\.request|requests\.|urllib\.request|aiohttp|socket\.)/iu;
  const twelveDataConcreteTransportPattern = /\bclass\s+[A-Za-z0-9_]+\s+implements\s+TwelveDataHttpTransport\b/u;
  const alpacaConcreteTransportPattern = /\bclass\s+[A-Za-z0-9_]+\s+implements\s+AlpacaHttpTransport\b/u;
  const approvedTwelveDataTransport = "src/integration/market-data/twelve-data/TwelveDataHttpsTransport.ts";
  const approvedTwelveDataMulsReferenceTransport = "src/integration/market-data/twelve-data/TwelveDataPersonalMulsReferenceHttpsTransport.ts";
  const approvedKalshiTransport = "src/integration/event-contract/kalshi/KalshiPublicHttpsTransport.ts";
  const approvedAlpacaTransport = "src/integration/market-data/alpaca/AlpacaHttpsTransport.ts";
  const approvedAlpacaAssetMetadataTransport = "src/integration/market-data/alpaca/AlpacaPersonalAssetMetadataTransport.ts";
  const approvedAlpacaBarsLimitQualificationTransport = "src/integration/market-data/alpaca/AlpacaBarsLimitQualificationHttpsTransport.ts";
  const approvedLiveTransports = new Set([
    approvedTwelveDataTransport,
    approvedTwelveDataMulsReferenceTransport,
    approvedKalshiTransport,
    approvedAlpacaTransport,
    approvedAlpacaAssetMetadataTransport,
    approvedAlpacaBarsLimitQualificationTransport,
  ]);

  for (const file of productionFiles) {
    const text = readText(file);
    if (providerImportPattern.test(text)) {
      recordFailure(`Provider SDK import found in production code: ${file}`);
    }
    const normalizedFile = relativePath(file);
    if (networkPattern.test(text) && !approvedLiveTransports.has(normalizedFile)) {
      recordFailure(`Network/API implementation pattern found in production code: ${file}`);
    }
    if (twelveDataConcreteTransportPattern.test(text)
      && !normalizedFile.endsWith("TwelveDataTestFixtures.ts")
      && normalizedFile !== approvedTwelveDataTransport) {
      recordFailure(`Unapproved concrete Twelve Data transport found in production code: ${file}`);
    }
    if (alpacaConcreteTransportPattern.test(text) && normalizedFile !== approvedAlpacaTransport) {
      recordFailure(`Unapproved concrete Alpaca transport found in production code: ${file}`);
    }
    if (approvedLiveTransports.has(normalizedFile)) {
      const requiredControls = normalizedFile === approvedTwelveDataTransport
        ? [
            "https://api.twelvedata.com/time_series",
            'redirect: "error"',
            "TwelveDataTransportErrorCode.Timeout",
            "MAX_RESPONSE_BYTES",
          ]
        : normalizedFile === approvedTwelveDataMulsReferenceTransport ? [
            "TWELVE_DATA_PERSONAL_MULS_REFERENCE_ENDPOINT",
            "const credential = credentials.revealForTransport()",
            "Authorization: `apikey ${credential}`",
            'redirect: "error"',
            "TwelveDataPersonalMulsReferenceTransportErrorCode.Timeout",
            "maxResponseCharacters",
          ]
        : normalizedFile === approvedKalshiTransport ? [
            "https://external-api.kalshi.com/trade-api/v2/markets/",
            "KXBTC15M-26JUL232045-45",
            'redirect: "error"',
            "KalshiPublicTransportErrorCode.Timeout",
            "MAX_RESPONSE_BYTES",
          ]
        : normalizedFile === approvedAlpacaAssetMetadataTransport ? [
            "paper-api.alpaca.markets",
            "ALPACA_PERSONAL_MULS_ASSET_ENDPOINT",
            'redirect: "error"',
            "AlpacaPersonalAssetMetadataTransportErrorCode.Timeout",
            "MAX_RESPONSE_BYTES",
          ]
        : normalizedFile === approvedAlpacaBarsLimitQualificationTransport ? [
            "https://data.alpaca.markets/v2/stocks/bars",
            'redirect: "error"',
            "readBounded",
            "maximumResponseBytes",
            "loadAlpacaCredentials",
          ]
        : [
            "https://data.alpaca.markets/v2/stocks/bars",
            "https://data.alpaca.markets/v2/stocks/quotes/latest",
            'redirect: "error"',
            "AlpacaTransportErrorCode.Timeout",
            "MAX_RESPONSE_BYTES",
          ];
      for (const control of requiredControls) {
        if (!text.includes(control)) recordFailure(`Approved live transport is missing safety control ${control}: ${file}`);
      }
      if (/\b(setInterval|WebSocket|EventSource|node:http|http:\/\/|writeFile|appendFile)\b/u.test(text)) {
        recordFailure(`Forbidden polling, streaming, insecure transport, or persistence pattern found: ${file}`);
      }
    }
  }
}

function checkSecrets(files) {
  const secretPattern = /(sk-[A-Za-z0-9_-]{20,}|AIza[0-9A-Za-z_-]{20,}|-----BEGIN (?:RSA |EC |OPENSSH |)?PRIVATE KEY-----|xox[baprs]-[0-9A-Za-z-]{20,})/u;
  for (const file of files) {
    const normalizedFile = relativePath(file);
    if ((normalizedFile.endsWith("/.env") || normalizedFile === ".env") && !normalizedFile.endsWith(".example")) {
      recordFailure(`Tracked environment credential file found: ${file}`);
    }
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
    const allowed = fixedValidationPythonFiles.has(normalizedFile) ||
      allowedPythonChangePrefixes.some((prefix) =>
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
  const status = capture(gitExecutable, ["status", "--short"]);
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
// A reviewed move/deletion remains in `git ls-files` until commit; scan only paths
// that still exist while required-file and final working-tree checks retain scope control.
const files = uniqueFiles([...trackedFiles(), ...untrackedFiles()])
  .filter((file) => existsSync(join(root, file)));
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
runCheck("Git whitespace check coverage", () => {
  const commands = gitWhitespaceChecks.map((check) => check.args.join(" "));
  if (
    !commands.includes("diff --no-ext-diff --no-textconv --check") ||
    !commands.includes("diff --no-ext-diff --no-textconv --cached --check") ||
    commands.length !== 2
  ) {
    throw new Error("Validation must retain separate unstaged and staged whitespace checks.");
  }
});
for (const check of gitWhitespaceChecks) {
  run(gitExecutable, [...check.args], check.label);
}
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
