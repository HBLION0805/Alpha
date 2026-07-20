# Python-TypeScript Integration Boundary

Version: 1.0
Task: D7-T1
Status: Implemented local foundation; owner review pending

## 1. Purpose

This boundary lets Alpha's TypeScript application layer invoke explicitly registered deterministic Python capabilities without depending on Python modules, exceptions, command construction, or stdout parsing.

The dependency direction is fixed:

```text
TypeScript application
  -> PythonIntegrationClient port
  -> PythonIntegrationTransport port
  -> local subprocess transport
  -> app.integration.entrypoint
  -> explicit Python operation registry
  -> existing Python domain engine
```

Python domain modules do not depend on TypeScript. Dashboard and UI code must depend on the typed client port and must never invoke Python directly.

## 2. Implemented Scope

The v1 foundation implements one read-only operation:

- `risk.calculate_limits` accepts `totalCapital` and invokes the existing deterministic `RiskEngine.get_summary` method.

The operation reads immutable risk configuration and returns calculated limits. It does not mutate portfolio, risk, decision, trade, strategy, AI, or persistence state and does not create an investment recommendation.

## 3. Contract Version

The current contract version is `1.0`. Requests with another version fail with `UNSUPPORTED_CONTRACT_VERSION`. A breaking envelope or operation-schema change requires a new contract version. Compatible operation additions may remain within v1 only when old clients continue to validate and behave unchanged.

TypeScript and Python maintain mirrored definitions because they execute in separate runtimes. Focused cross-runtime tests verify that both definitions agree.

## 4. Request Contract

Every request contains:

- `contractVersion`
- `requestId`
- `operation`
- `requestedAt`
- `payload`
- optional string-only `metadata`

Identifiers and timestamps are bounded and validated. Metadata is bounded and rejects secret-bearing keys. Payloads are never logged by this foundation.

## 5. Response Contract

A successful response contains:

- the supported `contractVersion`
- the original `requestId` and `operation`
- `status: SUCCESS`
- `completedAt`
- typed `data`
- `warnings`
- trace metadata containing `durationMs`, `boundary`, and `transport`

A failure response contains the same envelope with `status: FAILURE` and a stable error containing `code`, safe `message`, `category`, `retryable`, and optional safe string details.

Stack traces, raw exceptions, stderr, secrets, local paths, executable paths, and Python module names are not part of the public response.

## 6. Operation Registry

Python dispatch uses an immutable registry that maps one exact operation name to one payload validator, handler, and result validator. Arbitrary imports, module names, function names, expressions, and command arguments are never dispatched.

Adding an operation requires:

1. Add the typed payload/result mapping in TypeScript.
2. Add mirrored Python payload and result validation.
3. Register one exact name and one handler in the Python registry.
4. Confirm the handler delegates to an existing deterministic domain capability.
5. Add tests on both sides for success, malformed input, domain failure, output validation, and deterministic behavior.
6. Update this specification without changing existing operation behavior.

## 7. Transport Choice

The initial transport is a local subprocess because Alpha is currently a local single-owner prototype, Python already owns the demonstrated domain logic, and no service deployment or network boundary is justified.

The transport:

- starts a configured Python executable directly with `shell: false`
- always invokes the fixed module `app.integration.entrypoint`
- passes one JSON document through stdin
- accepts one JSON document from stdout
- applies a five-second default timeout
- limits output to one MiB
- terminates timed-out children through the runtime's bounded subprocess call
- treats non-zero exit, start failure, timeout, output overflow, empty output, and invalid JSON as distinct stable integration failures
- never treats stderr or logs as response data

TypeScript consumers depend on `PythonIntegrationTransport`, not on this subprocess implementation. A future local service or remote transport can replace the adapter without changing business consumers or operation contracts.

## 8. Validation Boundary

TypeScript validates the outbound envelope and operation payload before transport. It then validates the entire inbound response, including contract version, status, operation, request identity, timestamps, warnings, trace metadata, error taxonomy, and typed result.

Python validates the request envelope before registry lookup, validates the selected operation payload before calling the domain handler, and validates handler output before serialization.

The boundary fails closed for malformed input, unknown fields, unknown operations, unsupported versions, non-finite numbers, response ID or operation mismatch, invalid result shapes, unexpected statuses, and secret-bearing metadata.

## 9. Error Taxonomy

Stable codes are:

- `VALIDATION_ERROR`
- `UNSUPPORTED_CONTRACT_VERSION`
- `UNKNOWN_OPERATION`
- `DOMAIN_ERROR`
- `TRANSPORT_ERROR`
- `TIMEOUT`
- `PROTOCOL_ERROR`
- `INTERNAL_ERROR`

Application consumers receive `AlphaIntegrationError`, not Python exceptions, subprocess errors, JSON parser errors, or framework-specific objects. Validation, compatibility, and domain failures are not retryable. Local start failures and timeouts are marked retryable for caller policy, but the v1 client does not retry automatically.

## 10. Observability and Auditability

Every protocol response preserves request ID, operation, contract version, completion timestamp, duration, and status. This is sufficient for caller-owned structured audit translation without introducing a new logger or persistence authority.

The foundation does not persist audit records and does not log payload contents. A future audit integration must record only normalized metadata and must not transfer domain ownership to Unified Audit.

## 11. Security Boundary

The integration entry point accepts data only. It cannot execute arbitrary commands, import caller-selected modules, access a caller-selected file, or select a handler outside the registry. The TypeScript adapter never uses a shell and never interpolates payload data into process arguments.

No AI model, provider SDK, credential, network call, broker, live market source, or background service is involved.

## 12. Authority Boundary

Python Risk Engine remains authoritative for its deterministic calculation. TypeScript owns the application-facing contract and transport abstraction but does not duplicate the calculation. The integration layer validates and translates; it does not make capital decisions or weaken owner-controlled execution.

The current operation is read-only. Mutation operations require a separate specification covering authorization, idempotency, transaction, recovery, audit persistence, and capital-control effects.

## 13. Timeout and Failure Behavior

The subprocess timeout is per request and configurable by the application composition root. Timeout kills the local process and returns `TIMEOUT`. Process creation or non-zero exit returns `TRANSPORT_ERROR`. Valid JSON with a failure envelope returns the Python-provided stable domain or validation error. Invalid or mismatched output returns `PROTOCOL_ERROR`.

There is no automatic retry. A future caller may apply a bounded retry policy only to safe read-only operations and only when the stable error is retryable.

## 14. Deferred Production Concerns

The following are intentionally deferred:

- service deployment and remote networking
- authentication between runtimes
- distributed tracing
- queues, workers, and background services
- high availability and load balancing
- production process supervision
- automatic retries
- mutable domain operations
- cross-runtime transactions and crash recovery
- dashboard UI integration
- migration of other Python engines
- AI Router integration
- provider, broker, or live-market integration

## 15. Current Limitations

The subprocess is synchronous and appropriate only for the current narrow local read-only operation. Python executable selection belongs to application configuration. The contract is mirrored rather than generated from one schema source. Observability metadata is returned to the caller but not durably persisted. These limitations must be reviewed before expanding the boundary.
