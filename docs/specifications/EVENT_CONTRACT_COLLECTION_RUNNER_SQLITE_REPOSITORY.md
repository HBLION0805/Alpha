# Event Contract Collection Runner SQLite Repository v1

## Status

Day15-T3B10-T3B implements the named local SQLite repository operations and atomic transactions required by T3B10-T2. It is implemented locally and pending owner review.

This milestone does not create an application runtime store, start a scheduler or worker, invoke a provider, activate a real pilot, publish outbox events, perform recovery or backup, or add probability, recommendation, portfolio, broker, order, or execution behavior.

## Public boundary

`EventContractCollectionRunnerSqliteStore.createRunnerRepository()` returns the restricted `EventContractCollectionRunnerRepository` port. The port exposes named commands and sanitized immutable reads only. It does not expose `DatabaseSync`, arbitrary SQL, raw canonical JSON, credentials, provider bodies, or generic mutation methods.

The implemented write operations are:

1. `registerRunnerDefinition` — T2 definition registration;
2. `createPilotArtifact` — T3 owner-approved artifact creation;
3. `materializeTasks` — T4 complete frozen task-set materialization;
4. `transitionPilot` — T5 pilot compare-and-swap transition;
5. `transitionTask` — T6 due or terminal transition without transport;
6. `acquireTaskLease` — T7 durable single-worker lease;
7. `startTaskAttempt` — T8 durable request claim and budget consumption;
8. `markTaskValidating` — T8B durable `IN_FLIGHT -> VALIDATING` transition;
9. `finalizeTaskFailure` — T9 sanitized failure result and bounded retry/terminal transition;
10. `commitTaskEvidence` — T10 atomic normalized-evidence commit.

T8B is the explicit reconciliation required to make T10's `VALIDATING` precondition reachable. It performs no provider request, adds no result, and changes no budget counter.

## Transaction and authority rules

Every write runs inside `BEGIN IMMEDIATE` and either commits completely or rolls back completely. Each command validates an exact request envelope, revalidates domain records, recomputes canonical fingerprints, checks source policy and authority bindings, applies compare-and-swap versions, and writes sanitized outbox evidence in the same transaction.

Identity replay is accepted only when the stored and requested records are exactly equivalent. A changed replay fails closed. The critical T10 transaction binds the exact task, lease, attempt, activation, frozen plan, provider, mapping, capability, lane, policy, source record, payload fingerprint, evidence identity, timestamps, and result fingerprint before it atomically:

- stores the immutable attempt result;
- stores normalized evidence;
- moves `VALIDATING -> COMMITTED`;
- updates budget counters;
- deletes the lease;
- appends transition and outbox evidence.

An outbox insertion failure therefore rolls back every T10 mutation.

## Retry boundary

The initial runner permits at most two durable attempt claims. T8 rejects claims beyond the task limit. T9 additionally prohibits the final allowed attempt from returning to `RETRY_WAIT`; it must finish in a terminal state. This prevents a stranded retry state that can never acquire another lease.

The repository validates caller-supplied retry disposition but does not infer retryability from provider text and does not run a retry loop.

## Reads

The repository exposes immutable sanitized reads for:

- runner definitions;
- pilot state/version;
- task state/version;
- activation budget counters;
- normalized evidence by task.

No read returns raw canonical database JSON or an internal database handle.

## Validation

The focused network-free suite covers 31 transaction, authority, idempotency, rollback, compare-and-swap, budget, lease, attempt, retry, evidence, and immutable-read cases. Tests use temporary SQLite stores only and remove them after each case.

## Explicit exclusions

T3B does not:

- create or configure a persistent application store;
- provide a scheduler, worker, timer, heartbeat loop, lease recovery, or retry executor;
- invoke Robinhood, Kalshi, or any other provider;
- freeze or activate a real pilot;
- publish outbox records;
- implement startup recovery, backup, restore, or corruption tooling;
- store raw payloads, secrets, accounts, portfolios, or orders;
- add AI, probability, recommendation, ranking, sizing, broker, order, or execution authority.

## Related specifications

- [Event Contract Collection Runner Contracts](EVENT_CONTRACT_COLLECTION_RUNNER_CONTRACTS.md)
- [Event Contract Collection Runner SQLite Schema and Transaction Boundaries](EVENT_CONTRACT_COLLECTION_RUNNER_SQLITE.md)
- [Event Contract Collection Runner SQLite Dependency and Migration](EVENT_CONTRACT_COLLECTION_RUNNER_SQLITE_MIGRATION.md)
