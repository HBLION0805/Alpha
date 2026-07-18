import {
  AIProviderCompatibilityReason,
  type AIAdapterCompatibility,
  type AIExecutionRequest,
  type AIProviderAdapter,
  type AIProviderAdapterDescriptor,
  type AIProviderAdapterRegistry,
  validateAIAdapterCompatibility,
  validateAIExecutionRequest,
  validateAIProviderAdapterDescriptor,
  validateAIProviderHealth,
} from "../../contracts";

interface RegistryEntry {
  readonly adapter: AIProviderAdapter;
  readonly descriptor: Readonly<AIProviderAdapterDescriptor>;
}

function requireProviderId(providerId: string): void {
  if (typeof providerId !== "string" || providerId.trim().length === 0) {
    throw new Error(
      "Invalid providerId: expected a non-empty provider identifier.",
    );
  }
}

export function evaluateAdapterCompatibility(
  descriptor: Readonly<AIProviderAdapterDescriptor>,
  request: Readonly<AIExecutionRequest>,
): AIAdapterCompatibility {
  validateAIProviderAdapterDescriptor(descriptor);
  validateAIExecutionRequest(request);

  const capabilities = descriptor.capabilities;
  const reasons: AIProviderCompatibilityReason[] = [];
  if (!descriptor.enabled) {
    reasons.push(AIProviderCompatibilityReason.AdapterDisabled);
  }
  if (descriptor.providerId !== request.providerId) {
    reasons.push(AIProviderCompatibilityReason.ProviderMismatch);
  }
  if (!descriptor.supportedModelIds.includes(request.modelId)) {
    reasons.push(AIProviderCompatibilityReason.ModelUnsupported);
  }
  if (
    request.requiredCapabilities.some(
      (capability) =>
        !capabilities.supportedCapabilities.includes(capability),
    )
  ) {
    reasons.push(AIProviderCompatibilityReason.CapabilityUnsupported);
  }
  if (!capabilities.supportedReasoningLevels.includes(request.reasoningLevel)) {
    reasons.push(AIProviderCompatibilityReason.ReasoningUnsupported);
  }
  if (!capabilities.supportedPrivacyLevels.includes(request.privacyLevel)) {
    reasons.push(AIProviderCompatibilityReason.PrivacyUnsupported);
  }
  if (!capabilities.supportedOutputTypes.includes(request.expectedOutputType)) {
    reasons.push(AIProviderCompatibilityReason.OutputUnsupported);
  }
  if (request.contextTokenLimit > capabilities.maximumContextTokens) {
    reasons.push(AIProviderCompatibilityReason.ContextLimitExceeded);
  }
  if (request.maximumOutputTokens > capabilities.maximumOutputTokens) {
    reasons.push(AIProviderCompatibilityReason.OutputLimitExceeded);
  }
  if (!capabilities.timeoutSupported) {
    reasons.push(AIProviderCompatibilityReason.TimeoutUnsupported);
  }
  if (!capabilities.cancellationSupported) {
    reasons.push(AIProviderCompatibilityReason.CancellationUnsupported);
  }

  return { compatible: reasons.length === 0, reasons };
}

export class InMemoryAIProviderAdapterRegistry
  implements AIProviderAdapterRegistry
{
  private readonly entriesByProviderId = new Map<string, RegistryEntry>();

  register(adapter: AIProviderAdapter): void {
    const descriptor = adapter.getDescriptor();
    validateAIProviderAdapterDescriptor(descriptor);
    const health = adapter.getHealth();
    validateAIProviderHealth(health);
    if (health.providerId !== descriptor.providerId) {
      throw new Error(
        "Invalid adapter health: providerId must match the descriptor.",
      );
    }
    if (this.entriesByProviderId.has(descriptor.providerId)) {
      throw new Error(
        `Duplicate provider adapter: ${descriptor.providerId} is already registered.`,
      );
    }
    this.entriesByProviderId.set(descriptor.providerId, {
      adapter,
      descriptor,
    });
  }

  getByProviderId(providerId: string): AIProviderAdapter | undefined {
    requireProviderId(providerId);
    return this.entriesByProviderId.get(providerId)?.adapter;
  }

  listDescriptors(): ReadonlyArray<Readonly<AIProviderAdapterDescriptor>> {
    return [...this.entriesByProviderId.values()]
      .map((entry) => entry.descriptor)
      .sort(
        (left, right) =>
          left.providerId.localeCompare(right.providerId) ||
          left.adapterId.localeCompare(right.adapterId),
      );
  }

  findCompatibleAdapters(
    request: Readonly<AIExecutionRequest>,
  ): ReadonlyArray<AIProviderAdapter> {
    validateAIExecutionRequest(request);
    return [...this.entriesByProviderId.values()]
      .sort(
        (left, right) =>
          left.descriptor.providerId.localeCompare(right.descriptor.providerId) ||
          left.descriptor.adapterId.localeCompare(right.descriptor.adapterId),
      )
      .filter((entry) => {
        const boundaryCompatibility = evaluateAdapterCompatibility(
          entry.descriptor,
          request,
        );
        const adapterCompatibility = entry.adapter.supports(request);
        validateAIAdapterCompatibility(adapterCompatibility);
        return (
          boundaryCompatibility.compatible && adapterCompatibility.compatible
        );
      })
      .map((entry) => entry.adapter);
  }
}
