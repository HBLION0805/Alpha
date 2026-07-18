import type {
  AIRuntimeWorkflowRepository,
  AIRuntimeWorkflowStoredOperation,
} from "../contracts";

function clone<T>(value: T): T {
  return structuredClone(value);
}

export class InMemoryAIRuntimeWorkflowRepository
  implements AIRuntimeWorkflowRepository
{
  private readonly byWorkflowId = new Map<string, AIRuntimeWorkflowStoredOperation>();
  private readonly byIdempotencyKey = new Map<string, AIRuntimeWorkflowStoredOperation>();

  getByWorkflowId(workflowId: string): AIRuntimeWorkflowStoredOperation | undefined {
    const operation = this.byWorkflowId.get(workflowId);
    return operation === undefined ? undefined : clone(operation);
  }

  getByIdempotencyKey(idempotencyKey: string): AIRuntimeWorkflowStoredOperation | undefined {
    const operation = this.byIdempotencyKey.get(idempotencyKey);
    return operation === undefined ? undefined : clone(operation);
  }

  append(operation: Readonly<AIRuntimeWorkflowStoredOperation>): boolean {
    if (
      this.byWorkflowId.has(operation.workflowId) ||
      this.byIdempotencyKey.has(operation.idempotencyKey)
    ) return false;
    const stored = clone(operation);
    this.byWorkflowId.set(stored.workflowId, stored);
    this.byIdempotencyKey.set(stored.idempotencyKey, stored);
    return true;
  }
}
