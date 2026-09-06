import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const PHASE_1A_MERGE_COMMIT = "f565e9e5250cfd2fca5e6ed9c244b3947add7b28";
const PHASE_1B_D2_MERGE_COMMIT = "948192be9eb7d9d5e41abb19e763b73916dbcad4";
const PHASE_1B_D3A_MERGE_COMMIT = "bae51dda65dc55f376cb683f873fa93295ed7e2f";
const PHASE_1B_D3B_DESIGN_MERGE_COMMIT = "14b5a5aac5157f3284368608a84c890606fc5496";
const OPTIONS_PHASE_0_BASELINE_COMMIT = "06c0ef2720a6b54fb0e27481efdbdfee786694e4";
const OPTIONS_PHASE_1_BASELINE_COMMIT = "609e5a750f26e47d79ad9f4c48a8526fad9cf5f9";
const OPTIONS_PHASE_1_FIRST_CORRECTIVE_COMMIT = "7191d0cb53877f6197bc1c753b013d5ad8b38e08";
const STATUS_FIELDS = Object.freeze([
  "$schema", "schemaVersion", "statusId", "asOf", "source", "currentMilestone",
  "completed", "inProgress", "blocked", "frozen", "next", "productDirection", "optionsNewsInfrastructure", "optionsMarketContext", "ownerOptionsProfile", "runtimeOwnership",
  "capitalArchitecture", "riskPolicyRecord", "optionsRiskPolicy", "moduleDisposition", "legacyProductLanes",
  "worktreeIsolation", "executionBoundaries", "automatedExecutionAllowed", "ownerDailyProductEntry", "ownerProductEntry", "validation",
  "networkAuthority", "frozenDailyScanAlpacaHistoricalDelivery",
  "optionsStatus", "brokerStatus", "paperTradingStatus", "orderExecutionStatus",
  "capitalAspiration", "optionsDriverMonitor", "currentDeliveryValidation", "optionsLocalTradeLifecycle",
]);
const STATUS_ITEM = /^[A-Z0-9][A-Z0-9_:-]{2,159}$/u;

export class CurrentStatusValidationError extends Error {
  constructor(issues) {
    super(`Alpha current status is invalid:\n- ${issues.join("\n- ")}`);
    this.name = "CurrentStatusValidationError";
    this.issues = Object.freeze([...issues]);
  }
}

export function validateCurrentStatus(status, schema) {
  const issues = [];
  validateSchema(schema, issues);
  if (!isRecord(status)) {
    issues.push("$ must be an object.");
    return result(issues);
  }
  if (isRecord(schema)) validateJsonSchemaInstance(status, schema, schema, "$", issues);

  allowOnly(status, STATUS_FIELDS, "$", issues);
  requireExactly(status, STATUS_FIELDS, "$", issues);
  exact(status.$schema, "./current.schema.json", "$schema", issues);
  exact(status.schemaVersion, "1.17", "schemaVersion", issues);
  if (typeof status.statusId !== "string" || !/^alpha-status:[A-Za-z0-9._-]+$/u.test(status.statusId)) {
    issues.push("statusId must be a bounded Alpha status identifier.");
  }
  if (!isCanonicalTimestamp(status.asOf)) issues.push("asOf must be a canonical UTC timestamp.");

  validateExactObject(status.source, "source", {
  "repository": "HBLION0805/Alpha",
  "source_baseline_ref": "origin/codex/gld-ibit-options-foundation",
  "source_baseline_commit": "4e27789b297cc8bff759fe3d3a66396497fbc6af",
  "implementation_baseline": "GLD_IBIT_FOCUS_V2_REVIEWED_SOURCE_BASELINE_NOT_WORKING_TREE_HEAD",
  "reviewed_c4_commit": "095657cd5c72d095d9c72b2ec76a580b35e9d3c7",
  "phase0_owner_approval_commit": "819a7dd8d3aa680e952dfe1763f2ded17ff1b71a"
}, issues);
  validateExactObject(status.currentMilestone, "currentMilestone", {
  "id": "LOCAL_OPTIONS_TRADE_LIFECYCLE_V1",
  "name": "GLD / IBIT Local Trade Lifecycle v1",
  "status": "IMPLEMENTED_LOCAL_SIMULATION_ONLY",
  "authorizedBy": "OWNER_COMPLETE_LOCAL_TRADE_PROCESS_AND_REVIEWS_2026_09_06",
  "implementationBaseline": "4e27789b297cc8bff759fe3d3a66396497fbc6af",
  "phase0ApprovedCommit": "febcce0ac6f70bb670fd8e07763c87bc33d4d106"
}, issues);
  for (const field of ["completed", "inProgress", "blocked", "frozen", "next"]) {
    validateStatusItems(status[field], field, issues);
  }
  requireStatusItem(status.completed, "PHASE_1B_D2_C1_TRUST_ROOT_CORRECTION", "completed", issues);
  requireStatusItem(status.completed, "PHASE_1B_D1_DESIGN_COMPLETED", "completed", issues);
  requireStatusItem(status.completed, "PHASE_1B_D2_C2_R2_TRUSTED_COMPOSITION_RAW_TRANSPORT_AND_REGISTRY_BINDING", "completed", issues);
  requireStatusItem(status.completed, "PHASE_1B_D3A_OFFLINE_IMPLEMENTATION_MERGED", "completed", issues);
  requireStatusItem(status.completed, "PHASE_1B_D3A_POST_MERGE_CORRECTION_VERIFIED", "completed", issues);
  requireStatusItem(status.completed, "PHASE_1B_D3B_DESIGN_APPROVED_MERGED", "completed", issues);
  requireStatusItem(status.completed, "OPTIONS_RISK_POLICY_RECORDED", "completed", issues);
  requireStatusItem(status.completed, "OPTIONS_ONLY_MVP_PHASE_0_R1_OWNER_APPROVED", "completed", issues);
  for (const item of ["OPTIONS_PHASE_1_P1_A_CONTRACTS_REGISTRY_STATE_TRANSPORT_IMPLEMENTED", "OPTIONS_PHASE_1_P1_B_FOUR_FIXTURE_ADAPTERS_IMPLEMENTED", "OPTIONS_PHASE_1_P1_C_LINKING_DEDUPE_CLUSTERING_VERIFICATION_IMPLEMENTED", "OPTIONS_PHASE_1_P1_D_PERSISTENCE_BUDGET_HEALTH_IMPLEMENTED", "OPTIONS_PHASE_1_END_TO_END_FIXTURE_DEMOS_IMPLEMENTED", "OPTIONS_PHASE_1_NEWS_INFRASTRUCTURE_OWNER_APPROVED"]) requireStatusItem(status.completed, item, "completed", issues);
  requireStatusItem(status.completed, "OPTIONS_PHASE_2_P2_A_THROUGH_P2_D_IMPLEMENTED", "completed", issues);
  if (!Array.isArray(status.inProgress) || status.inProgress.length !== 0) {
    issues.push("inProgress must be empty at the completed local Options lifecycle implementation checkpoint.");
  }
  for (const item of ["GLD_IBIT_RISK_V2_ALL_IN_R_DIAGNOSTIC_IMPLEMENTED","GLD_IBIT_DRIVER_CATALOG_AND_PUBLIC_FEED_MONITOR_IMPLEMENTED","OWNER_AUTHORIZED_UNRELATED_PRODUCT_CODE_REMOVAL_COMPLETED"]) requireStatusItem(status.completed, item, "completed", issues);
  validateExactObject(status.capitalAspiration, "capitalAspiration", {
  "initialEquityCents": 100000,
  "targetEquityCents": 5000000,
  "targetDate": "2026-12-31",
  "classification": "OWNER_ASPIRATION_SCENARIO_ONLY",
  "expectedReturnPromise": false,
  "riskOverrides": false
}, issues);
  validateExactObject(status.optionsDriverMonitor, "optionsDriverMonitor", {
  "contractVersion": "1.0",
  "status": "IMPLEMENTED_BOUNDED_PUBLIC_HEADLINE_MONITOR",
  "factorFamilyCount": 16,
  "indicatorCount": 94,
  "fixedPublicFeedCount": 6,
  "sourceIds": [
    "fed",
    "bls",
    "bea",
    "ecb",
    "ofac",
    "sec"
  ],
  "sourceEndpointReview": {
    "date": "2026-09-06",
    "status": "HTTP_200_VERIFIED",
    "meaning": "ENDPOINT_REACHABILITY_NOT_CURRENT_OBSERVATION_FRESHNESS"
  },
  "catalogCoverage": "EXTENSIBLE_NON_EXHAUSTIVE",
  "networkAuthority": "OWNER_AUTHORIZED_FIXED_PUBLIC_DRIVER_FEEDS_ONLY",
  "persistenceAuthority": "LOCAL_APPEND_ONLY_HEADLINE_VERSION_HISTORY",
  "quantitativeDataConnectors": "NOT_IMPLEMENTED",
  "headlineInterpretation": "CANDIDATE_FACTOR_TAGS_ONLY",
  "calibratedWinRate": "NOT_AVAILABLE",
  "historicalOptionOutcomes": "NOT_IMPLEMENTED",
  "missingAndStaleEvidence": "UNKNOWN_NOT_NEUTRAL",
  "continuousMonitoring": "HOURLY_CODEX_HEARTBEAT_CONFIGURED_REQUIRES_LOCAL_APP",
  "credentialAuthority": "NOT_GRANTED_NOT_READ",
  "paidSubscriptions": "NOT_ENABLED",
  "executionAllowed": false,
  "specification": "docs/specifications/OPTIONS_FOCUS_RISK_AND_DRIVERS_V2.md"
}, issues);
  validateExactObject(status.optionsLocalTradeLifecycle, "optionsLocalTradeLifecycle", {
  "contractVersion": "1.0",
  "status": "IMPLEMENTED_LOCAL_SIMULATION_ONLY",
  "authorization": "OWNER_COMPLETE_LOCAL_TRADE_PROCESS_AND_REVIEWS_2026_09_06",
  "dataOrigins": [
    "SYNTHETIC_FIXTURE",
    "UNVERIFIED_IMPORT"
  ],
  "contractScope": "STANDARD_100_SHARE_GLD_IBIT_LONG_CALL_PUT_ONLY",
  "liveVerifiedOptionChain": "NOT_IMPLEMENTED",
  "planAuthority": "FROZEN_SIX_DIMENSION_THESIS_AND_EXIT_PLAN",
  "holdingWindow": "INTRADAY_PLANS_ONLY",
  "timeframeAuthority": "MONTHLY_CONTEXT_DAILY_SETUP_INTRADAY_TIMING_NO_VALIDATED_WEIGHTS",
  "simulatedFills": "SUBSEQUENT_ELIGIBLE_QUOTE_ASK_BUY_BID_SELL_WITH_COSTS",
  "cashAccounting": "ENTRY_RESERVATIONS_ONE_OPEN_POSITION_UNSETTLED_SALE_PROCEEDS",
  "settlementAuthority": "NO_SAME_DAY_REUSE_OR_FABRICATED_SETTLEMENT_CREDIT",
  "persistenceAuthority": "LOCAL_APPEND_ONLY_SCENARIO_RESULT_REVIEW_HISTORY",
  "restartRecovery": "RECOMPUTE_AND_COMPARE_STORED_HISTORY",
  "postTradeReview": "EVERY_CLOSED_TRADE_FACTS_AND_CANDIDATE_CAUSES",
  "mistakeNotebook": "CANDIDATE_LESSONS_WITH_OBJECTIVE_PRE_ENTRY_GUARDS",
  "automaticStrategyChanges": "PROHIBITED",
  "calibratedWinRate": "NOT_AVAILABLE",
  "outcomeEvidence": "SCRIPTED_ENGINEERING_CASES_NOT_STRATEGY_PERFORMANCE",
  "simulationRiskGuards": {
    "sessionRealizedLossLimitInitialEquityBps": 100,
    "sessionLossBasis": "NET_REALIZED_PNL",
    "highWaterDrawdownLimitBps": 500,
    "newEntryRiskMustFitRemainingSessionAndDrawdownBudget": true,
    "maximumOpenPositions": 1,
    "classification": "CONSERVATIVE_SIMULATION_ASSUMPTIONS_NOT_PRODUCTION_VALIDATED"
  },
  "brokerPaperAccount": "CLOSED",
  "brokerAccountAccess": "CLOSED",
  "liveOrderExecutionAllowed": false,
  "specification": "docs/specifications/OPTIONS_LOCAL_TRADE_LIFECYCLE_V1.md"
}, issues);
  for (const item of ["GLD_IBIT_LOCAL_CONTRACT_QUOTE_BOUNDARY_IMPLEMENTED", "GLD_IBIT_LOCAL_TRADE_LIFECYCLE_IMPLEMENTED", "GLD_IBIT_POST_TRADE_REVIEW_AND_MISTAKE_NOTEBOOK_IMPLEMENTED"]) requireStatusItem(status.completed, item, "completed", issues);
  validateCurrentDeliveryValidation(status.currentDeliveryValidation, issues);
  for (const field of ["blocked", "frozen"]) {
    const required = field === "blocked" ? ["VERIFIED_GLD_IBIT_OPTION_CHAIN_NOT_IMPLEMENTED","QUANTITATIVE_DRIVER_CONNECTORS_NOT_IMPLEMENTED","CALIBRATED_COST_AWARE_OPTION_OUTCOMES_NOT_AVAILABLE","FULL_BROKER_ACCOUNT_PORTFOLIO_RISK_RUNTIME_NOT_IMPLEMENTED","ROBINHOOD_ACCOUNT_ACCESS_PROHIBITED","BROKER_PAPER_TRADING_PROHIBITED","ORDER_EXECUTION_PROHIBITED"] : ["T3B15_C5_UNCOMMITTED_WORK","ORIGINAL_ALPHA_WORKTREE","BROKER_ACCOUNT_ORDER_AND_BROKER_PAPER_TRADING"];
    if (!deepEqual(status[field], required)) issues.push(`${field} must contain the exact current scope and closed account boundaries.`);
  }
  if (!Array.isArray(status.next) || JSON.stringify(status.next) !== JSON.stringify(["QUALIFY_POINT_IN_TIME_GLD_IBIT_OPTION_DATA_FOR_LOCAL_REPLAY","ADD_ACCOUNT_RULES_SETTLEMENT_AND_INDEPENDENT_COST_AWARE_OUTCOME_EVIDENCE"])) {
    issues.push("next must contain the ordered option-data qualification and account-rule/outcome-evidence work.");
  }
  validateExactObject(status.productDirection, "productDirection", {
    currentProduct: "OPTIONS_ONLY_MVP",
    currentPhase: "LOCAL_TRADE_LIFECYCLE_V1",
    phase0Status: "OWNER_APPROVED",
    phase1Status: "OWNER_APPROVED",
    permanentMission: ["PROTECT_CAPITAL", "ALLOCATE_CAPITAL", "GROW_CAPITAL", "COMPOUND_CAPITAL"],
    earlyCapitalGrowthTool: "DEFINED_RISK_OPTIONS",
    longTermDestination: "QUALITY_ASSETS_AND_NON_LEVERAGED_COMPOUNDING",
    fixedReturnPromise: false,
  }, issues);
  validateExactObject(status.optionsNewsInfrastructure, "optionsNewsInfrastructure", {
    contractVersion: "1.0",
    phaseSegments: { p1A: "IMPLEMENTED", p1B: "IMPLEMENTED", p1C: "IMPLEMENTED", p1D: "IMPLEMENTED" },
    providers: ["SEC_EDGAR_FIXTURE", "FEDERAL_RESERVE_FIXTURE", "FINNHUB_FIXTURE", "ALPHA_VANTAGE_FIXTURE"],
    transportAuthority: "FIXTURE_AND_DRY_RUN_ONLY_LIVE_DISABLED",
    credentialAuthority: "NOT_GRANTED_NOT_READ",
    realCostCents: 0,
    persistenceAuthority: "DETERMINISTIC_IN_MEMORY_TEST_ONLY",
    verificationAuthority: "DETERMINISTIC_THREE_PATH_TRUTH_VERIFICATION_ONLY",
    summaryAuthority: "DETERMINISTIC_FIXTURE_ONLY_NO_LIVE_LLM",
    combinedNewsOptionsMonthlyBudget: { currency: "USD", softThresholdCents: 8000, hardThresholdCents: 10000, boundary: "UTC", spendingAuthority: "NONE" },
    phase2Status: "IMPLEMENTED_AWAITING_OWNER_REVIEW",
  }, issues);
  if (!isRecord(status.optionsMarketContext) || !["FOCUSED_PASSED_AGGREGATE_PENDING", "PASSED"].includes(status.optionsMarketContext.validationStatus)) {
    issues.push("optionsMarketContext.validationStatus must record pending or observed aggregate validation.");
  }
  validateExactObject(status.optionsMarketContext, "optionsMarketContext", {
    ...{
  "contractVersion": "1.0",
  "phaseSegments": {
    "p2A": "IMPLEMENTED",
    "p2B": "IMPLEMENTED",
    "p2C": "IMPLEMENTED",
    "p2D": "IMPLEMENTED"
  },
  "authorization": "OWNER_CONTINUE_ALPHA_AND_DELEGATE_OFFLINE_PATH_2026_09_06",
  "acceptance": "IMPLEMENTED_AWAITING_OWNER_REVIEW",
  "dataOrigin": "FIXTURE",
  "intervals": [
    "P1D",
    "PT1H",
    "PT15M",
    "PT5M"
  ],
  "provider": "TEST_ONLY_EXISTING_REGISTRY",
  "persistenceAuthority": "DETERMINISTIC_IN_MEMORY_TEST_ONLY",
  "realCostCents": 0,
  "validationStatus": "FOCUSED_PASSED_AGGREGATE_PENDING",
  "validationEvidence": "docs/OPTIONS_PHASE_2_DELIVERY_REVIEW.md"
},
    validationStatus: status.optionsMarketContext?.validationStatus,
  }, issues);
  validateExactObject(status.runtimeOwnership, "runtimeOwnership", {
  "productRuntime": "TYPESCRIPT",
  "pythonRole": "LEGACY_PRODUCT_AND_INTEGRATION_REMOVED",
  "pythonDashboardStatus": "REMOVED_OWNER_AUTHORIZED",
  "riskAuthority": "LOCAL_SIMULATION_RISK_ONLY_FULL_BROKER_PORTFOLIO_RISK_NOT_IMPLEMENTED"
}, issues);
  validateExactObject(status.ownerOptionsProfile, "ownerOptionsProfile", {
  "profileVersion": "owner-gld-ibit-2026-09-06-v2",
  "broker": "ROBINHOOD",
  "intendedUnderlyings": [
    "GLD",
    "IBIT"
  ],
  "initialEquityCents": 100000,
  "normalAllocationBps": 500,
  "conditionalAllocationBps": 1000,
  "plannedStopBps": 2000,
  "comparisonStopBps": 1000,
  "minimumStopBps": 1000,
  "maximumStopBps": 2500,
  "stopPolicyStatus": "RESEARCH_DEFAULT_NOT_VALIDATED_LIVE_RULE",
  "plannedStopBasis": "ENTRY_PREMIUM_PLUS_COSTS",
  "plannedAccountRiskBudgetBps": 50,
  "normalFullPremiumStressCapCents": 2500,
  "minimumRewardMultipleMilliR": 1500,
  "maximumRewardMultipleMilliR": 2000,
  "defaultRewardMultipleMilliR": 2000,
  "rewardBasis": "NET_CASH_GAIN_MULTIPLE_OF_ALL_IN_PLANNED_R",
  "maximumConfiguredProfitTargetBps": 8000,
  "profitTargetCapBasis": "ROUNDED_GROSS_PREMIUM_GAIN",
  "conditionalWinProbabilityThresholdBps": 8000,
  "conditionalEscalation": "BLOCKED_NO_CALIBRATED_OPTION_OUTCOMES",
  "longerHolding": "REQUIRES_THESIS_AND_TIME_REVIEW",
  "maximumLossMeaning": "FULL_PREMIUM_PLUS_FEES_NOT_PLANNED_STOP",
  "legacyLossCaps": "RETAINED_SEPARATE_CONSTRAINT",
  "feasibility": "ECONOMICS_ONLY_NO_EXECUTION_UNKNOWN_COSTS_FAIL_CLOSED",
  "dataAuthority": "MANUAL_SCENARIO_ONLY",
  "executionAllowed": false,
  "developmentPublication": "OWNER_AUTHORIZED_COMMIT_AND_PUSH",
  "specification": "docs/specifications/OPTIONS_FOCUS_RISK_AND_DRIVERS_V2.md"
}, issues);
  validateCapitalArchitecture(status.capitalArchitecture, issues);
  validateRiskPolicyRecord(status.riskPolicyRecord, issues);
  validateOptionsRiskPolicy(status.optionsRiskPolicy, issues);
  validateModuleDisposition(status.moduleDisposition, issues);
  validateLegacyProductLanes(status.legacyProductLanes, issues);
  validateExactObject(status.worktreeIsolation, "worktreeIsolation", {
    originalWorktree: "FROZEN",
    t3b15C5Included: false,
    alphaAuditPacketIncluded: false,
    phase0R1IsolationAudit: "DEDICATED_WORKTREE_ISOLATED_FROM_ORIGINAL_DIRTY_WORKTREE",
  }, issues);
  validateExactObject(status.executionBoundaries, "executionBoundaries", {
  "network": "FIXED_PUBLIC_DRIVER_FEEDS_ONLY",
  "options": "LOCAL_OPTIONS_SIMULATION_AND_PUBLIC_HEADLINES_NO_BROKER_ACCESS",
  "broker": "CLOSED",
  "paperTrading": "LOCAL_SIMULATION_ONLY_NO_BROKER",
  "orderExecution": "CLOSED",
  "robinhoodAccountRead": "PROHIBITED",
  "robinhoodCredentialRead": "PROHIBITED",
  "orderEntry": "OWNER_MANUAL_OUTSIDE_ALPHA",
  "orderType": "LIMIT_ONLY"
}, issues);
  exact(status.automatedExecutionAllowed, false, "automatedExecutionAllowed", issues);
  exact(status.ownerDailyProductEntry, "REMOVED_OWNER_AUTHORIZED", "ownerDailyProductEntry", issues);
  exact(status.ownerProductEntry, "OPTIONS_LOCAL_LIFECYCLE_FEASIBILITY_AND_DRIVER_MONITOR", "ownerProductEntry", issues);
  validateValidation(status.validation, issues);
  exact(status.networkAuthority, "OWNER_AUTHORIZED_FIXED_PUBLIC_DRIVER_FEEDS_ONLY", "networkAuthority", issues);
  validateExactObject(status.frozenDailyScanAlpacaHistoricalDelivery, "frozenDailyScanAlpacaHistoricalDelivery", {
    historicalPhase1Status: "MERGED",
    historicalPhase1Approval: "CLOSED",
    historicalPhase1BStatus: "D3A_MERGED_CLOSED_D3B_DESIGN_APPROVED",
    historicalPhase1BDelivery: {
      d1: "DESIGN_COMPLETED",
      d2C1: "MERGED",
      d2C2R2: "MERGED_OFFLINE_ONLY",
      d2C3: "NOT_STARTED",
      d3A: "MERGED_CLOSED",
      d3APostMergeCorrection: "VERIFIED",
      d3B: "DESIGN_APPROVED",
      d3BImplementation: "NOT_STARTED",
      d3BLiveRun: "NOT_AUTHORIZED",
      newsMacro: "NOT_STARTED",
      providerLimitSemantics: "UNPROVEN",
      fiveRequest43Evidence: "STRUCTURAL_TARGET_ONLY",
      realHttpsAcquisition: "NOT_IMPLEMENTED",
      liveNetworkAuthorization: "NOT_GRANTED",
    },
    historicalPhase1BDesign: {
      task: "ALPACA_BARS_LIMIT_LIVE_READONLY_QUALIFICATION_PROTOCOL",
      status: "D3B_DESIGN_APPROVED_IMPLEMENTATION_NOT_STARTED_LIVE_RUN_NOT_AUTHORIZED",
      networkAuthority: "NOT_GRANTED",
      credentialAccess: "PROHIBITED",
      persistenceWrites: 0,
      marketDataAcquisition: "D3B_IMPLEMENTATION_NOT_STARTED",
      trustedOwnerVerificationKey: "PRODUCT_COMPOSITION_ROOT_REQUIRED_FAIL_CLOSED",
      marketScopePolicy: "EXACT_3_QUALIFICATION_REQUESTS_DESIGN_ONLY",
      providerLimitSemantics: "UNPROVEN_FAIL_CLOSED_BEFORE_TRANSPORT",
      compositionRoot: "PRODUCT_FIXED_NO_ARGUMENT_ENTRY_TEST_TRANSPORT_SEPARATE",
      designCommit: "0a8d8668b95c0756d91477f9aa3c7b805bf9ce2b",
      designPullRequest: "MERGED_CLOSED",
      mergeCommit: PHASE_1B_D3B_DESIGN_MERGE_COMMIT,
      mergeTimestamp: "2026-08-02T23:34:45.000Z",
      designApproval: "APPROVED_SEPARATE_FROM_NETWORK_AUTHORIZATION",
      implementationStatus: "NOT_STARTED",
      liveRunStatus: "NOT_AUTHORIZED",
    },
  }, issues);
  /* Historical delivery stays namespaced and cannot become Options phase state. */
  validateExactObject(status.frozenDailyScanAlpacaHistoricalDelivery.historicalPhase1BDelivery, "frozenDailyScanAlpacaHistoricalDelivery.historicalPhase1BDelivery", {
    d1: "DESIGN_COMPLETED",
    d2C1: "MERGED",
    d2C2R2: "MERGED_OFFLINE_ONLY",
    d2C3: "NOT_STARTED",
    d3A: "MERGED_CLOSED",
    d3APostMergeCorrection: "VERIFIED",
    d3B: "DESIGN_APPROVED",
    d3BImplementation: "NOT_STARTED",
    d3BLiveRun: "NOT_AUTHORIZED",
    newsMacro: "NOT_STARTED",
    providerLimitSemantics: "UNPROVEN",
    fiveRequest43Evidence: "STRUCTURAL_TARGET_ONLY",
    realHttpsAcquisition: "NOT_IMPLEMENTED",
    liveNetworkAuthorization: "NOT_GRANTED",
  }, issues);
  validateExactObject(status.frozenDailyScanAlpacaHistoricalDelivery.historicalPhase1BDesign, "frozenDailyScanAlpacaHistoricalDelivery.historicalPhase1BDesign", {
    task: "ALPACA_BARS_LIMIT_LIVE_READONLY_QUALIFICATION_PROTOCOL",
    status: "D3B_DESIGN_APPROVED_IMPLEMENTATION_NOT_STARTED_LIVE_RUN_NOT_AUTHORIZED",
    networkAuthority: "NOT_GRANTED",
    credentialAccess: "PROHIBITED",
    persistenceWrites: 0,
    marketDataAcquisition: "D3B_IMPLEMENTATION_NOT_STARTED",
    trustedOwnerVerificationKey: "PRODUCT_COMPOSITION_ROOT_REQUIRED_FAIL_CLOSED",
    marketScopePolicy: "EXACT_3_QUALIFICATION_REQUESTS_DESIGN_ONLY",
    providerLimitSemantics: "UNPROVEN_FAIL_CLOSED_BEFORE_TRANSPORT",
    compositionRoot: "PRODUCT_FIXED_NO_ARGUMENT_ENTRY_TEST_TRANSPORT_SEPARATE",
    designCommit: "0a8d8668b95c0756d91477f9aa3c7b805bf9ce2b",
    designPullRequest: "MERGED_CLOSED",
    mergeCommit: PHASE_1B_D3B_DESIGN_MERGE_COMMIT,
    mergeTimestamp: "2026-08-02T23:34:45.000Z",
    designApproval: "APPROVED_SEPARATE_FROM_NETWORK_AUTHORIZATION",
    implementationStatus: "NOT_STARTED",
    liveRunStatus: "NOT_AUTHORIZED",
  }, issues);
  exact(status.optionsStatus, "GLD_IBIT_LOCAL_SIMULATION_IMPLEMENTED_LIVE_TRADING_NOT_IMPLEMENTED", "optionsStatus", issues);
  exact(status.brokerStatus, "CLOSED", "brokerStatus", issues);
  exact(status.paperTradingStatus, "LOCAL_SIMULATION_ONLY_NO_BROKER", "paperTradingStatus", issues);
  exact(status.orderExecutionStatus, "CLOSED", "orderExecutionStatus", issues);

  return result(issues);
}

export function loadAndValidateCurrentStatus(rootDirectory) {
  const statusPath = resolve(rootDirectory, "docs/status/current.json");
  const status = JSON.parse(readFileSync(statusPath, "utf8"));
  const schemaPath = resolve(dirname(statusPath), "current.schema.json");
  const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
  const validation = validateCurrentStatus(status, schema);
  if (!validation.valid) throw new CurrentStatusValidationError(validation.issues);
  return Object.freeze({ status, schema, statusPath, schemaPath });
}

function validateSchema(schema, issues) {
  if (!isRecord(schema)) {
    issues.push("schema must be an object.");
    return;
  }
  exact(schema.$schema, "https://json-schema.org/draft/2020-12/schema", "schema.$schema", issues);
  exact(schema.$id, "https://alpha.local/schemas/project-status/1.17", "schema.$id", issues);
  exact(schema.type, "object", "schema.type", issues);
  exact(schema.additionalProperties, false, "schema.additionalProperties", issues);
  if (!Array.isArray(schema.required) || !sameStringSet(schema.required, STATUS_FIELDS)) {
    issues.push("schema.required must contain the exact current-status fields.");
  }
  if (!isRecord(schema.properties) || !sameStringSet(Object.keys(schema.properties), STATUS_FIELDS)) {
    issues.push("schema.properties must contain the exact current-status fields.");
  }
  inspectObjectSchemas(schema, "schema", issues);
}

function inspectObjectSchemas(value, path, issues) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => inspectObjectSchemas(item, `${path}[${index}]`, issues));
    return;
  }
  if (!isRecord(value)) return;
  if (value.type === "object" && value.additionalProperties !== false) {
    issues.push(`${path} object schema must reject additional properties.`);
  }
  for (const [key, nested] of Object.entries(value)) {
    inspectObjectSchemas(nested, `${path}.${key}`, issues);
  }
}

function validateJsonSchemaInstance(value, schemaNode, rootSchema, path, issues) {
  if (!isRecord(schemaNode)) {
    issues.push(`${path} schema node must be an object.`);
    return;
  }
  if (typeof schemaNode.$ref === "string") {
    const resolved = resolveLocalSchemaReference(rootSchema, schemaNode.$ref);
    if (resolved === undefined) issues.push(`${path} schema reference ${schemaNode.$ref} cannot be resolved.`);
    else validateJsonSchemaInstance(value, resolved, rootSchema, path, issues);
    return;
  }
  if (Array.isArray(schemaNode.oneOf)) {
    const matches = schemaNode.oneOf.filter((candidate) => {
      const candidateIssues = [];
      validateJsonSchemaInstance(value, candidate, rootSchema, path, candidateIssues);
      return candidateIssues.length === 0;
    });
    if (matches.length !== 1) issues.push(`${path} must match exactly one schema alternative.`);
    return;
  }
  if (Object.hasOwn(schemaNode, "const") && !deepEqual(value, schemaNode.const)) {
    issues.push(`${path} must equal schema const ${JSON.stringify(schemaNode.const)}.`);
  }
  if (Array.isArray(schemaNode.enum) && !schemaNode.enum.some((entry) => deepEqual(value, entry))) {
    issues.push(`${path} must equal one of the schema enum values.`);
  }
  if (schemaNode.type !== undefined && !matchesSchemaType(value, schemaNode.type)) {
    issues.push(`${path} does not match schema type ${JSON.stringify(schemaNode.type)}.`);
    return;
  }
  if (typeof value === "string") {
    if (Number.isSafeInteger(schemaNode.minLength) && value.length < schemaNode.minLength) issues.push(`${path} is shorter than schema minLength.`);
    if (Number.isSafeInteger(schemaNode.maxLength) && value.length > schemaNode.maxLength) issues.push(`${path} is longer than schema maxLength.`);
    if (typeof schemaNode.pattern === "string" && !new RegExp(schemaNode.pattern, "u").test(value)) issues.push(`${path} does not match schema pattern.`);
  }
  if (typeof value === "number" && typeof schemaNode.minimum === "number" && value < schemaNode.minimum) {
    issues.push(`${path} is below schema minimum.`);
  }
  if (Array.isArray(value)) validateJsonSchemaArray(value, schemaNode, rootSchema, path, issues);
  if (isRecord(value)) validateJsonSchemaObject(value, schemaNode, rootSchema, path, issues);
}

function validateJsonSchemaObject(value, schemaNode, rootSchema, path, issues) {
  const required = Array.isArray(schemaNode.required) ? schemaNode.required : [];
  for (const field of required) if (typeof field === "string" && !Object.hasOwn(value, field)) issues.push(`${path}.${field} is required by schema.`);
  const properties = isRecord(schemaNode.properties) ? schemaNode.properties : {};
  if (schemaNode.additionalProperties === false) {
    for (const field of Object.keys(value)) if (!Object.hasOwn(properties, field)) issues.push(`${path}.${field} is not allowed by schema.`);
  }
  for (const [field, childSchema] of Object.entries(properties)) {
    if (Object.hasOwn(value, field)) validateJsonSchemaInstance(value[field], childSchema, rootSchema, `${path}.${field}`, issues);
  }
}

function validateJsonSchemaArray(value, schemaNode, rootSchema, path, issues) {
  if (Number.isSafeInteger(schemaNode.minItems) && value.length < schemaNode.minItems) issues.push(`${path} has fewer items than schema minItems.`);
  if (Number.isSafeInteger(schemaNode.maxItems) && value.length > schemaNode.maxItems) issues.push(`${path} has more items than schema maxItems.`);
  if (schemaNode.uniqueItems === true && new Set(value.map((entry) => JSON.stringify(entry))).size !== value.length) issues.push(`${path} must contain unique items.`);
  const prefix = Array.isArray(schemaNode.prefixItems) ? schemaNode.prefixItems : [];
  prefix.forEach((childSchema, index) => {
    if (index < value.length) validateJsonSchemaInstance(value[index], childSchema, rootSchema, `${path}[${index}]`, issues);
  });
  if (schemaNode.items === false && value.length > prefix.length) issues.push(`${path} contains items forbidden by schema.`);
  else if (isRecord(schemaNode.items)) {
    for (let index = prefix.length; index < value.length; index += 1) {
      validateJsonSchemaInstance(value[index], schemaNode.items, rootSchema, `${path}[${index}]`, issues);
    }
  }
}

function resolveLocalSchemaReference(rootSchema, reference) {
  if (!reference.startsWith("#/")) return undefined;
  let current = rootSchema;
  for (const rawPart of reference.slice(2).split("/")) {
    const part = rawPart.replaceAll("~1", "/").replaceAll("~0", "~");
    if (!isRecord(current) || !Object.hasOwn(current, part)) return undefined;
    current = current[part];
  }
  return isRecord(current) ? current : undefined;
}

function matchesSchemaType(value, expected) {
  const types = Array.isArray(expected) ? expected : [expected];
  return types.some((type) => type === "null" ? value === null
    : type === "object" ? isRecord(value)
    : type === "array" ? Array.isArray(value)
    : type === "integer" ? Number.isSafeInteger(value)
    : type === "number" ? typeof value === "number" && Number.isFinite(value)
    : type === "string" ? typeof value === "string"
    : type === "boolean" ? typeof value === "boolean"
    : false);
}

function deepEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function validateCurrentDeliveryValidation(value, issues) {
  if (!isRecord(value)) { issues.push("currentDeliveryValidation must be an object."); return; }
  const fields = ["classification", "command", "status", "componentCount", "testsExecuted", "passed", "failed", "durationMs", "evidence", "historicalCountsAreCurrentResult"];
  allowOnly(value, fields, "currentDeliveryValidation", issues);
  requireExactly(value, fields, "currentDeliveryValidation", issues);
  exact(value.classification, "CURRENT_OPTIONS_LOCAL_LIFECYCLE_V1_WORKING_TREE", "currentDeliveryValidation.classification", issues);
  exact(value.command, "npm.cmd run alpha:validate", "currentDeliveryValidation.command", issues);
  exact(value.evidence, "docs/OPTIONS_LOCAL_LIFECYCLE_DELIVERY.md", "currentDeliveryValidation.evidence", issues);
  exact(value.historicalCountsAreCurrentResult, false, "currentDeliveryValidation.historicalCountsAreCurrentResult", issues);
  const counters = ["componentCount", "testsExecuted", "passed", "failed", "durationMs"];
  if (value.status === "PENDING_AGGREGATE_VALIDATION") {
    for (const field of counters) exact(value[field], null, 'currentDeliveryValidation.' + field, issues);
  } else if (value.status === "PASSED") {
    for (const field of counters) if (!Number.isSafeInteger(value[field]) || value[field] < 0) issues.push('currentDeliveryValidation.' + field + ' must be an observed nonnegative safe integer.');
    if (!(value.componentCount > 0 && value.testsExecuted > 0 && value.passed === value.testsExecuted && value.failed === 0)) issues.push("currentDeliveryValidation passed result must contain positive observed counts with every executed test passed.");
  } else issues.push("currentDeliveryValidation.status must be pending or an observed aggregate pass.");
}

function validateCapitalArchitecture(value, issues) {
  if (!isRecord(value)) {
    issues.push("capitalArchitecture must be an object.");
    return;
  }
  const fields = [
    "status", "legacyField", "futureBuckets", "legacyMigration",
    "transferPolicy", "automaticAllocation", "automaticMigration",
    "automaticTransfer",
  ];
  allowOnly(value, fields, "capitalArchitecture", issues);
  requireExactly(value, fields, "capitalArchitecture", issues);
  exact(value.status, "COMPATIBILITY_ARCHITECTURE_ONLY", "capitalArchitecture.status", issues);
  exact(value.legacyField, "capital_usd", "capitalArchitecture.legacyField", issues);
  const buckets = ["OPERATING_CAPITAL", "LONG_TERM_COMPOUNDING_CAPITAL", "CASH_RESERVE"];
  if (!Array.isArray(value.futureBuckets) || JSON.stringify(value.futureBuckets) !== JSON.stringify(buckets)) {
    issues.push("capitalArchitecture.futureBuckets must contain the exact ordered three-bucket model.");
  }
  exact(value.legacyMigration, "EXPLICIT_OWNER_APPROVAL_REQUIRED", "capitalArchitecture.legacyMigration", issues);
  exact(value.transferPolicy, "NOT_DEFINED", "capitalArchitecture.transferPolicy", issues);
  exact(value.automaticAllocation, "PROHIBITED", "capitalArchitecture.automaticAllocation", issues);
  exact(value.automaticMigration, "PROHIBITED", "capitalArchitecture.automaticMigration", issues);
  exact(value.automaticTransfer, "PROHIBITED", "capitalArchitecture.automaticTransfer", issues);
}

function validateRiskPolicyRecord(value, issues) {
  const expected = {
    policyVersion: "phase0-owner-record-2026-07-29",
    status: "FROZEN_LEGACY_NOT_OPTIONS_AUTHORITY",
    executionAuthority: "NONE",
    currency: "USD",
    etfMaximumPlannedLossCents: 800,
    eventMaximumCostRiskCents: 500,
    dailyMaximumLossCents: 2000,
    weeklyMaximumLossCents: 4000,
    totalDrawdownPauseCents: 8000,
    initialLeveragedEtfPositionLimitBasisPoints: 1000,
    maximumConcurrentShortTermThemes: 1,
  };
  validateExactObject(value, "riskPolicyRecord", expected, issues);
}

function validateOptionsRiskPolicy(value, issues) {
  validateExactObject(value, "optionsRiskPolicy", {
    policyVersion: "options-only-mvp-risk-policy-1.0",
    status: "OWNER_APPROVED_RECORDED_NOT_RUNTIME_ENFORCED",
    executionAuthority: "NONE",
    currency: "USD",
    riskUnit: "ACTUAL_USD",
    contractMultiplier: 100,
    eligibleCapitalBucket: "OPERATING_CAPITAL",
    automaticMigrationProhibitedBuckets: ["LONG_TERM_COMPOUNDING_CAPITAL", "CASH_RESERVE"],
    normalMaximumActualLossCents: 2500,
    eventModeMaximumActualLossCents: 1250,
    dailyMaximumLossCents: 5000,
    weeklyMaximumLossCents: 10000,
    cumulativeDrawdownHardPauseCents: 8000,
    drawdownPrecedence: "GLOBAL_HARD_PAUSE_BEFORE_WEEKLY_LIMIT",
    hardPauseRestart: "EXPLICIT_OWNER_RESTART_REQUIRED",
    maximumConcurrentEventPositions: 1,
    maximumLossComponents: [
      "PREMIUM_OR_NET_DEBIT", "CONTRACT_QUANTITY", "CONTRACT_MULTIPLIER", "FEES",
      "REGULATORY_CHARGES", "CONFIGURED_SLIPPAGE", "RELATED_OR_THEME_CORRELATED_OPEN_POSITIONS",
      "REMAINING_MAXIMUM_LOSS_ON_OPEN_POSITIONS", "DAILY_REALIZED_LOSSES",
      "WEEKLY_REALIZED_LOSSES", "CUMULATIVE_REALIZED_DRAWDOWN",
    ],
    eventModeTriggers: ["EARNINGS", "FOMC", "CPI", "PPI", "NONFARM_PAYROLLS", "GDP", "MAJOR_REGULATORY_EVENT", "MAJOR_GEOPOLITICAL_EVENT"],
    allowedStrategies: ["LONG_CALL", "LONG_PUT", "BULL_CALL_DEBIT_SPREAD", "BEAR_PUT_DEBIT_SPREAD"],
    prohibitedStructures: [
      "NAKED_SHORT_CALLS", "NAKED_SHORT_PUTS", "CREDIT_SPREADS", "CREDIT_STRATEGIES",
      "SHORT_STRADDLES", "SHORT_STRANGLES", "RATIO_SPREADS", "MARGIN_DEPENDENT_STRATEGIES",
      "UNLIMITED_RISK_STRUCTURES", "CALENDARS", "DIAGONALS", "IRON_CONDORS",
      "AUTOMATIC_ROLLS_OF_LOSING_POSITIONS", "AVERAGING_DOWN", "MARTINGALE", "REVENGE_TRADING",
    ],
    prohibitedDte: [0, 1],
    tacticalDteRange: { minimum: 14, maximum: 45 },
    macroDteRange: { minimum: 45, maximum: 120 },
    orderType: "LIMIT_ONLY",
    failClosedOutcomes: ["NO_TRADE / MAX_LOSS_NOT_PROVEN", "NO_TRADE / RISK_BUDGET_INSUFFICIENT"],
    initialApprovedUnderlyings: ["GLD", "IBIT"],
    maximumUniverseSize: 2,
    underlyingAdmissionEvidence: ["OPTION_LIQUIDITY", "NEWS_COVERAGE", "CANDLE_DATA", "RISK_CLASSIFICATION"],
    themeCorrelationConcentration: "DISPLAY_AND_GATE",
    nonIndependentDiversificationExample: "QQQ_SMH_SOXX_NVDA_SAME_DIRECTION",
  }, issues);
}

function validateModuleDisposition(value, issues) {
  validateExactObject(value, "moduleDisposition", {
  "portfolio": "RETAINED_GENERIC_CONTRACTS_PRODUCT_RUNTIME_REMOVED",
  "dashboardProductCapability": "FUTURE_OPTIONS_INTERFACE_NOT_IMPLEMENTED",
  "legacyPythonAndOfflineDailyScanInterfaces": "REMOVED_OWNER_AUTHORIZED",
  "legacyPythonIntegrationBoundary": "REMOVED_OWNER_AUTHORIZED",
  "decisionEngine": "RETAINED_GENERIC_FOUNDATIONS_PYTHON_RUNTIME_REMOVED",
  "config": "RETAINED_AI_CONFIG_PYTHON_PRODUCT_CONFIG_REMOVED",
  "riskEngine": "OPTIONS_DIAGNOSTIC_AND_LOCAL_SIMULATION_RISK_LEGACY_PYTHON_REMOVED",
  "alpacaMarketDataComponents": "REMOVED_OBSOLETE_FIXED_PRODUCT_LANE",
  "genericTwelveDataBarAdapter": "KEEP",
  "canonicalBarsQuotes": "REUSE",
  "evidence": "REUSE",
  "marketRegime": "REUSE",
  "capitalAllocation": "REUSE",
  "journal": "REUSE",
  "predictionLog": "REUSE",
  "strategyVersioning": "REUSE",
  "etfDailyScan": "REMOVED_OWNER_AUTHORIZED",
  "eventContract": "REMOVED_OWNER_AUTHORIZED",
  "researchBacktestingFoundations": "REUSE"
}, issues);
}

function validateLegacyProductLanes(value, issues) {
  validateExactObject(value, "legacyProductLanes", {
  "etfDailyScan": {
    "status": "REMOVED_OWNER_AUTHORIZED",
    "formerNextAction": "ALPACA_D3B_IMPLEMENTATION",
    "expansion": "OUT_OF_CURRENT_PRODUCT_SCOPE"
  },
  "eventContract": {
    "status": "REMOVED_OWNER_AUTHORIZED",
    "expansion": "OUT_OF_CURRENT_PRODUCT_SCOPE"
  },
  "legacyPython": {
    "status": "REMOVED_OWNER_AUTHORIZED",
    "integrationBoundary": "REMOVED_OWNER_AUTHORIZED"
  },
  "removalEvidence": "docs/OPTIONS_FOCUS_DELETION_MANIFEST.json",
  "removedFileCount": 292
}, issues);
}

function validateValidation(value, issues) {
  if (!isRecord(value)) {
    issues.push("validation must be an object.");
    return;
  }
  const fields = ["classification", "phase1aMergedHead", "phase1bD2MergedHead", "phase1bD3AMergedHead", "phase1bD3BDesignMergedHead", "coverageBaseline", "phase0BaselineAttempt", "phase0WorkingTreeAttempt", "phase1NewsWorkingTreeAttempt", "phase1NewsCorrectiveWorkingTreeAttempt"];
  allowOnly(value, fields, "validation", issues);
  requireExactly(value, fields, "validation", issues);
  exact(value.classification, "HISTORICAL_RECORDS_PLUS_PHASE0_R1_AND_PHASE1_NEWS_OBSERVED_ATTEMPTS", "validation.classification", issues);
  validateValidationResult(value.phase1aMergedHead, "PHASE_1A_MERGED_HEAD", false, "validation.phase1aMergedHead", issues, PHASE_1A_MERGE_COMMIT);
  validateValidationResult(value.phase1bD2MergedHead, "PHASE_1B_D2_MERGED_HEAD", false, "validation.phase1bD2MergedHead", issues, PHASE_1B_D2_MERGE_COMMIT);
  if (isRecord(value.phase1bD2MergedHead)) {
    exact(value.phase1bD2MergedHead.componentCount, 138, "validation.phase1bD2MergedHead.componentCount", issues);
    exact(value.phase1bD2MergedHead.testsExecuted, 2792, "validation.phase1bD2MergedHead.testsExecuted", issues);
    exact(value.phase1bD2MergedHead.passed, 2792, "validation.phase1bD2MergedHead.passed", issues);
  }
  validateValidationResult(value.phase1bD3AMergedHead, "PHASE_1B_D3A_MERGED_HEAD", false, "validation.phase1bD3AMergedHead", issues, PHASE_1B_D3A_MERGE_COMMIT);
  if (isRecord(value.phase1bD3AMergedHead)) {
    exact(value.phase1bD3AMergedHead.componentCount, 139, "validation.phase1bD3AMergedHead.componentCount", issues);
    exact(value.phase1bD3AMergedHead.testsExecuted, 2814, "validation.phase1bD3AMergedHead.testsExecuted", issues);
    exact(value.phase1bD3AMergedHead.passed, 2814, "validation.phase1bD3AMergedHead.passed", issues);
  }
  validateValidationResult(value.phase1bD3BDesignMergedHead, "PHASE_1B_D3B_DESIGN_MERGED_HEAD", false, "validation.phase1bD3BDesignMergedHead", issues, PHASE_1B_D3B_DESIGN_MERGE_COMMIT);
  if (isRecord(value.phase1bD3BDesignMergedHead)) {
    exact(value.phase1bD3BDesignMergedHead.componentCount, 140, "validation.phase1bD3BDesignMergedHead.componentCount", issues);
    exact(value.phase1bD3BDesignMergedHead.testsExecuted, 2833, "validation.phase1bD3BDesignMergedHead.testsExecuted", issues);
    exact(value.phase1bD3BDesignMergedHead.passed, 2833, "validation.phase1bD3BDesignMergedHead.passed", issues);
  }
  validateCoverageBaseline(value.coverageBaseline, issues);
  validatePhase0ValidationAttempt(value.phase0BaselineAttempt, "PHASE_0_R1_CLEAN_BASELINE", false, "validation.phase0BaselineAttempt", issues);
  validatePhase0ValidationAttempt(value.phase0WorkingTreeAttempt, "PHASE_0_R1_WORKING_TREE", true, "validation.phase0WorkingTreeAttempt", issues);
  validateExactObject(value.phase1NewsWorkingTreeAttempt, "validation.phase1NewsWorkingTreeAttempt", {
    kind: "PHASE_1_NEWS_WORKING_TREE",
    source_baseline_commit: OPTIONS_PHASE_1_BASELINE_COMMIT,
    includesUncommittedCode: true,
    command: "npm.cmd run alpha:validate",
    status: "PASSED",
    componentCount: 145,
    testsExecuted: 2944,
    passed: 2944,
    failed: 0,
    durationMs: 98000,
    networkUsed: false,
    realCostCents: 0,
    rawEvidenceAvailability: "OBSERVED_IN_CODEX_SESSION_OUTPUT",
  }, issues);
  validateExactObject(value.phase1NewsCorrectiveWorkingTreeAttempt, "validation.phase1NewsCorrectiveWorkingTreeAttempt", {
    kind: "PHASE_1_NEWS_MERGE_GATE_CORRECTIVE_WORKING_TREE",
    source_baseline_commit: OPTIONS_PHASE_1_FIRST_CORRECTIVE_COMMIT,
    includesUncommittedCode: true,
    command: "npm.cmd run alpha:validate",
    status: "PASSED",
    componentCount: 145,
    testsExecuted: 2962,
    passed: 2962,
    failed: 0,
    durationMs: null,
    networkUsed: false,
    realCostCents: 0,
    rawEvidenceAvailability: "OBSERVED_IN_CODEX_SESSION_OUTPUT",
    evidenceAuthority: "LOCAL_CODEX_SESSION_NOT_GITHUB_CI",
  }, issues);
  if (isRecord(value.phase0BaselineAttempt) && isRecord(value.phase0WorkingTreeAttempt)) {
    if (value.phase0BaselineAttempt.comparability === "COMPARABLE" &&
      value.phase0WorkingTreeAttempt.comparability === "COMPARABLE" &&
      !deepEqual(value.phase0BaselineAttempt.environmentFingerprint, value.phase0WorkingTreeAttempt.environmentFingerprint)) {
      issues.push("Phase 0 comparable attempts must have identical environmentFingerprint values.");
    }
  }
}

function validatePhase0ValidationAttempt(value, kind, includesUncommittedCode, path, issues) {
  if (!isRecord(value)) {
    issues.push(`${path} must be an object.`);
    return;
  }
  const expectedFields = [
    "kind", "source_baseline_commit", "includesUncommittedCode", "command", "environmentFingerprint",
    "status", "completed", "componentCount", "testsExecuted", "passed", "failed", "durationMs",
    "networkUsed", "comparability", "rawEvidenceAvailability",
  ];
  allowOnly(value, expectedFields, path, issues);
  requireExactly(value, expectedFields, path, issues);
  exact(value.kind, kind, `${path}.kind`, issues);
  exact(value.source_baseline_commit, OPTIONS_PHASE_0_BASELINE_COMMIT, `${path}.source_baseline_commit`, issues);
  exact(value.includesUncommittedCode, includesUncommittedCode, `${path}.includesUncommittedCode`, issues);
  exact(value.command, "npm.cmd run alpha:validate", `${path}.command`, issues);
  validateEnvironmentFingerprint(value.environmentFingerprint, `${path}.environmentFingerprint`, issues);
  exact(value.networkUsed, false, `${path}.networkUsed`, issues);
  if (value.comparability !== "COMPARABLE" && value.comparability !== "NOT_COMPARABLE") {
    issues.push(`${path}.comparability must be COMPARABLE or NOT_COMPARABLE.`);
  }
  if (value.rawEvidenceAvailability !== "AVAILABLE_EXTERNAL_TEMP_LOG" &&
    value.rawEvidenceAvailability !== "PENDING_CURRENT_R1_RUN" && value.rawEvidenceAvailability !== "UNAVAILABLE") {
    issues.push(`${path}.rawEvidenceAvailability must be an approved evidence state.`);
  }
  validateAttemptAccounting(value, path, issues);
}

function validateEnvironmentFingerprint(value, path, issues) {
  validateExactObject(value, path, {
    nodeVersion: "v24.18.0",
    npmVersion: "11.16.0",
    operatingSystem: "Windows_NT",
    shell: "PowerShell",
    dependencySource: "LOCKED_PACKAGE_LOCK_EXISTING_NODE_MODULES_NO_INSTALL",
    packageJsonSha256: "58D08C6F8A8B66FCB03BC070BD64721E3306805DFC73732BFA312D3829E81570",
    packageLockSha256: "A8F0D1D77BF03A5EA4CAAFBF54113A99CEBCD1C14BD680FCFD45931962319673",
  }, issues);
}

function validateAttemptAccounting(value, path, issues) {
  validateTestCounts(value, path, issues, value.completed === true);
  if (!isRecord(value)) return;
  if (typeof value.completed !== "boolean") issues.push(`${path}.completed must be boolean.`);
  if (value.durationMs !== null && (!Number.isSafeInteger(value.durationMs) || value.durationMs < 0)) issues.push(`${path}.durationMs must be null or a non-negative integer.`);
  if (value.status === "PASSED") {
    if (value.completed !== true) issues.push(`${path}.completed must be true when status is PASSED.`);
    if (value.failed !== 0) issues.push(`${path}.failed must equal 0 when status is PASSED.`);
    if (value.passed !== value.testsExecuted) issues.push(`${path}.passed must equal testsExecuted when status is PASSED.`);
    if (value.rawEvidenceAvailability !== "AVAILABLE_EXTERNAL_TEMP_LOG") issues.push(`${path}.rawEvidenceAvailability must be AVAILABLE_EXTERNAL_TEMP_LOG when status is PASSED.`);
  } else if (value.status === "BLOCKED_ENVIRONMENT") {
    if (value.completed === true) issues.push(`${path}.completed must be false when status is BLOCKED_ENVIRONMENT.`);
    if (value.failed !== 0) issues.push(`${path}.failed must equal 0 when status is BLOCKED_ENVIRONMENT; infrastructure blocking is not a test failure.`);
  } else if (value.status !== "NOT_COMPARABLE" && value.status !== "UNAVAILABLE") {
    issues.push(`${path}.status must be PASSED, BLOCKED_ENVIRONMENT, NOT_COMPARABLE, or UNAVAILABLE.`);
  }
}

function validateTestCounts(value, path, issues, completedOutcomes) {
  if (!isRecord(value)) {
    issues.push(`${path} must be an object.`);
    return;
  }
  for (const field of ["componentCount", "testsExecuted", "passed", "failed"]) {
    if (!Number.isSafeInteger(value[field]) || value[field] < 0) issues.push(`${path}.${field} must be a non-negative integer.`);
  }
  if (Number.isSafeInteger(value.passed) && Number.isSafeInteger(value.testsExecuted) && value.passed > value.testsExecuted) {
    issues.push(`${path}.passed must not exceed testsExecuted.`);
  }
  if (Number.isSafeInteger(value.failed) && Number.isSafeInteger(value.testsExecuted) && value.failed > value.testsExecuted) {
    issues.push(`${path}.failed must not exceed testsExecuted.`);
  }
  if (completedOutcomes && Number.isSafeInteger(value.passed) && Number.isSafeInteger(value.failed) && Number.isSafeInteger(value.testsExecuted) && value.passed + value.failed !== value.testsExecuted) {
    issues.push(`${path}.testsExecuted must equal passed + failed for completed test outcomes.`);
  }
}

function validateValidationResult(value, kind, includesUncommittedCode, path, issues, sourceBaselineCommit = PHASE_1A_MERGE_COMMIT) {
  if (!isRecord(value)) {
    issues.push(`${path} must be an object.`);
    return;
  }
  const fields = [
    "kind", "source_baseline_commit", "includesUncommittedCode", "command", "status",
    "componentCount", "testsExecuted", "passed", "failed", "durationMs",
    "wallClockDurationMs",
  ];
  allowOnly(value, fields, path, issues);
  requireExactly(value, fields, path, issues);
  exact(value.kind, kind, `${path}.kind`, issues);
  exact(value.source_baseline_commit, sourceBaselineCommit, `${path}.source_baseline_commit`, issues);
  exact(value.includesUncommittedCode, includesUncommittedCode, `${path}.includesUncommittedCode`, issues);
  exact(value.command, "npm.cmd run alpha:validate", `${path}.command`, issues);
  exact(value.status, "PASSED", `${path}.status`, issues);
  for (const field of ["componentCount", "testsExecuted", "passed"]) {
    if (!Number.isSafeInteger(value[field]) || value[field] <= 0) issues.push(`${path}.${field} must be a positive integer.`);
  }
  exact(value.durationMs, null, `${path}.durationMs`, issues);
  exact(value.wallClockDurationMs, null, `${path}.wallClockDurationMs`, issues);
  exact(value.failed, 0, `${path}.failed`, issues);
  validateTestCounts(value, path, issues, true);
  if (Number.isSafeInteger(value.testsExecuted) && Number.isSafeInteger(value.passed) && value.testsExecuted !== value.passed) {
    issues.push(`${path}.passed must equal testsExecuted when status is PASSED.`);
  }
}

function validateCoverageBaseline(value, issues) {
  if (!isRecord(value)) {
    issues.push("validation.coverageBaseline must be an object.");
    return;
  }
  const fields = ["metric", "status", "registeredTests", "instrumentedCodeCoverage"];
  allowOnly(value, fields, "validation.coverageBaseline", issues);
  requireExactly(value, fields, "validation.coverageBaseline", issues);
  exact(value.metric, "REGISTERED_VALIDATION_EXECUTION", "validation.coverageBaseline.metric", issues);
  exact(value.status, "ESTABLISHED", "validation.coverageBaseline.status", issues);
  if (!isRecord(value.registeredTests)) {
    issues.push("validation.coverageBaseline.registeredTests must be an object.");
  } else {
    const testFields = ["executed", "passed", "failed"];
    allowOnly(value.registeredTests, testFields, "validation.coverageBaseline.registeredTests", issues);
    requireExactly(value.registeredTests, testFields, "validation.coverageBaseline.registeredTests", issues);
    if (!Number.isSafeInteger(value.registeredTests.executed) || value.registeredTests.executed <= 0) {
      issues.push("validation.coverageBaseline.registeredTests.executed must be positive.");
    }
    exact(value.registeredTests.passed, value.registeredTests.executed, "validation.coverageBaseline.registeredTests.passed", issues);
    exact(value.registeredTests.failed, 0, "validation.coverageBaseline.registeredTests.failed", issues);
  }
  validateExactObject(value.instrumentedCodeCoverage, "validation.coverageBaseline.instrumentedCodeCoverage", {
    status: "NOT_AVAILABLE",
    reasonCode: "NO_REGISTERED_INSTRUMENTER_AND_V8_ENV_INCOMPATIBLE_WITH_SECURITY_DRILL",
  }, issues);
}

function validateStatusItems(value, path, issues) {
  if (!Array.isArray(value) || value.length > 32 || new Set(value).size !== value.length) {
    issues.push(`${path} must be a unique bounded array.`);
    return;
  }
  if (value.some((item) => typeof item !== "string" || !STATUS_ITEM.test(item))) {
    issues.push(`${path} contains an invalid status identifier.`);
  }
}

function requireStatusItem(value, expected, path, issues) {
  if (!Array.isArray(value) || !value.includes(expected)) {
    issues.push(`${path} must include ${JSON.stringify(expected)}.`);
  }
}

function validateExactObject(value, path, expected, issues) {
  if (!isRecord(value)) {
    issues.push(`${path} must be an object.`);
    return;
  }
  const fields = Object.keys(expected);
  allowOnly(value, fields, path, issues);
  requireExactly(value, fields, path, issues);
  for (const [field, expectedValue] of Object.entries(expected)) {
    exact(value[field], expectedValue, `${path}.${field}`, issues);
  }
}

function allowOnly(value, allowedFields, path, issues) {
  const allowed = new Set(allowedFields);
  for (const field of Object.keys(value)) {
    if (!allowed.has(field)) issues.push(`${path}.${field} is undeclared.`);
  }
}

function requireExactly(value, requiredFields, path, issues) {
  for (const field of requiredFields) {
    if (!Object.hasOwn(value, field)) issues.push(`${path}.${field} is required.`);
  }
}

function exact(actual, expected, path, issues) {
  if (!deepEqual(actual, expected)) issues.push(`${path} must equal ${JSON.stringify(expected)}.`);
}

function sameStringSet(left, right) {
  return left.length === right.length && [...left].sort().every((item, index) => item === [...right].sort()[index]);
}

function isCanonicalTimestamp(value) {
  return typeof value === "string" &&
    Number.isFinite(Date.parse(value)) &&
    new Date(Date.parse(value)).toISOString() === value;
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function result(issues) {
  return Object.freeze({
    valid: issues.length === 0,
    issues: Object.freeze([...issues].sort()),
  });
}

const isMain = process.argv[1] !== undefined &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  try {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
    loadAndValidateCurrentStatus(root);
    console.log("Alpha current status validation passed.");
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
