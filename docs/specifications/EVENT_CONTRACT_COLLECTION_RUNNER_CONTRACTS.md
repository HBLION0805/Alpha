# Event Contract Collection Runner Contracts v1

## Status

Day15-T3B10-T1 implements provider-neutral runner records and deterministic state validation. It is the first implementation task under the approved T3B9 architecture.

This milestone adds no repository, SQLite database, migration, scheduler, clock implementation, lease manager, worker, retry loop, adapter composition, network request, persistence, operator command, pilot activation, probability, recommendation, sizing, broker, order, or execution behavior.

## Purpose

The contracts establish the only records that later runner infrastructure may accept:

- runner definition;
- owner-approved pilot activation;
- exact per-task admission bundle;
- scheduled source task;
- pilot and task state records;
- compare-and-swap transition requests.

They convert the T3B9 authority and lifecycle design into deterministic validation before persistence or orchestration exists.

## Authority boundary

Every constructed record is:

- research-only;
- deterministic;
- immutable;
- provider-neutral;
- non-executable.

A pilot activation records supplied owner approval evidence. Constructing the record does not approve or activate a real pilot. Only an owner-approved future operator command and persistence transaction may do that.

## Runner definition

The initial version hard-codes the T3B9 pilot ceilings:

- one active pilot;
- one worker;
- one in-flight request;
- one request per second;
- maximum absolute clock offset of 1,000 milliseconds.

Capabilities must be unique, declared `EventContractSourceCapability` values. The build fingerprint and the resulting definition fingerprint bind later tasks to reviewed code and policy identity.

## Pilot activation

An activation binds one frozen plan and runner definition to:

- owner identity and approval time;
- fixed UTC start and stop times;
- non-empty admitted provider fingerprints;
- zero or more unique admitted mapping fingerprints;
- positive safe-integer event and request budgets.

Approval must precede the start, start must precede stop, the request budget cannot be smaller than the event budget, and the activation window is bounded to seven days.

The constructed state is always `OWNER_APPROVED` with aggregate version `1`. The constructor cannot create an already active or terminal pilot.

## Scheduled task and admission

One task binds:

- one frozen plan and planned event;
- one capability and source lane;
- one exact provider;
- one source record and request policy;
- one observation slot;
- one evidence cutoff and task deadline;
- bounded attempts, bytes, records, and request duration;
- one activation identity and expiry.

Exchange-lane tasks require a complete mapping triple: mapping ID, version, and fingerprint. Platform-lane tasks must contain no exchange mapping. This prevents exchange-native evidence from being relabeled as Robinhood platform evidence.

The initial bounds are:

- maximum attempts: `1..2`;
- raw payload bytes: `1..1,000,000`;
- records: `1..1,000`;
- request deadline: `1..60,000` milliseconds.

The task must be scheduled no later than its evidence cutoff. The cutoff cannot exceed the task deadline, and the deadline cannot exceed activation expiry.

The idempotency key is a deterministic fingerprint over the exact T3B9 identity tuple:

```text
plan fingerprint
+ planned-event ID
+ provider fingerprint
+ mapping fingerprint or NONE
+ capability
+ source-record ID
+ observation slot
+ runner-definition version
```

## State validation

Pilot transitions:

```text
DRAFT -> OWNER_APPROVED
OWNER_APPROVED -> ACTIVE | REVOKED
ACTIVE -> STOP_REQUESTED | REVOKED | COMPLETED | FAILED_CLOSED
STOP_REQUESTED -> STOPPED
```

Task transitions:

```text
SCHEDULED -> BLOCKED | DUE | MISSED | TERMINAL_FAILED | CANCELLED
BLOCKED -> DUE | MISSED | TERMINAL_FAILED | CANCELLED
DUE -> LEASED | MISSED | TERMINAL_FAILED | CANCELLED
LEASED -> IN_FLIGHT | MISSED | TERMINAL_FAILED | CANCELLED
IN_FLIGHT -> VALIDATING | RETRY_WAIT | MISSED | TERMINAL_FAILED | CANCELLED
VALIDATING -> COMMITTED | RETRY_WAIT | MISSED | TERMINAL_FAILED | CANCELLED
RETRY_WAIT -> DUE | MISSED | TERMINAL_FAILED | CANCELLED
```

Every transition requires an exact expected aggregate version and increments it by one. Same-state, skipped, reverse, unknown, stale-version, and terminal-state transitions fail closed.

## Validation rules

- Unknown fields are rejected recursively.
- Identifiers, versions, fingerprints, timestamps, enum values, bounds, ordering, and cross-record references are checked.
- Provider and mapping fingerprints must be admitted by the activation.
- Frozen plan, activation, and runner-definition identities must match exactly.
- Inputs and outputs are deep-cloned and deeply frozen.
- Fingerprints are deterministic under normalized set ordering.
- Errors contain bounded issue codes and field paths, not provider payloads or secrets.

## Explicit exclusions

This milestone does not:

- persist any contract;
- activate a pilot;
- obtain wall-clock or monotonic time;
- decide that a task is due or missed from the current time;
- acquire or recover a lease;
- classify a transport error or perform a retry;
- invoke an event-contract adapter;
- collect or normalize provider evidence;
- create a Day15-T1 observation;
- modify a Day15-T2 ledger;
- qualify a dataset;
- calculate probability, expected value, recommendation, or capital allocation;
- access Robinhood or Kalshi;
- place or simulate a trade.

## Acceptance criteria

- all public constructors reject undeclared fields and invalid nested inputs;
- runner ceilings cannot be widened;
- activation authority and chronology fail closed;
- platform and exchange lanes cannot be confused;
- admitted provider, mapping, plan, activation, and runner identities bind exactly;
- idempotency is deterministic and sensitive to every declared identity component;
- every allowed state edge succeeds with compare-and-swap versioning;
- invalid and terminal transitions fail closed;
- outputs are immutable and contain no provider-specific field or trading authority;
- focused and complete validation pass.

## Related specifications

- [Event Contract Collection Runner Architecture](EVENT_CONTRACT_COLLECTION_RUNNER_ARCHITECTURE.md)
- [Event Contract Source Contracts](EVENT_CONTRACT_SOURCE_CONTRACTS.md)
- [Forward Shadow Collection Control](FORWARD_SHADOW_COLLECTION_CONTROL.md)
