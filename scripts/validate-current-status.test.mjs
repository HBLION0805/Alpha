import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { validateCurrentStatus } from "./validate-current-status.mjs";

const root = resolve(import.meta.dirname, "..");
const status = JSON.parse(readFileSync(resolve(root, "docs/status/current.json"), "utf8"));
const schema = JSON.parse(readFileSync(resolve(root, "docs/status/current.schema.json"), "utf8"));

const tests = [
  ["Owner stop basis and probability gate cannot become trading authority", () => {
    const changed = clone(status);
    changed.ownerOptionsProfile.plannedStopBasis = "ACCOUNT_EQUITY";
    changed.ownerOptionsProfile.conditionalEscalation = "ENABLED_BY_AI_SCORE";
    changed.ownerOptionsProfile.executionAllowed = true;
    const validation = validateCurrentStatus(changed, schema);
    assert.equal(validation.valid, false);
    for (const field of ["plannedStopBasis", "conditionalEscalation", "executionAllowed"]) {
      assert(validation.issues.some((issue) => issue.includes(`ownerOptionsProfile.${field}`)));
    }
  }],
  ["GLD and IBIT scope is required even with a weakened JSON schema", () => {
    const changed = clone(status);
    changed.ownerOptionsProfile.intendedUnderlyings = ["QQQ"];
    const weakened = clone(schema);
    weakened.$defs.ownerOptionsProfile = {};
    assert.equal(validateCurrentStatus(changed, weakened).valid, false);
  }],
  ["Phase 2 fixture implementation cannot self-approve or enable later phases", () => {
    const changed = clone(status);
    changed.currentMilestone.status = "OWNER_APPROVED";
    changed.optionsMarketContext.acceptance = "OWNER_APPROVED";
    changed.optionsMarketContext.dataOrigin = "NETWORK";
    changed.optionsMarketContext.realCostCents = 100;
    changed.optionsMarketContext.orderExecution = true;
    const validation = validateCurrentStatus(changed, schema);
    assert.equal(validation.valid, false);
    assert(validation.issues.some((issue) => issue.includes("optionsMarketContext.acceptance")));
    assert(validation.issues.some((issue) => issue.includes("optionsMarketContext.dataOrigin")));
    assert(validation.issues.some((issue) => issue.includes("optionsMarketContext.realCostCents")));
    assert(validation.issues.some((issue) => issue.includes("optionsMarketContext.orderExecution")));
  }],
  ["Phase 2 validation status cannot imply unknown success", () => {
    const changed = clone(status);
    changed.optionsMarketContext.validationStatus = "OWNER_APPROVED";
    assert.equal(validateCurrentStatus(changed,schema).valid,false);
  }],
  ["the checked-in status and schema pass strict validation", () => {
    assert.deepEqual(validateCurrentStatus(status, schema), { valid: true, issues: [] });
    assert.equal(status.validation.phase1NewsWorkingTreeAttempt.passed, 2944);
    assert.equal(status.validation.phase1NewsCorrectiveWorkingTreeAttempt.passed, 2962);
    assert.equal(status.validation.phase1NewsCorrectiveWorkingTreeAttempt.evidenceAuthority, "LOCAL_CODEX_SESSION_NOT_GITHUB_CI");
  }],
  ["the implementation baseline cannot masquerade as current HEAD", () => {
    const changed = clone(status);
    changed.source.currentHead = changed.source.source_baseline_commit;
    assertInvalid(changed, schema, "source.currentHead is undeclared.");
  }],
  ["unknown top-level status fields fail closed", () => {
    const changed = clone(status);
    changed.executionAuthority = "GRANTED";
    assertInvalid(changed, schema, "$.executionAuthority is undeclared.");
  }],
  ["unknown nested risk fields fail closed", () => {
    const changed = clone(status);
    changed.riskPolicyRecord.orderAuthority = true;
    assertInvalid(changed, schema, "riskPolicyRecord.orderAuthority is undeclared.");
  }],
  ["recorded risk values cannot drift", () => {
    const changed = clone(status);
    changed.riskPolicyRecord.dailyMaximumLossCents = 2500;
    assertInvalid(changed, schema, "riskPolicyRecord.dailyMaximumLossCents must equal 2000.");
  }],
  ["Options exact risk unit, multiplier, and monetary limits cannot drift", () => {
    const changed = clone(status);
    changed.optionsRiskPolicy.riskUnit = "QUOTE_POINTS";
    changed.optionsRiskPolicy.normalMaximumActualLossCents = 2600;
    changed.optionsRiskPolicy.eventModeMaximumActualLossCents = 2500;
    changed.optionsRiskPolicy.contractMultiplier = 1;
    changed.optionsRiskPolicy.dailyMaximumLossCents = 1;
    changed.optionsRiskPolicy.weeklyMaximumLossCents = 1;
    changed.optionsRiskPolicy.cumulativeDrawdownHardPauseCents = 1;
    const validation = validateCurrentStatus(changed, schema);
    assert.equal(validation.valid, false);
    assert(validation.issues.includes("optionsRiskPolicy.riskUnit must equal \"ACTUAL_USD\"."));
    assert(validation.issues.includes("optionsRiskPolicy.normalMaximumActualLossCents must equal 2500."));
    assert(validation.issues.includes("optionsRiskPolicy.eventModeMaximumActualLossCents must equal 1250."));
    assert(validation.issues.includes("optionsRiskPolicy.contractMultiplier must equal 100."));
    assert(validation.issues.includes("optionsRiskPolicy.dailyMaximumLossCents must equal 5000."));
    assert(validation.issues.includes("optionsRiskPolicy.weeklyMaximumLossCents must equal 10000."));
    assert(validation.issues.includes("optionsRiskPolicy.cumulativeDrawdownHardPauseCents must equal 8000."));
  }],
  ["Options capital, loss, strategy, DTE, universe, and concentration boundaries cannot drift", () => {
    const changed = clone(status);
    changed.optionsRiskPolicy.eligibleCapitalBucket = "CASH_RESERVE";
    changed.optionsRiskPolicy.maximumLossComponents = ["PREMIUM_OR_NET_DEBIT"];
    changed.optionsRiskPolicy.failClosedOutcomes = ["TRADE"];
    changed.optionsRiskPolicy.allowedStrategies = ["SHORT_CALL"];
    changed.optionsRiskPolicy.prohibitedStructures = ["NAKED_SHORT_OPTIONS"];
    changed.optionsRiskPolicy.tacticalDteRange.minimum = 0;
    changed.optionsRiskPolicy.macroDteRange.maximum = 45;
    changed.optionsRiskPolicy.initialApprovedUnderlyings[0] = "SPY";
    changed.optionsRiskPolicy.maximumUniverseSize = 16;
    changed.optionsRiskPolicy.themeCorrelationConcentration = "DISPLAY_ONLY";
    const validation = validateCurrentStatus(changed, schema);
    assert.equal(validation.valid, false);
    assert(validation.issues.includes("optionsRiskPolicy.eligibleCapitalBucket must equal \"OPERATING_CAPITAL\"."));
    assert(validation.issues.includes("optionsRiskPolicy.maximumLossComponents must equal [\"PREMIUM_OR_NET_DEBIT\",\"CONTRACT_QUANTITY\",\"CONTRACT_MULTIPLIER\",\"FEES\",\"REGULATORY_CHARGES\",\"CONFIGURED_SLIPPAGE\",\"RELATED_OR_THEME_CORRELATED_OPEN_POSITIONS\",\"REMAINING_MAXIMUM_LOSS_ON_OPEN_POSITIONS\",\"DAILY_REALIZED_LOSSES\",\"WEEKLY_REALIZED_LOSSES\",\"CUMULATIVE_REALIZED_DRAWDOWN\"]."));
    assert(validation.issues.includes("optionsRiskPolicy.failClosedOutcomes must equal [\"NO_TRADE / MAX_LOSS_NOT_PROVEN\",\"NO_TRADE / RISK_BUDGET_INSUFFICIENT\"]."));
    assert(validation.issues.includes("optionsRiskPolicy.allowedStrategies must equal [\"LONG_CALL\",\"LONG_PUT\",\"BULL_CALL_DEBIT_SPREAD\",\"BEAR_PUT_DEBIT_SPREAD\"]."));
    assert(validation.issues.includes("optionsRiskPolicy.prohibitedStructures must equal [\"NAKED_SHORT_CALLS\",\"NAKED_SHORT_PUTS\",\"CREDIT_SPREADS\",\"CREDIT_STRATEGIES\",\"SHORT_STRADDLES\",\"SHORT_STRANGLES\",\"RATIO_SPREADS\",\"MARGIN_DEPENDENT_STRATEGIES\",\"UNLIMITED_RISK_STRUCTURES\",\"CALENDARS\",\"DIAGONALS\",\"IRON_CONDORS\",\"AUTOMATIC_ROLLS_OF_LOSING_POSITIONS\",\"AVERAGING_DOWN\",\"MARTINGALE\",\"REVENGE_TRADING\"]."));
    assert(validation.issues.includes("optionsRiskPolicy.tacticalDteRange must equal {\"minimum\":14,\"maximum\":45}."));
    assert(validation.issues.includes("optionsRiskPolicy.macroDteRange must equal {\"minimum\":45,\"maximum\":120}."));
    assert(validation.issues.includes("optionsRiskPolicy.initialApprovedUnderlyings must equal [\"GLD\",\"IBIT\"]."));
    assert(validation.issues.includes("optionsRiskPolicy.maximumUniverseSize must equal 2."));
    assert(validation.issues.includes("optionsRiskPolicy.themeCorrelationConcentration must equal \"DISPLAY_AND_GATE\"."));
  }],
  ["Dashboard capability is reusable while only the legacy interface retires later", () => {
    const changed = clone(status);
    changed.moduleDisposition.dashboardProductCapability = "RETIRE_LATER";
    changed.moduleDisposition.legacyPythonAndOfflineDailyScanInterfaces = "REUSE";
    const validation = validateCurrentStatus(changed, schema);
    assert.equal(validation.valid, false);
    assert(validation.issues.includes('moduleDisposition.dashboardProductCapability must equal "REUSE".'));
    assert(validation.issues.includes('moduleDisposition.legacyPythonAndOfflineDailyScanInterfaces must equal "RETIRE_LATER".'));
  }],
  ["TypeScript product ownership cannot be reassigned", () => {
    const changed = clone(status);
    changed.runtimeOwnership.productRuntime = "PYTHON";
    assertInvalid(changed, schema, "runtimeOwnership.productRuntime must equal \"TYPESCRIPT\".");
  }],
  ["Phase 1 news status cannot widen fixture, credential, cost, persistence, or Phase 2 authority", () => {
    const changed = clone(status);
    changed.optionsNewsInfrastructure.transportAuthority = "LIVE";
    changed.optionsNewsInfrastructure.credentialAuthority = "READ_ALLOWED";
    changed.optionsNewsInfrastructure.realCostCents = 1;
    changed.optionsNewsInfrastructure.persistenceAuthority = "PRODUCTION_DATABASE";
    changed.optionsNewsInfrastructure.combinedNewsOptionsMonthlyBudget.hardThresholdCents = 20000;
    changed.optionsNewsInfrastructure.combinedNewsOptionsMonthlyBudget.spendingAuthority = "GRANTED";
    changed.optionsNewsInfrastructure.phase2Status = "STARTED";
    const validation = validateCurrentStatus(changed, schema);
    assert.equal(validation.valid, false);
    assert(validation.issues.includes('optionsNewsInfrastructure.transportAuthority must equal "FIXTURE_AND_DRY_RUN_ONLY_LIVE_DISABLED".'));
    assert(validation.issues.includes('optionsNewsInfrastructure.credentialAuthority must equal "NOT_GRANTED_NOT_READ".'));
    assert(validation.issues.includes("optionsNewsInfrastructure.realCostCents must equal 0."));
    assert(validation.issues.includes('optionsNewsInfrastructure.persistenceAuthority must equal "DETERMINISTIC_IN_MEMORY_TEST_ONLY".'));
    assert(validation.issues.includes("$.optionsNewsInfrastructure.combinedNewsOptionsMonthlyBudget.hardThresholdCents must equal schema const 10000."));
    assert(validation.issues.includes('$.optionsNewsInfrastructure.combinedNewsOptionsMonthlyBudget.spendingAuthority must equal schema const "NONE".'));
    assert(validation.issues.includes('optionsNewsInfrastructure.phase2Status must equal "IMPLEMENTED_AWAITING_OWNER_REVIEW".'));
  }],
  ["three capital buckets preserve exact order and identity", () => {
    const changed = clone(status);
    changed.capitalArchitecture.futureBuckets.reverse();
    assertInvalid(changed, schema, "capitalArchitecture.futureBuckets must contain the exact ordered three-bucket model.");
  }],
  ["capital automation and execution authority remain prohibited", () => {
    const changed = clone(status);
    changed.capitalArchitecture.automaticTransfer = "ENABLED";
    changed.riskPolicyRecord.executionAuthority = "TRADING";
    changed.executionBoundaries.paperTrading = "OPEN";
    changed.automatedExecutionAllowed = true;
    const validation = validateCurrentStatus(changed, schema);
    assert.equal(validation.valid, false);
    assert(validation.issues.includes("capitalArchitecture.automaticTransfer must equal \"PROHIBITED\"."));
    assert(validation.issues.includes("riskPolicyRecord.executionAuthority must equal \"NONE\"."));
    assert(validation.issues.includes("executionBoundaries.paperTrading must equal \"CLOSED\"."));
    assert(validation.issues.includes("automatedExecutionAllowed must equal false."));
  }],
  ["frozen Daily Scan/Alpaca history keeps live and execution authority closed", () => {
    const changed = clone(status);
    changed.networkAuthority = "LIVE_READ";
    changed.frozenDailyScanAlpacaHistoricalDelivery.historicalPhase1Status = "IN_PROGRESS";
    changed.frozenDailyScanAlpacaHistoricalDelivery.historicalPhase1Approval = "GRANTED";
    changed.frozenDailyScanAlpacaHistoricalDelivery.historicalPhase1BStatus = "STARTED";
    changed.frozenDailyScanAlpacaHistoricalDelivery.historicalPhase1BDesign.networkAuthority = "GRANTED";
    changed.frozenDailyScanAlpacaHistoricalDelivery.historicalPhase1BDesign.credentialAccess = "ALLOWED";
    changed.frozenDailyScanAlpacaHistoricalDelivery.historicalPhase1BDesign.marketDataAcquisition = "IMPLEMENTED";
    changed.optionsStatus = "STARTED";
    changed.brokerStatus = "STARTED";
    changed.paperTradingStatus = "STARTED";
    changed.orderExecutionStatus = "STARTED";
    changed.executionBoundaries.options = "OPEN";
    changed.ownerDailyProductEntry = "AVAILABLE";
    changed.worktreeIsolation.t3b15C5Included = true;
    const validation = validateCurrentStatus(changed, schema);
    assert.equal(validation.valid, false);
    assert(validation.issues.includes("networkAuthority must equal \"NOT_GRANTED\"."));
    assert(validation.issues.includes("frozenDailyScanAlpacaHistoricalDelivery.historicalPhase1Status must equal \"MERGED\"."));
    assert(validation.issues.includes("frozenDailyScanAlpacaHistoricalDelivery.historicalPhase1Approval must equal \"CLOSED\"."));
    assert(validation.issues.includes("frozenDailyScanAlpacaHistoricalDelivery.historicalPhase1BStatus must equal \"D3A_MERGED_CLOSED_D3B_DESIGN_APPROVED\"."));
    assert(validation.issues.includes("frozenDailyScanAlpacaHistoricalDelivery.historicalPhase1BDesign.networkAuthority must equal \"NOT_GRANTED\"."));
    assert(validation.issues.includes("frozenDailyScanAlpacaHistoricalDelivery.historicalPhase1BDesign.credentialAccess must equal \"PROHIBITED\"."));
    assert(validation.issues.includes("frozenDailyScanAlpacaHistoricalDelivery.historicalPhase1BDesign.marketDataAcquisition must equal \"D3B_IMPLEMENTATION_NOT_STARTED\"."));
    assert(validation.issues.includes("optionsStatus must equal \"PHASE_0_OWNER_APPROVED_PHASE_1_OWNER_APPROVED_PHASE_2_AWAITING_REVIEW\"."));
    assert(validation.issues.includes("brokerStatus must equal \"CLOSED\"."));
    assert(validation.issues.includes("paperTradingStatus must equal \"CLOSED\"."));
    assert(validation.issues.includes("orderExecutionStatus must equal \"CLOSED\"."));
    assert(validation.issues.includes("executionBoundaries.options must equal \"FIXTURE_CONTEXT_AND_MANUAL_FEASIBILITY_NO_TRADING_RUNTIME\"."));
    assert(validation.issues.includes("ownerDailyProductEntry must equal \"FROZEN_CODE_RETAINED\"."));
    assert(validation.issues.includes("worktreeIsolation.t3b15C5Included must equal false."));
  }],
  ["Phase 0 and Phase 1 approvals plus the Phase 2 authorization gate cannot drift", () => {
    const changed = clone(status);
    changed.source.repository = "other/repository";
    changed.source.source_baseline_commit = changed.source.reviewed_c4_commit;
    changed.currentMilestone.status = "OWNER_APPROVED";
    changed.currentMilestone.phase0ApprovedCommit = "0000000000000000000000000000000000000000";
    changed.productDirection.phase0Status = "IMPLEMENTED_AWAITING_OWNER_REVIEW";
    changed.productDirection.phase1Status = "IN_PROGRESS";
    changed.next = ["OWNER_REVIEW_OPTIONS_PHASE_1_NEWS_INFRASTRUCTURE"];
    changed.validation.phase1bD3AMergedHead.includesUncommittedCode = true;
    const validation = validateCurrentStatus(changed, schema);
    assert.equal(validation.valid, false);
    assert(validation.issues.includes("source.repository must equal \"HBLION0805/Alpha\"."));
    assert(validation.issues.includes(`source.source_baseline_commit must equal \"${status.source.source_baseline_commit}\".`));
    assert(validation.issues.includes("currentMilestone.status must equal \"IMPLEMENTED_DIAGNOSTIC_ONLY\"."));
    assert(validation.issues.includes("currentMilestone.phase0ApprovedCommit must equal \"febcce0ac6f70bb670fd8e07763c87bc33d4d106\"."));
    assert(validation.issues.includes("productDirection.phase0Status must equal \"OWNER_APPROVED\"."));
    assert(validation.issues.includes("productDirection.phase1Status must equal \"OWNER_APPROVED\"."));
    assert(validation.issues.includes("next must contain only IMPLEMENT_GLD_IBIT_VERIFIED_OPTION_DATA_AND_RISK."));
    assert(validation.issues.includes("validation.phase1bD3AMergedHead.includesUncommittedCode must equal false."));
  }],
  ["frozen Daily Scan/Alpaca history cannot masquerade as the current Options Phase 1", () => {
    assert.equal(status.productDirection.phase1Status, "OWNER_APPROVED");
    assert.equal(Object.hasOwn(status, "phase1Status"), false);
    assert.equal(Object.hasOwn(status, "phase1Approval"), false);
    assert.equal(Object.hasOwn(status, "phase1BStatus"), false);
    assert.equal(Object.hasOwn(status, "phase1BDelivery"), false);
    assert.equal(Object.hasOwn(status, "phase1BDesign"), false);
    const changed = clone(status);
    changed.phase1Status = "MERGED";
    changed.productDirection.phase1Status = "MERGED";
    changed.frozenDailyScanAlpacaHistoricalDelivery.historicalPhase1Status = "NOT_STARTED";
    const validation = validateCurrentStatus(changed, schema);
    assert.equal(validation.valid, false);
    assert(validation.issues.includes("$.phase1Status is not allowed by schema."));
    assert(validation.issues.includes("$.phase1Status is undeclared."));
    assert(validation.issues.includes("productDirection.phase1Status must equal \"OWNER_APPROVED\"."));
    assert(validation.issues.includes("frozenDailyScanAlpacaHistoricalDelivery.historicalPhase1Status must equal \"MERGED\"."));
  }],
  ["post-merge validation does not publish unaudited timing precision", () => {
    const changed = clone(status);
    changed.validation.phase1aMergedHead.durationMs = 88800;
    changed.validation.phase1aMergedHead.wallClockDurationMs = 88800;
    const validation = validateCurrentStatus(changed, schema);
    assert.equal(validation.valid, false);
    assert(validation.issues.includes("validation.phase1aMergedHead.durationMs must equal null."));
    assert(validation.issues.includes("validation.phase1aMergedHead.wallClockDurationMs must equal null."));
  }],
  ["validation attempts reject inconsistent completed arithmetic", () => {
    const changed = clone(status);
    changed.validation.phase0BaselineAttempt.testsExecuted = 10;
    changed.validation.phase0BaselineAttempt.passed = 9;
    changed.validation.phase0BaselineAttempt.failed = 0;
    const validation = validateCurrentStatus(changed, schema);
    assert.equal(validation.valid, false);
    assert(validation.issues.includes("validation.phase0BaselineAttempt.passed must equal testsExecuted when status is PASSED."));
    assert(validation.issues.includes("validation.phase0BaselineAttempt.testsExecuted must equal passed + failed for completed test outcomes."));
  }],
  ["validation attempts reject dishonest passed, blocked, and comparability states", () => {
    const changed = clone(status);
    changed.validation.phase0BaselineAttempt.status = "PASSED";
    changed.validation.phase0BaselineAttempt.completed = false;
    changed.validation.phase0BaselineAttempt.failed = 1;
    changed.validation.phase0BaselineAttempt.passed = changed.validation.phase0BaselineAttempt.testsExecuted - 1;
    changed.validation.phase0WorkingTreeAttempt.status = "BLOCKED_ENVIRONMENT";
    changed.validation.phase0WorkingTreeAttempt.completed = true;
    changed.validation.phase0WorkingTreeAttempt.failed = 1;
    changed.validation.phase0WorkingTreeAttempt.passed = changed.validation.phase0WorkingTreeAttempt.testsExecuted - 1;
    changed.validation.phase0WorkingTreeAttempt.comparability = "COMPARABLE";
    changed.validation.phase0WorkingTreeAttempt.environmentFingerprint.npmVersion = "0.0.0";
    const validation = validateCurrentStatus(changed, schema);
    assert.equal(validation.valid, false);
    assert(validation.issues.includes("validation.phase0BaselineAttempt.completed must be true when status is PASSED."));
    assert(validation.issues.includes("validation.phase0BaselineAttempt.failed must equal 0 when status is PASSED."));
    assert(validation.issues.includes("validation.phase0WorkingTreeAttempt.completed must be false when status is BLOCKED_ENVIRONMENT."));
    assert(validation.issues.includes("validation.phase0WorkingTreeAttempt.failed must equal 0 when status is BLOCKED_ENVIRONMENT; infrastructure blocking is not a test failure."));
    assert(validation.issues.includes("Phase 0 comparable attempts must have identical environmentFingerprint values."));
  }],
  ["object schemas must reject unknown fields", () => {
    const changedSchema = clone(schema);
    changedSchema.$defs.riskPolicyRecord.additionalProperties = true;
    assertInvalid(status, changedSchema, "schema.$defs.riskPolicyRecord object schema must reject additional properties.");
  }],
  ["the declared JSON Schema baseline const is executed against current status", () => {
    const changedSchema = clone(schema);
    changedSchema.$defs.phase1bD2ValidationResult.properties.source_baseline_commit.const = "0000000000000000000000000000000000000000";
    assertInvalid(status, changedSchema, "$.validation.phase1bD2MergedHead.source_baseline_commit must equal schema const \"0000000000000000000000000000000000000000\".");
  }],
  ["the declared JSON Schema registered-test const is executed", () => {
    const changedSchema = clone(schema);
    changedSchema.$defs.phase1bD2ValidationResult.properties.testsExecuted.const = 1;
    assertInvalid(status, changedSchema, "$.validation.phase1bD2MergedHead.testsExecuted must equal schema const 1.");
  }],
  ["the declared JSON Schema phase-state const is executed", () => {
    const changedSchema = clone(schema);
    changedSchema.$defs.frozenDailyScanAlpacaHistoricalPhase1BDesign.properties.status.const = "D2_COMPLETED";
    assertInvalid(status, changedSchema, "$.frozenDailyScanAlpacaHistoricalDelivery.historicalPhase1BDesign.status must equal schema const \"D2_COMPLETED\".");
  }],
  ["the declared JSON Schema additionalProperties gate rejects unknown status fields", () => {
    const changed = clone(status);
    changed.frozenDailyScanAlpacaHistoricalDelivery.historicalPhase1BDesign.ownerPublicKey = "caller-supplied";
    assertInvalid(changed, schema, "$.frozenDailyScanAlpacaHistoricalDelivery.historicalPhase1BDesign.ownerPublicKey is not allowed by schema.");
  }],
  ["D2 merged-head validation remains committed and exact", () => {
    const changed = clone(status);
    changed.validation.phase1bD2MergedHead.includesUncommittedCode = true;
    changed.validation.phase1bD2MergedHead.testsExecuted = 2736;
    const validation = validateCurrentStatus(changed, schema);
    assert.equal(validation.valid, false);
    assert(validation.issues.includes("validation.phase1bD2MergedHead.includesUncommittedCode must equal false."));
    assert(validation.issues.includes("validation.phase1bD2MergedHead.testsExecuted must equal 2792."));
  }],
  ["Phase 1B D2 trust-root and no-network status cannot be widened", () => {
    const changed = clone(status);
    changed.frozenDailyScanAlpacaHistoricalDelivery.historicalPhase1BDesign.ownerPublicKey = "caller-supplied";
    assertInvalid(changed, schema, "frozenDailyScanAlpacaHistoricalDelivery.historicalPhase1BDesign.ownerPublicKey is undeclared.");
  }],
  ["D3B history remains validated but its product lane is frozen", () => {
    assert(status.completed.includes("PHASE_1B_D2_C1_TRUST_ROOT_CORRECTION"));
    assert(status.completed.includes("PHASE_1B_D1_DESIGN_COMPLETED"));
    assert(status.completed.includes("PHASE_1B_D2_C2_R2_TRUSTED_COMPOSITION_RAW_TRANSPORT_AND_REGISTRY_BINDING"));
    assert.equal(status.frozenDailyScanAlpacaHistoricalDelivery.historicalPhase1BDelivery.d1, "DESIGN_COMPLETED");
    assert.equal(status.frozenDailyScanAlpacaHistoricalDelivery.historicalPhase1BDelivery.d2C1, "MERGED");
    assert.equal(status.frozenDailyScanAlpacaHistoricalDelivery.historicalPhase1BDelivery.d2C2R2, "MERGED_OFFLINE_ONLY");
    assert(status.completed.includes("PHASE_1B_D3A_OFFLINE_IMPLEMENTATION_MERGED"));
    assert(status.completed.includes("PHASE_1B_D3A_POST_MERGE_CORRECTION_VERIFIED"));
    assert(status.completed.includes("PHASE_1B_D3B_DESIGN_APPROVED_MERGED"));
    assert.equal(status.source.source_baseline_commit, "ff1a345f4958c9acc75203533263b8166c07dff0");
    assert.equal(status.source.implementation_baseline, "PHASE2_PLANNING_MERGE_SOURCE_BASELINE_NOT_WORKING_TREE_HEAD");
    assert.equal(status.frozenDailyScanAlpacaHistoricalDelivery.historicalPhase1BDelivery.d3A, "MERGED_CLOSED");
    assert.equal(status.frozenDailyScanAlpacaHistoricalDelivery.historicalPhase1BDelivery.d3APostMergeCorrection, "VERIFIED");
    assert.equal(status.frozenDailyScanAlpacaHistoricalDelivery.historicalPhase1BDelivery.d3B, "DESIGN_APPROVED");
    assert.equal(status.frozenDailyScanAlpacaHistoricalDelivery.historicalPhase1BDelivery.d3BImplementation, "NOT_STARTED");
    assert.equal(status.frozenDailyScanAlpacaHistoricalDelivery.historicalPhase1BDelivery.d3BLiveRun, "NOT_AUTHORIZED");
    assert.deepEqual(status.inProgress, []);
    assert(status.frozen.includes("ALPACA_D3B_NEXT_ACTION"));
    assert.deepEqual(status.next, ["IMPLEMENT_GLD_IBIT_VERIFIED_OPTION_DATA_AND_RISK"]);
    assert.equal(status.legacyProductLanes.etfDailyScan.formerNextAction, "ALPACA_D3B_IMPLEMENTATION");
    assert.equal(status.frozenDailyScanAlpacaHistoricalDelivery.historicalPhase1BDelivery.liveNetworkAuthorization, "NOT_GRANTED");
    assert.equal(status.frozenDailyScanAlpacaHistoricalDelivery.historicalPhase1BDesign.task, "ALPACA_BARS_LIMIT_LIVE_READONLY_QUALIFICATION_PROTOCOL");
    assert.equal(status.frozenDailyScanAlpacaHistoricalDelivery.historicalPhase1BDesign.status, "D3B_DESIGN_APPROVED_IMPLEMENTATION_NOT_STARTED_LIVE_RUN_NOT_AUTHORIZED");
    assert.equal(status.frozenDailyScanAlpacaHistoricalDelivery.historicalPhase1BDesign.persistenceWrites, 0);
    assert.equal(status.frozenDailyScanAlpacaHistoricalDelivery.historicalPhase1BDesign.marketDataAcquisition, "D3B_IMPLEMENTATION_NOT_STARTED");
    assert.equal(status.frozenDailyScanAlpacaHistoricalDelivery.historicalPhase1BDesign.marketScopePolicy, "EXACT_3_QUALIFICATION_REQUESTS_DESIGN_ONLY");
    assert.equal(status.frozenDailyScanAlpacaHistoricalDelivery.historicalPhase1BDesign.providerLimitSemantics, "UNPROVEN_FAIL_CLOSED_BEFORE_TRANSPORT");
    assert.equal(status.frozenDailyScanAlpacaHistoricalDelivery.historicalPhase1BDesign.compositionRoot, "PRODUCT_FIXED_NO_ARGUMENT_ENTRY_TEST_TRANSPORT_SEPARATE");
    assert.equal(status.frozenDailyScanAlpacaHistoricalDelivery.historicalPhase1BDesign.designCommit, "0a8d8668b95c0756d91477f9aa3c7b805bf9ce2b");
    assert.equal(status.frozenDailyScanAlpacaHistoricalDelivery.historicalPhase1BDesign.designPullRequest, "MERGED_CLOSED");
    assert.equal(status.frozenDailyScanAlpacaHistoricalDelivery.historicalPhase1BDesign.mergeCommit, "14b5a5aac5157f3284368608a84c890606fc5496");
    assert.equal(status.frozenDailyScanAlpacaHistoricalDelivery.historicalPhase1BDesign.mergeTimestamp, "2026-08-02T23:34:45.000Z");
    assert.equal(status.frozenDailyScanAlpacaHistoricalDelivery.historicalPhase1BDesign.designApproval, "APPROVED_SEPARATE_FROM_NETWORK_AUTHORIZATION");
    assert.equal(status.frozenDailyScanAlpacaHistoricalDelivery.historicalPhase1BDesign.implementationStatus, "NOT_STARTED");
    assert.equal(status.frozenDailyScanAlpacaHistoricalDelivery.historicalPhase1BDesign.liveRunStatus, "NOT_AUTHORIZED");
    const changed = clone(status);
    changed.frozenDailyScanAlpacaHistoricalDelivery.historicalPhase1BDesign.trustedOwnerVerificationKey = "CALLER_RUNTIME_INPUT";
    assertInvalid(changed, schema, "frozenDailyScanAlpacaHistoricalDelivery.historicalPhase1BDesign.trustedOwnerVerificationKey must equal \"PRODUCT_COMPOSITION_ROOT_REQUIRED_FAIL_CLOSED\".");
    const missingFreeze = clone(status);
    missingFreeze.frozen = missingFreeze.frozen.filter((item) => item !== "ALPACA_D3B_NEXT_ACTION");
    assertInvalid(missingFreeze, schema, "frozen must include \"ALPACA_D3B_NEXT_ACTION\".");
  }],
  ["D3B design review cannot be mistaken for live-run or execution authority", () => {
    const changed = clone(status);
    changed.frozenDailyScanAlpacaHistoricalDelivery.historicalPhase1BDelivery.d3B = "LIVE_RUN_AUTHORIZED";
    changed.frozenDailyScanAlpacaHistoricalDelivery.historicalPhase1BDelivery.d3BImplementation = "IMPLEMENTED";
    changed.frozenDailyScanAlpacaHistoricalDelivery.historicalPhase1BDelivery.d3BLiveRun = "AUTHORIZED";
    changed.frozenDailyScanAlpacaHistoricalDelivery.historicalPhase1BDelivery.liveNetworkAuthorization = "GRANTED";
    changed.frozenDailyScanAlpacaHistoricalDelivery.historicalPhase1BDesign.networkAuthority = "GRANTED";
    changed.frozenDailyScanAlpacaHistoricalDelivery.historicalPhase1BDesign.credentialAccess = "ALLOWED";
    changed.frozenDailyScanAlpacaHistoricalDelivery.historicalPhase1BDesign.persistenceWrites = 1;
    changed.executionBoundaries.network = "OPEN";
    changed.automatedExecutionAllowed = true;
    const validation = validateCurrentStatus(changed, schema);
    assert.equal(validation.valid, false);
    assert(validation.issues.includes("frozenDailyScanAlpacaHistoricalDelivery.historicalPhase1BDelivery.d3B must equal \"DESIGN_APPROVED\"."));
    assert(validation.issues.includes("frozenDailyScanAlpacaHistoricalDelivery.historicalPhase1BDelivery.d3BImplementation must equal \"NOT_STARTED\"."));
    assert(validation.issues.includes("frozenDailyScanAlpacaHistoricalDelivery.historicalPhase1BDelivery.d3BLiveRun must equal \"NOT_AUTHORIZED\"."));
    assert(validation.issues.includes("frozenDailyScanAlpacaHistoricalDelivery.historicalPhase1BDelivery.liveNetworkAuthorization must equal \"NOT_GRANTED\"."));
    assert(validation.issues.includes("frozenDailyScanAlpacaHistoricalDelivery.historicalPhase1BDesign.networkAuthority must equal \"NOT_GRANTED\"."));
    assert(validation.issues.includes("frozenDailyScanAlpacaHistoricalDelivery.historicalPhase1BDesign.credentialAccess must equal \"PROHIBITED\"."));
    assert(validation.issues.includes("frozenDailyScanAlpacaHistoricalDelivery.historicalPhase1BDesign.persistenceWrites must equal 0."));
    assert(validation.issues.includes("executionBoundaries.network must equal \"CLOSED\"."));
    assert(validation.issues.includes("automatedExecutionAllowed must equal false."));
  }],
  ["D3A merged-head validation binds the PR #7 merge commit and verified count", () => {
    assert.equal(status.validation.phase1bD3AMergedHead.source_baseline_commit, "bae51dda65dc55f376cb683f873fa93295ed7e2f");
    assert.equal(status.validation.phase1bD3AMergedHead.includesUncommittedCode, false);
    assert.equal(status.validation.phase1bD3AMergedHead.componentCount, 139);
    assert.equal(status.validation.phase1bD3AMergedHead.testsExecuted, 2814);
    const changed = clone(status);
    changed.validation.phase1bD3AMergedHead.source_baseline_commit = "877d195b545233914e2b165d8cdb769fe2b1d2f0";
    assertInvalid(changed, schema, "$.validation.phase1bD3AMergedHead.source_baseline_commit must equal schema const \"bae51dda65dc55f376cb683f873fa93295ed7e2f\".");
  }],
];

let passed = 0;
for (const [name, test] of tests) {
  try {
    test();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}
console.log(`Current status validator: ${passed}/${tests.length} tests passed.`);

function assertInvalid(candidateStatus, candidateSchema, expectedIssue) {
  const validation = validateCurrentStatus(candidateStatus, candidateSchema);
  assert.equal(validation.valid, false);
  assert(validation.issues.includes(expectedIssue), validation.issues.join("\n"));
}

function clone(value) {
  return structuredClone(value);
}
