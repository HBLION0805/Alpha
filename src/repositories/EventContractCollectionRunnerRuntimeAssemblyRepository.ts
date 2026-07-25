import type {
  CollectionRunnerRuntimeT6ExecutionRequest,
  CollectionRunnerRuntimeT6ExecutionResult,
  CollectionRunnerRuntimeWorkSnapshot,
  CollectionRunnerRuntimeWorkSnapshotRequest,
} from "../contracts";

export interface EventContractCollectionRunnerRuntimeWorkSnapshotRepository {
  readWorkSnapshot(
    request: Readonly<CollectionRunnerRuntimeWorkSnapshotRequest>,
  ): CollectionRunnerRuntimeWorkSnapshot;
}

export interface EventContractCollectionRunnerRuntimeT6Executor {
  execute(
    request: Readonly<CollectionRunnerRuntimeT6ExecutionRequest>,
  ): CollectionRunnerRuntimeT6ExecutionResult;
}
