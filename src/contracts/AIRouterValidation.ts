import {
  AICapability,
  AIOutputType,
  AITaskType,
  LatencyPriority,
  ModelAvailability,
  PrivacyLevel,
  ProviderProcessingBoundary,
  ReasoningLevel,
  RoutingAuditStatus,
  RoutingDecisionStatus,
  type AIRequest,
  type CostEstimate,
  type ModelDefinition,
  type ProviderDefinition,
  type RoutingAuditRecord,
  type RoutingCandidate,
  type RoutingDecision,
} from "./AIRouter";
import {
  RoutingCostMode,
  RoutingTieBreakField,
  type AIRouterConfiguration,
  type BudgetPolicy,
} from "./AIRouterConfig";

function validateNonEmptyString(name: string, value: string): void {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Invalid ${name}: expected a non-empty string.`);
  }
}

function validateTimestamp(name: string, value: string): void {
  validateNonEmptyString(name, value);
  if (!Number.isFinite(Date.parse(value))) {
    throw new Error(`Invalid ${name}: expected an ISO-8601 timestamp.`);
  }
}

function validateNonNegativeNumber(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(
      `Invalid ${name}: expected a finite non-negative number; received ${String(value)}.`,
    );
  }
}

function validatePercentage(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error(
      `Invalid ${name}: expected a finite number from 0 to 100; received ${String(value)}.`,
    );
  }
}

function validateReliability(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(
      `Invalid ${name}: expected a finite number from 0 to 1; received ${String(value)}.`,
    );
  }
}

function validateNonNegativeInteger(name: string, value: number): void {
  validateNonNegativeNumber(name, value);
  if (!Number.isInteger(value)) {
    throw new Error(`Invalid ${name}: expected an integer.`);
  }
}

function validatePositiveInteger(name: string, value: number): void {
  validateNonNegativeInteger(name, value);
  if (value === 0) {
    throw new Error(`Invalid ${name}: expected an integer greater than zero.`);
  }
}

function validateUniqueNonEmptyStrings(
  name: string,
  values: ReadonlyArray<string>,
  allowEmpty: boolean,
): void {
  if (!allowEmpty && values.length === 0) {
    throw new Error(`Invalid ${name}: expected at least one item.`);
  }
  for (const value of values) {
    validateNonEmptyString(name, value);
  }
  if (new Set(values).size !== values.length) {
    throw new Error(`Invalid ${name}: duplicate items are not allowed.`);
  }
}

function validateEnumValue<T extends string>(
  name: string,
  value: T,
  validValues: ReadonlyArray<T>,
): void {
  if (!validValues.includes(value)) {
    throw new Error(`Invalid ${name}: received ${String(value)}.`);
  }
}

function validateEnumArray<T extends string>(
  name: string,
  values: ReadonlyArray<T>,
  validValues: ReadonlyArray<T>,
  allowEmpty: boolean,
): void {
  if (!allowEmpty && values.length === 0) {
    throw new Error(`Invalid ${name}: expected at least one item.`);
  }
  for (const value of values) {
    validateEnumValue(name, value, validValues);
  }
  if (new Set(values).size !== values.length) {
    throw new Error(`Invalid ${name}: duplicate items are not allowed.`);
  }
}

function validateCandidate(name: string, candidate: RoutingCandidate): void {
  validateNonEmptyString(`${name}.providerId`, candidate.providerId);
  validateNonEmptyString(`${name}.modelId`, candidate.modelId);
}

export function validateCostEstimate(estimate: CostEstimate): void {
  validateNonEmptyString("costEstimate.currency", estimate.currency);
  validateNonEmptyString(
    "costEstimate.pricingVersion",
    estimate.pricingVersion,
  );
  validateNonNegativeNumber(
    "costEstimate.estimatedInputCost",
    estimate.estimatedInputCost,
  );
  validateNonNegativeNumber(
    "costEstimate.estimatedOutputCost",
    estimate.estimatedOutputCost,
  );
  validateNonNegativeNumber(
    "costEstimate.estimatedFixedCost",
    estimate.estimatedFixedCost,
  );
  validateNonNegativeNumber(
    "costEstimate.estimatedTotalCost",
    estimate.estimatedTotalCost,
  );

  const componentTotal =
    estimate.estimatedInputCost +
    estimate.estimatedOutputCost +
    estimate.estimatedFixedCost;
  if (Math.abs(componentTotal - estimate.estimatedTotalCost) > 0.000000001) {
    throw new Error(
      "Invalid costEstimate.estimatedTotalCost: expected the sum of cost components.",
    );
  }
}

export function validateAIRequest(request: AIRequest): void {
  if (request.contractVersion !== "1.0") {
    throw new Error("Invalid contractVersion: expected 1.0.");
  }
  validateNonEmptyString("requestId", request.requestId);
  validateTimestamp("requestedAt", request.requestedAt);
  validateNonEmptyString("requestedBy", request.requestedBy);
  validateNonEmptyString("contextFingerprint", request.contextFingerprint);
  validateEnumValue("taskType", request.taskType, Object.values(AITaskType));
  validateEnumArray(
    "requiredCapabilities",
    request.requiredCapabilities,
    Object.values(AICapability),
    false,
  );
  validateEnumValue(
    "reasoningLevel",
    request.reasoningLevel,
    Object.values(ReasoningLevel),
  );

  const constraints = request.constraints;
  validateNonNegativeInteger(
    "constraints.estimatedInputTokens",
    constraints.estimatedInputTokens,
  );
  validatePositiveInteger(
    "constraints.reservedOutputTokens",
    constraints.reservedOutputTokens,
  );
  validateNonNegativeNumber(
    "constraints.maximumEstimatedCost",
    constraints.maximumEstimatedCost,
  );
  validateNonEmptyString("constraints.currency", constraints.currency);
  validateEnumValue(
    "constraints.latencyPriority",
    constraints.latencyPriority,
    Object.values(LatencyPriority),
  );
  if (constraints.deadlineMs !== undefined) {
    validatePositiveInteger("constraints.deadlineMs", constraints.deadlineMs);
  }
  validateEnumValue(
    "constraints.privacyLevel",
    constraints.privacyLevel,
    Object.values(PrivacyLevel),
  );
  validateEnumValue(
    "constraints.expectedOutputType",
    constraints.expectedOutputType,
    Object.values(AIOutputType),
  );

  if (
    constraints.privacyLevel === PrivacyLevel.LocalOnly &&
    constraints.externalProcessingAllowed
  ) {
    throw new Error(
      "Invalid constraints: LOCAL_ONLY privacy cannot allow external processing.",
    );
  }

  if (constraints.allowedProcessingRegions !== undefined) {
    validateUniqueNonEmptyStrings(
      "constraints.allowedProcessingRegions",
      constraints.allowedProcessingRegions,
      false,
    );
  }

  if (constraints.outputSchemaId !== undefined) {
    validateNonEmptyString(
      "constraints.outputSchemaId",
      constraints.outputSchemaId,
    );
  }
  if (constraints.strictSchema && constraints.outputSchemaId === undefined) {
    throw new Error(
      "Invalid constraints: strictSchema requires outputSchemaId.",
    );
  }

  if (request.criticalOverride !== undefined) {
    validateNonEmptyString(
      "criticalOverride.authorizationId",
      request.criticalOverride.authorizationId,
    );
    validateNonEmptyString(
      "criticalOverride.approvedBy",
      request.criticalOverride.approvedBy,
    );
    validateNonNegativeNumber(
      "criticalOverride.maximumAdditionalCost",
      request.criticalOverride.maximumAdditionalCost,
    );
    validateTimestamp(
      "criticalOverride.expiresAt",
      request.criticalOverride.expiresAt,
    );
    validateNonEmptyString(
      "criticalOverride.reason",
      request.criticalOverride.reason,
    );
  }
}

export function validateProviderDefinition(
  provider: ProviderDefinition,
): void {
  validateNonEmptyString("provider.providerId", provider.providerId);
  validateNonEmptyString("provider.name", provider.name);
  validateNonEmptyString("provider.adapterId", provider.adapterId);
  validateEnumValue(
    "provider.processingBoundary",
    provider.processingBoundary,
    Object.values(ProviderProcessingBoundary),
  );
  validateEnumArray(
    "provider.supportedPrivacyLevels",
    provider.supportedPrivacyLevels,
    Object.values(PrivacyLevel),
    false,
  );
  validateUniqueNonEmptyStrings(
    "provider.supportedProcessingRegions",
    provider.supportedProcessingRegions,
    provider.processingBoundary === ProviderProcessingBoundary.Local,
  );
  validateReliability("provider.reliability", provider.reliability);
  validateEnumValue(
    "provider.availability",
    provider.availability,
    Object.values(ModelAvailability),
  );
  validateUniqueNonEmptyStrings("provider.modelIds", provider.modelIds, false);
}

export function validateModelDefinition(model: ModelDefinition): void {
  validateNonEmptyString("model.modelId", model.modelId);
  validateNonEmptyString("model.providerId", model.providerId);
  validateNonEmptyString(
    "model.providerModelReference",
    model.providerModelReference,
  );
  validateEnumArray(
    "model.capabilities",
    model.capabilities,
    Object.values(AICapability),
    false,
  );
  validateEnumArray(
    "model.supportedReasoningLevels",
    model.supportedReasoningLevels,
    Object.values(ReasoningLevel),
    false,
  );
  validateEnumArray(
    "model.supportedPrivacyLevels",
    model.supportedPrivacyLevels,
    Object.values(PrivacyLevel),
    false,
  );
  validateEnumArray(
    "model.supportedOutputTypes",
    model.supportedOutputTypes,
    Object.values(AIOutputType),
    false,
  );
  validatePositiveInteger("model.contextLimitTokens", model.contextLimitTokens);
  validatePositiveInteger(
    "model.maximumOutputTokens",
    model.maximumOutputTokens,
  );
  if (model.maximumOutputTokens > model.contextLimitTokens) {
    throw new Error(
      "Invalid model.maximumOutputTokens: it cannot exceed contextLimitTokens.",
    );
  }
  validateReliability("model.reliability", model.reliability);
  validateEnumValue(
    "model.availability",
    model.availability,
    Object.values(ModelAvailability),
  );
  validateNonNegativeInteger(
    "model.estimatedP95LatencyMs",
    model.estimatedP95LatencyMs,
  );

  validateNonEmptyString("model.cost.currency", model.cost.currency);
  validateNonEmptyString(
    "model.cost.pricingVersion",
    model.cost.pricingVersion,
  );
  validateTimestamp("model.cost.effectiveAt", model.cost.effectiveAt);
  validateNonNegativeNumber(
    "model.cost.inputPerMillionTokens",
    model.cost.inputPerMillionTokens,
  );
  validateNonNegativeNumber(
    "model.cost.outputPerMillionTokens",
    model.cost.outputPerMillionTokens,
  );
  if (model.cost.cachedInputPerMillionTokens !== undefined) {
    validateNonNegativeNumber(
      "model.cost.cachedInputPerMillionTokens",
      model.cost.cachedInputPerMillionTokens,
    );
  }
  if (model.cost.fixedRequestCost !== undefined) {
    validateNonNegativeNumber(
      "model.cost.fixedRequestCost",
      model.cost.fixedRequestCost,
    );
  }
}

export function validateBudgetPolicy(policy: BudgetPolicy): void {
  validateNonEmptyString("budgetPolicy.policyId", policy.policyId);
  validateNonEmptyString("budgetPolicy.version", policy.version);
  validateNonEmptyString("budgetPolicy.currency", policy.currency);
  validateNonEmptyString(
    "budgetPolicy.accountingTimezone",
    policy.accountingTimezone,
  );
  validateNonNegativeNumber(
    "budgetPolicy.perRequestLimit",
    policy.perRequestLimit,
  );
  validateNonNegativeNumber("budgetPolicy.dailyBudget", policy.dailyBudget);
  validateNonNegativeNumber("budgetPolicy.monthlyBudget", policy.monthlyBudget);
  validatePercentage(
    "budgetPolicy.warningThresholdPercentage",
    policy.warningThresholdPercentage,
  );

  if (policy.perRequestLimit > policy.dailyBudget) {
    throw new Error(
      "Invalid budgetPolicy: perRequestLimit cannot exceed dailyBudget.",
    );
  }
  if (policy.dailyBudget > policy.monthlyBudget) {
    throw new Error(
      "Invalid budgetPolicy: dailyBudget cannot exceed monthlyBudget.",
    );
  }
  if (policy.criticalOverrideLimit !== undefined) {
    validateNonNegativeNumber(
      "budgetPolicy.criticalOverrideLimit",
      policy.criticalOverrideLimit,
    );
    if (!policy.criticalOverrideAllowed) {
      throw new Error(
        "Invalid budgetPolicy: criticalOverrideLimit requires criticalOverrideAllowed.",
      );
    }
  }
}

export function validateRoutingDecision(decision: RoutingDecision): void {
  validateNonEmptyString("decision.decisionId", decision.decisionId);
  validateNonEmptyString("decision.requestId", decision.requestId);
  validateTimestamp("decision.createdAt", decision.createdAt);
  validateNonEmptyString("decision.policyVersion", decision.policyVersion);
  validateNonEmptyString("decision.registryVersion", decision.registryVersion);
  validateNonEmptyString(
    "decision.routingReason.summary",
    decision.routingReason.summary,
  );
  validateNonEmptyString(
    "decision.routingReason.policyName",
    decision.routingReason.policyName,
  );
  validateUniqueNonEmptyStrings(
    "decision.routingReason.reasonCodes",
    decision.routingReason.reasonCodes,
    false,
  );
  validatePercentage("decision.routingConfidence", decision.routingConfidence);
  validateNonNegativeInteger(
    "decision.estimatedLatencyMs",
    decision.estimatedLatencyMs,
  );
  validateCostEstimate(decision.estimatedCost);

  for (const candidate of decision.eligibleCandidates) {
    validateCandidate("decision.eligibleCandidate", candidate);
  }
  for (const candidate of decision.rejectedCandidates) {
    validateCandidate("decision.rejectedCandidate", candidate);
    validateUniqueNonEmptyStrings(
      "decision.rejectedCandidate.reasons",
      candidate.reasons,
      false,
    );
  }
  for (const [index, candidate] of decision.fallbackChain.entries()) {
    validateCandidate("decision.fallbackCandidate", candidate);
    if (candidate.order !== index + 1) {
      throw new Error(
        "Invalid decision.fallbackChain: order must be consecutive and start at 1.",
      );
    }
    validateCostEstimate(candidate.estimatedCost);
    validateNonEmptyString(
      "decision.fallbackCandidate.selectionReason.summary",
      candidate.selectionReason.summary,
    );
    validateUniqueNonEmptyStrings(
      "decision.fallbackCandidate.selectionReason.reasonCodes",
      candidate.selectionReason.reasonCodes,
      false,
    );
  }

  validateEnumValue(
    "decision.status",
    decision.status,
    Object.values(RoutingDecisionStatus),
  );
  if (decision.status === RoutingDecisionStatus.AiSelected) {
    validateNonEmptyString(
      "decision.selectedProviderId",
      decision.selectedProviderId,
    );
    validateNonEmptyString("decision.selectedModelId", decision.selectedModelId);
  }
  if (decision.status === RoutingDecisionStatus.DeterministicSelected) {
    validateNonEmptyString(
      "decision.deterministicHandlerId",
      decision.deterministicHandlerId,
    );
  }
  if (decision.status === RoutingDecisionStatus.Rejected) {
    validateUniqueNonEmptyStrings(
      "decision.rejectionReasons",
      decision.rejectionReasons,
      false,
    );
  }
}

export function validateRoutingAuditRecord(record: RoutingAuditRecord): void {
  validateNonEmptyString("audit.auditId", record.auditId);
  validateNonEmptyString("audit.requestId", record.requestId);
  validateNonEmptyString("audit.decisionId", record.decisionId);
  validateTimestamp("audit.timestamp", record.timestamp);
  validateNonEmptyString("audit.contextFingerprint", record.contextFingerprint);
  validateNonEmptyString("audit.policyVersion", record.policyVersion);
  validateNonEmptyString("audit.registryVersion", record.registryVersion);
  validateNonEmptyString(
    "audit.budgetPolicyVersion",
    record.budgetPolicyVersion,
  );
  validateEnumValue("audit.taskType", record.taskType, Object.values(AITaskType));
  validateEnumArray(
    "audit.requiredCapabilities",
    record.requiredCapabilities,
    Object.values(AICapability),
    false,
  );
  validateEnumValue(
    "audit.reasoningLevel",
    record.reasoningLevel,
    Object.values(ReasoningLevel),
  );
  validateEnumValue(
    "audit.privacyLevel",
    record.privacyLevel,
    Object.values(PrivacyLevel),
  );
  validateEnumValue(
    "audit.finalStatus",
    record.finalStatus,
    Object.values(RoutingAuditStatus),
  );
  validateCostEstimate(record.estimatedCost);
  validateNonNegativeInteger("audit.retryCount", record.retryCount);
  validateNonNegativeInteger("audit.fallbackCount", record.fallbackCount);
  for (const [index, candidate] of record.fallbackPlan.entries()) {
    validateCandidate("audit.fallbackCandidate", candidate);
    if (candidate.order !== index + 1) {
      throw new Error(
        "Invalid audit.fallbackPlan: order must be consecutive and start at 1.",
      );
    }
    validateCostEstimate(candidate.estimatedCost);
  }
  if (record.fallbackCount > record.fallbackPlan.length) {
    throw new Error(
      "Invalid audit.fallbackCount: it cannot exceed the planned fallback count.",
    );
  }

  const selectionCount =
    (record.selectedProviderId !== undefined ||
    record.selectedModelId !== undefined
      ? 1
      : 0) + (record.deterministicHandlerId !== undefined ? 1 : 0);
  if (
    (record.selectedProviderId === undefined) !==
    (record.selectedModelId === undefined)
  ) {
    throw new Error(
      "Invalid audit selection: provider and model must be recorded together.",
    );
  }
  if (selectionCount > 1) {
    throw new Error(
      "Invalid audit selection: AI and deterministic selections are mutually exclusive.",
    );
  }
  if (
    record.finalStatus !== RoutingAuditStatus.Rejected &&
    selectionCount === 0
  ) {
    throw new Error(
      "Invalid audit selection: non-rejected records require a selected route.",
    );
  }
  if (
    record.finalStatus === RoutingAuditStatus.Failed &&
    record.failure === undefined
  ) {
    throw new Error("Invalid audit failure: FAILED status requires failure data.");
  }
}

export function validateAIRouterConfiguration(
  configuration: AIRouterConfiguration,
): void {
  if (configuration.contractVersion !== "1.0") {
    throw new Error("Invalid configuration.contractVersion: expected 1.0.");
  }
  validateNonEmptyString(
    "configuration.configurationVersion",
    configuration.configurationVersion,
  );
  validateNonEmptyString(
    "configuration.providerRegistry.version",
    configuration.providerRegistry.version,
  );
  validateNonEmptyString(
    "configuration.modelRegistry.version",
    configuration.modelRegistry.version,
  );
  validateNonEmptyString(
    "configuration.routingPolicy.version",
    configuration.routingPolicy.version,
  );
  validateNonEmptyString(
    "configuration.fallbackPolicy.version",
    configuration.fallbackPolicy.version,
  );
  validateBudgetPolicy(configuration.budgetPolicy);

  if (configuration.providerRegistry.providers.length === 0) {
    throw new Error(
      "Invalid configuration.providerRegistry: expected at least one provider.",
    );
  }
  if (configuration.modelRegistry.models.length === 0) {
    throw new Error(
      "Invalid configuration.modelRegistry: expected at least one model.",
    );
  }

  const providerIds = configuration.providerRegistry.providers.map(
    (provider) => provider.providerId,
  );
  const modelIds = configuration.modelRegistry.models.map(
    (model) => model.modelId,
  );
  validateUniqueNonEmptyStrings("provider IDs", providerIds, false);
  validateUniqueNonEmptyStrings("model IDs", modelIds, false);

  const providersById = new Map(
    configuration.providerRegistry.providers.map((provider) => [
      provider.providerId,
      provider,
    ]),
  );
  const modelsById = new Map(
    configuration.modelRegistry.models.map((model) => [model.modelId, model]),
  );

  for (const provider of configuration.providerRegistry.providers) {
    validateProviderDefinition(provider);
    for (const modelId of provider.modelIds) {
      const model = modelsById.get(modelId);
      if (model === undefined || model.providerId !== provider.providerId) {
        throw new Error(
          `Invalid provider.modelIds: ${modelId} is not registered to ${provider.providerId}.`,
        );
      }
    }
  }

  for (const model of configuration.modelRegistry.models) {
    validateModelDefinition(model);
    const provider = providersById.get(model.providerId);
    if (provider === undefined || !provider.modelIds.includes(model.modelId)) {
      throw new Error(
        `Invalid model.providerId: ${model.modelId} is not linked by ${model.providerId}.`,
      );
    }
  }

  const routingPolicy = configuration.routingPolicy;
  validateNonNegativeInteger(
    "routingPolicy.contextSafetyMarginTokens",
    routingPolicy.contextSafetyMarginTokens,
  );
  validatePositiveInteger(
    "routingPolicy.staleHealthAfterMs",
    routingPolicy.staleHealthAfterMs,
  );
  validateEnumArray(
    "routingPolicy.stableTieBreakOrder",
    routingPolicy.stableTieBreakOrder,
    Object.values(RoutingTieBreakField),
    false,
  );

  const configuredCapabilities = routingPolicy.capabilityProfiles.map(
    (profile) => profile.capability,
  );
  validateEnumArray(
    "routingPolicy.capabilityProfiles",
    configuredCapabilities,
    Object.values(AICapability),
    false,
  );
  for (const profile of routingPolicy.capabilityProfiles) {
    validateReliability(
      "routingPolicy.capabilityProfile.minimumReliability",
      profile.minimumReliability,
    );
    if (profile.maximumP95LatencyMs !== undefined) {
      validatePositiveInteger(
        "routingPolicy.capabilityProfile.maximumP95LatencyMs",
        profile.maximumP95LatencyMs,
      );
    }
    if (profile.minimumContextTokens !== undefined) {
      validatePositiveInteger(
        "routingPolicy.capabilityProfile.minimumContextTokens",
        profile.minimumContextTokens,
      );
    }
  }

  const configuredTasks = routingPolicy.taskPolicies.map(
    (policy) => policy.taskType,
  );
  validateEnumArray(
    "routingPolicy.taskPolicies",
    configuredTasks,
    Object.values(AITaskType),
    false,
  );
  for (const policy of routingPolicy.taskPolicies) {
    validateEnumArray(
      "routingPolicy.taskPolicy.requiredCapabilities",
      policy.requiredCapabilities,
      Object.values(AICapability),
      false,
    );
    validateEnumValue(
      "routingPolicy.taskPolicy.minimumReasoningLevel",
      policy.minimumReasoningLevel,
      Object.values(ReasoningLevel),
    );
    validateEnumArray(
      "routingPolicy.taskPolicy.allowedOutputTypes",
      policy.allowedOutputTypes,
      Object.values(AIOutputType),
      false,
    );
    validateReliability(
      "routingPolicy.taskPolicy.minimumReliability",
      policy.minimumReliability,
    );
    validateEnumValue(
      "routingPolicy.taskPolicy.costMode",
      policy.costMode,
      Object.values(RoutingCostMode),
    );
  }

  const fallbackPolicy = configuration.fallbackPolicy;
  validatePositiveInteger(
    "fallbackPolicy.maximumTotalAttempts",
    fallbackPolicy.maximumTotalAttempts,
  );
  validateNonNegativeInteger(
    "fallbackPolicy.maximumRetriesPerCandidate",
    fallbackPolicy.maximumRetriesPerCandidate,
  );
  validateNonNegativeInteger(
    "fallbackPolicy.outputRepairRetries",
    fallbackPolicy.outputRepairRetries,
  );
  validateNonNegativeInteger(
    "fallbackPolicy.baseBackoffMs",
    fallbackPolicy.baseBackoffMs,
  );
  validateNonNegativeInteger(
    "fallbackPolicy.maximumBackoffMs",
    fallbackPolicy.maximumBackoffMs,
  );
  if (fallbackPolicy.baseBackoffMs > fallbackPolicy.maximumBackoffMs) {
    throw new Error(
      "Invalid fallbackPolicy: baseBackoffMs cannot exceed maximumBackoffMs.",
    );
  }
}
